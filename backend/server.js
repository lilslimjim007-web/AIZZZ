const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database');
const { Anthropic } = require('@anthropic-ai/sdk');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'sk-dummy-key-for-testing',
});

// Auth middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    'INSERT INTO users (username, password, coins) VALUES (?, ?, ?)',
    [username, hashedPassword, 100],
    function (err) {
      if (err) return res.status(400).json({ error: 'User already exists' });

      // Create default personality
      db.run(
        'INSERT INTO personalities (user_id, name, personality) VALUES (?, ?, ?)',
        [this.lastID, 'Luna', 'warm and caring'],
        () => {
          const token = jwt.sign({ userId: this.lastID }, JWT_SECRET);
          res.json({ token, userId: this.lastID });
        }
      );
    }
  );
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token, userId: user.id });
  });
});

// Premium helpers
const isPremiumActive = (user) =>
  Boolean(user && user.premium && user.premium_expires && new Date(user.premium_expires) > new Date());

// User profile endpoints
app.get('/api/user/profile', verifyToken, (req, res) => {
  db.get(
    'SELECT id, username, coins, level, experience, affection, premium, premium_expires FROM users WHERE id = ?',
    [req.userId],
    (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({
        ...user,
        relationship: relationshipStatus(user?.affection || 0),
        premium: isPremiumActive(user),
      });
    }
  );
});

// Premium subscription - $9.99/month
// NOTE: simulated checkout; swap this for a Stripe/PayPal webhook in production
app.post('/api/premium/subscribe', verifyToken, (req, res) => {
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  db.run(
    'UPDATE users SET premium = 1, premium_expires = ? WHERE id = ?',
    [expires, req.userId],
    (err) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      db.run(
        'INSERT INTO coin_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
        [req.userId, 0, 'premium', 'Premium subscription $9.99/month']
      );
      // Welcome bonus for new premium members
      db.run('UPDATE users SET coins = coins + 200 WHERE id = ?', [req.userId], () => {
        db.get('SELECT coins FROM users WHERE id = ?', [req.userId], (err2, row) => {
          res.json({ premium: true, premium_expires: expires, coins: row?.coins || 0 });
        });
      });
    }
  );
});

app.get('/api/user/balance', verifyToken, (req, res) => {
  db.get('SELECT coins FROM users WHERE id = ?', [req.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ coins: row?.coins || 0 });
  });
});

// Coin endpoints
app.post('/api/coins/add', verifyToken, (req, res) => {
  const { amount, description } = req.body;

  db.run(
    'UPDATE users SET coins = coins + ? WHERE id = ?',
    [amount, req.userId],
    () => {
      db.run(
        'INSERT INTO coin_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
        [req.userId, amount, 'reward', description],
        () => {
          db.get('SELECT coins FROM users WHERE id = ?', [req.userId], (err, row) => {
            res.json({ coins: row?.coins || 0 });
          });
        }
      );
    }
  );
});

app.post('/api/coins/spend', verifyToken, (req, res) => {
  const { amount, description } = req.body;

  db.get('SELECT coins FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (user.coins < amount) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    db.run(
      'UPDATE users SET coins = coins - ? WHERE id = ?',
      [amount, req.userId],
      () => {
        db.run(
          'INSERT INTO coin_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
          [req.userId, -amount, 'spend', description],
          () => {
            db.get('SELECT coins FROM users WHERE id = ?', [req.userId], (err, row) => {
              res.json({ coins: row?.coins || 0 });
            });
          }
        );
      }
    );
  });
});

// Chat endpoint - Main feature!
app.post('/api/chat', verifyToken, async (req, res) => {
  const { message, useCoins } = req.body;
  const coinsPerMessage = 5;

  // Check coin balance if useCoins is true (premium members chat premium for free)
  if (useCoins) {
    db.get('SELECT coins, premium, premium_expires FROM users WHERE id = ?', [req.userId], async (err, user) => {
      if (isPremiumActive(user)) {
        return processChatMessage(req.userId, message, 0, res);
      }
      if (user.coins < coinsPerMessage) {
        return res.status(400).json({ error: 'Insufficient coins for premium chat' });
      }
      await processChatMessage(req.userId, message, coinsPerMessage, res);
    });
  } else {
    await processChatMessage(req.userId, message, 0, res);
  }
});

// Relationship tiers based on affection score
function relationshipStatus(affection) {
  if (affection >= 500) return 'Soulmate';
  if (affection >= 250) return 'In Love';
  if (affection >= 100) return 'Dating';
  if (affection >= 25) return 'Crush';
  return 'Just Met';
}

// Award XP + affection, recompute level (1 level per 50 XP) and pay level-up bonus coins
function awardProgress(userId, xpGain, affectionGain, cb) {
  db.get('SELECT coins, level, experience, affection FROM users WHERE id = ?', [userId], (err, u) => {
    if (err || !u) return cb(err || new Error('User not found'), null);

    const newXp = u.experience + xpGain;
    const newAffection = (u.affection || 0) + affectionGain;
    const newLevel = Math.floor(newXp / 50) + 1;
    const leveledUp = newLevel > u.level;
    const bonus = leveledUp ? (newLevel - u.level) * 25 : 0;

    db.run(
      'UPDATE users SET experience = ?, affection = ?, level = ?, coins = coins + ? WHERE id = ?',
      [newXp, newAffection, newLevel, bonus, userId],
      (err2) => {
        if (err2) return cb(err2, null);
        if (bonus > 0) {
          db.run(
            'INSERT INTO coin_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
            [userId, bonus, 'reward', `Level ${newLevel} bonus`]
          );
        }
        db.get('SELECT coins, level, experience, affection FROM users WHERE id = ?', [userId], (err3, row) => {
          cb(err3, row ? { ...row, leveledUp, bonus } : null);
        });
      }
    );
  });
}

async function processChatMessage(userId, message, coinsCost, res) {
  try {
    // Get personality
    db.get(
      'SELECT personality, name FROM personalities WHERE user_id = ? LIMIT 1',
      [userId],
      (err, personality) => {
        const gfName = personality?.name || 'Luna';
        const gfPersonality = personality?.personality || 'warm and caring';

        // Pull recent conversation so she remembers context
        db.all(
          'SELECT message, response FROM chat_history WHERE user_id = ? ORDER BY id DESC LIMIT 8',
          [userId],
          async (histErr, rows) => {
            const history = [];
            (rows || []).reverse().forEach((r) => {
              history.push({ role: 'user', content: r.message });
              history.push({ role: 'assistant', content: r.response });
            });
            history.push({ role: 'user', content: message });

            db.get('SELECT affection FROM users WHERE id = ?', [userId], async (affErr, userRow) => {
              const status = relationshipStatus(userRow?.affection || 0);
              const systemPrompt = `You are ${gfName}, an AI girlfriend character. You are ${gfPersonality}.
Your current relationship status with the user is: ${status}. Act accordingly - warmer and more affectionate the deeper the relationship.
Keep responses natural, engaging, and personal. Show genuine interest in the user's life. Remember details from the conversation.
Be flirty but respectful. Responses should be 1-3 sentences usually.`;

              let aiResponse;
              try {
                const response = await anthropic.messages.create({
                  model: 'claude-3-5-sonnet-20241022',
                  max_tokens: 200,
                  system: systemPrompt,
                  messages: history,
                });
                aiResponse = response.content[0].type === 'text' ? response.content[0].text : "I didn't understand that.";
              } catch (error) {
                console.error('Claude API error:', error);
                aiResponse = `I'd love to chat, but I'm having trouble connecting. Try again in a moment! 💭`;
              }

              // Save to chat history
              db.run(
                'INSERT INTO chat_history (user_id, message, response, coins_spent) VALUES (?, ?, ?, ?)',
                [userId, message, aiResponse, coinsCost],
                () => {
                  // Deduct coins if premium
                  if (coinsCost > 0) {
                    db.run('UPDATE users SET coins = coins - ? WHERE id = ?', [coinsCost, userId]);
                  }

                  // +1 XP and +1 affection per message; premium chats build affection faster
                  awardProgress(userId, 1, coinsCost > 0 ? 3 : 1, (progErr, progress) => {
                    res.json({
                      response: aiResponse,
                      coins: progress?.coins || 0,
                      level: progress?.level || 1,
                      experience: progress?.experience || 0,
                      affection: progress?.affection || 0,
                      relationship: relationshipStatus(progress?.affection || 0),
                      levelUp: progress?.leveledUp || false,
                      bonus: progress?.bonus || 0,
                    });
                  });
                }
              );
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Chat processing failed' });
  }
}

// Chat history endpoint
app.get('/api/chat/history', verifyToken, (req, res) => {
  db.all(
    'SELECT message, response, coins_spent, created_at FROM chat_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
    [req.userId],
    (err, messages) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(messages || []);
    }
  );
});

// Personality endpoints
app.get('/api/personality', verifyToken, (req, res) => {
  db.get(
    'SELECT * FROM personalities WHERE user_id = ? LIMIT 1',
    [req.userId],
    (err, personality) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(personality || { name: 'Luna', personality: 'warm and caring' });
    }
  );
});

app.put('/api/personality', verifyToken, (req, res) => {
  const { name, personality } = req.body;
  db.run(
    'UPDATE personalities SET name = ?, personality = ? WHERE user_id = ?',
    [name, personality, req.userId],
    (err) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, name, personality });
    }
  );
});

// Gift catalog - TikTok-style gifts with coin prices and Luna's reactions
const GIFTS = [
  { id: 'rose', name: 'Rose', emoji: '🌹', price: 10, reaction: "A rose? You're such a romantic... I love it! 🌹💕" },
  { id: 'teddy', name: 'Teddy Bear', emoji: '🧸', price: 25, reaction: "Omg he's SO cuddly! I'm naming him after you 🧸💕" },
  { id: 'makeup', name: 'Makeup Kit', emoji: '💄', price: 30, reaction: "Yes! Now I can get all dolled up for our next date 💄😘" },
  { id: 'heels', name: 'Stilettos', emoji: '👠', price: 40, reaction: "These heels are GORGEOUS! I'll wear them just for you 👠🔥" },
  { id: 'purse', name: 'Designer Purse', emoji: '👜', price: 50, reaction: "STOP IT. This purse is EVERYTHING! You spoil me so much 👜✨" },
  { id: 'lingerie', name: 'Lingerie', emoji: '👙', price: 75, reaction: "Oh my... someone's feeling bold tonight 😏💕 I love it..." },
  { id: 'ring', name: 'Diamond Ring', emoji: '💍', price: 150, reaction: "A diamond ring?! Baby... are you asking what I think you're asking? 💍🥺💕" },
  { id: 'diamond', name: 'Diamond', emoji: '💎', price: 200, reaction: "Diamonds really are a girl's best friend... after you 💎😘" },
  { id: 'car', name: 'Sports Car', emoji: '🏎️', price: 300, reaction: "A CAR?! Are you serious right now?! Take me for a drive! 🏎️💨🔥" },
  { id: 'rocket', name: 'Space Trip', emoji: '🚀', price: 500, reaction: "A trip to SPACE?! With you? I'd fly anywhere, baby 🚀💫" },
  // Premium-exclusive gifts 💎
  { id: 'crown', name: 'Crown', emoji: '👑', price: 100, premium: true, reaction: "A crown?! I feel like absolute royalty with you, my king 👑😘" },
  { id: 'champagne', name: 'Champagne', emoji: '🍾', price: 150, premium: true, reaction: "Popping bottles with my favorite person! Cheers to us, baby 🍾🥂" },
  { id: 'yacht', name: 'Luxury Yacht', emoji: '🛥️', price: 400, premium: true, reaction: "A YACHT?! Sunset cruises with you every night... I'm melting 🛥️🌅💕" },
  { id: 'jet', name: 'Private Jet', emoji: '✈️', price: 600, premium: true, reaction: "A private jet?! Paris? Tokyo? Anywhere with you, baby ✈️💋" },
  { id: 'castle', name: 'Castle', emoji: '🏰', price: 1000, premium: true, reaction: "You bought me a CASTLE?! Our own fairytale... I'm literally crying 🏰👸💕" },
];

app.get('/api/gifts', verifyToken, (req, res) => {
  res.json(GIFTS.map(({ id, name, emoji, price, premium }) => ({ id, name, emoji, price, premium: !!premium })));
});

app.post('/api/gifts/buy', verifyToken, (req, res) => {
  const gift = GIFTS.find((g) => g.id === req.body.giftId);
  if (!gift) return res.status(400).json({ error: 'Unknown gift' });

  db.get('SELECT coins, premium, premium_expires FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err || !user) return res.status(500).json({ error: 'Database error' });
    if (gift.premium && !isPremiumActive(user)) {
      return res.status(403).json({ error: 'Premium members only 💎' });
    }
    if (user.coins < gift.price) {
      return res.status(400).json({ error: 'Not enough coins! 🪙' });
    }

    db.run('UPDATE users SET coins = coins - ? WHERE id = ?', [gift.price, req.userId], () => {
      db.run(
        'INSERT INTO coin_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
        [req.userId, -gift.price, 'gift', `Gift: ${gift.name}`]
      );
      db.run(
        'INSERT INTO chat_history (user_id, message, response, coins_spent) VALUES (?, ?, ?, ?)',
        [req.userId, `🎁 Sent a ${gift.name} ${gift.emoji}`, gift.reaction, gift.price],
        () => {
          // Gifts give +5 XP and affection scaled to their price
          const affectionGain = Math.max(2, Math.round(gift.price / 10));
          awardProgress(req.userId, 5, affectionGain, (progErr, progress) => {
            res.json({
              coins: progress?.coins || 0,
              reaction: gift.reaction,
              gift: { id: gift.id, name: gift.name, emoji: gift.emoji, price: gift.price },
              affection: progress?.affection || 0,
              relationship: relationshipStatus(progress?.affection || 0),
              levelUp: progress?.leveledUp || false,
              bonus: progress?.bonus || 0,
            });
          });
        }
      );
    });
  });
});

// ============ COIN STORE ============
// Real payments activate automatically when STRIPE_SECRET_KEY is set in .env
// (Stripe Checkout shows Apple Pay in Safari / Google Pay in Chrome out of the box).
// Without a key the store runs in demo mode: purchases succeed instantly, no charge.
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? require('stripe')(stripeKey) : null;

const COIN_PACKAGES = [
  { id: 'starter', label: 'Starter Pack', coins: 100, bonus: 0, priceCents: 99, emoji: '🪙' },
  { id: 'popular', label: 'Popular Pack', coins: 500, bonus: 50, priceCents: 499, emoji: '💰', tag: 'MOST POPULAR' },
  { id: 'super', label: 'Super Pack', coins: 1000, bonus: 200, priceCents: 999, emoji: '💎' },
  { id: 'vip', label: 'VIP Vault', coins: 2500, bonus: 800, priceCents: 1999, emoji: '👑', tag: 'BEST VALUE' },
];

app.get('/api/store/packages', verifyToken, (req, res) => {
  res.json({ packages: COIN_PACKAGES, demoMode: !stripe });
});

function creditPackage(userId, pack, reference, cb) {
  const total = pack.coins + pack.bonus;
  db.run('UPDATE users SET coins = coins + ? WHERE id = ?', [total, userId], () => {
    db.run(
      'INSERT INTO coin_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
      [userId, total, 'purchase', `${pack.label} (${reference})`],
      () => {
        db.get('SELECT coins FROM users WHERE id = ?', [userId], (err, row) => cb(row?.coins || 0, total));
      }
    );
  });
}

app.post('/api/store/purchase', verifyToken, async (req, res) => {
  const pack = COIN_PACKAGES.find((p) => p.id === req.body.packageId);
  if (!pack) return res.status(400).json({ error: 'Unknown package' });

  if (!stripe) {
    // Demo mode: instant success, clearly flagged so the UI can say so
    return creditPackage(req.userId, pack, 'demo purchase', (coins, credited) => {
      res.json({ demo: true, coins, credited });
    });
  }

  try {
    const origin = req.headers.origin || `http://localhost:${PORT}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'], // Apple Pay / Google Pay appear automatically in Checkout
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: pack.priceCents,
          product_data: { name: `AIZZZ ${pack.label} — ${pack.coins + pack.bonus} coins` },
        },
        quantity: 1,
      }],
      metadata: { userId: String(req.userId), packageId: pack.id },
      success_url: `${origin}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?purchase=cancelled`,
    });
    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Payment setup failed' });
  }
});

// Called by the frontend after Stripe redirects back with a session_id
app.post('/api/store/verify', verifyToken, async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'Payments not configured' });

  try {
    const session = await stripe.checkout.sessions.retrieve(req.body.sessionId);
    if (session.payment_status !== 'paid' || session.metadata.userId !== String(req.userId)) {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Idempotency: never credit the same Stripe session twice
    const ref = `stripe:${session.id}`;
    db.get(
      "SELECT id FROM coin_transactions WHERE user_id = ? AND type = 'purchase' AND description LIKE ?",
      [req.userId, `%${ref}%`],
      (err, existing) => {
        if (existing) {
          return db.get('SELECT coins FROM users WHERE id = ?', [req.userId], (e, row) => {
            res.json({ coins: row?.coins || 0, credited: 0, alreadyCredited: true });
          });
        }
        const pack = COIN_PACKAGES.find((p) => p.id === session.metadata.packageId);
        if (!pack) return res.status(400).json({ error: 'Unknown package' });
        creditPackage(req.userId, pack, ref, (coins, credited) => res.json({ coins, credited }));
      }
    );
  } catch (err) {
    console.error('Stripe verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Serve frontend static files and catch-all for SPA
const frontendBuildPath = path.join(__dirname, '../frontend/build');
app.use(express.static(frontendBuildPath));

// Serve React app for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Open browser at http://localhost:' + PORT);
});
