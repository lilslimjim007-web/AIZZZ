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

// User profile endpoints
app.get('/api/user/profile', verifyToken, (req, res) => {
  db.get(
    'SELECT id, username, coins, level, experience FROM users WHERE id = ?',
    [req.userId],
    (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(user);
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

  // Check coin balance if useCoins is true
  if (useCoins) {
    db.get('SELECT coins FROM users WHERE id = ?', [req.userId], async (err, user) => {
      if (user.coins < coinsPerMessage) {
        return res.status(400).json({ error: 'Insufficient coins for premium chat' });
      }
      await processChatMessage(req.userId, message, coinsPerMessage, res);
    });
  } else {
    await processChatMessage(req.userId, message, 0, res);
  }
});

async function processChatMessage(userId, message, coinsCost, res) {
  try {
    // Get personality
    db.get(
      'SELECT personality, name FROM personalities WHERE user_id = ? LIMIT 1',
      [userId],
      async (err, personality) => {
        const gfName = personality?.name || 'Luna';
        const gfPersonality = personality?.personality || 'warm and caring';

        const systemPrompt = `You are ${gfName}, an AI girlfriend character. You are ${gfPersonality}.
Keep responses natural, engaging, and personal. Show genuine interest in the user's life.
Be flirty but respectful. Responses should be 1-3 sentences usually.`;

        try {
          const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 200,
            system: systemPrompt,
            messages: [
              { role: 'user', content: message },
            ],
          });

          const aiResponse = response.content[0].type === 'text' ? response.content[0].text : 'I didn\'t understand that.';

          // Save to chat history
          db.run(
            'INSERT INTO chat_history (user_id, message, response, coins_spent) VALUES (?, ?, ?, ?)',
            [userId, message, aiResponse, coinsCost],
            () => {
              // Deduct coins if premium
              if (coinsCost > 0) {
                db.run(
                  'UPDATE users SET coins = coins - ? WHERE id = ?',
                  [coinsCost, userId]
                );
              }

              // Award experience and potentially level up
              db.run(
                'UPDATE users SET experience = experience + 1 WHERE id = ?',
                [userId],
                () => {
                  db.get('SELECT coins, level, experience FROM users WHERE id = ?', [userId], (err, user) => {
                    res.json({
                      response: aiResponse,
                      coins: user?.coins || 0,
                      level: user?.level || 1,
                      experience: user?.experience || 0,
                    });
                  });
                }
              );
            }
          );
        } catch (error) {
          console.error('Claude API error:', error);
          // Fallback response if API fails
          const fallbackResponse = `I'd love to chat, but I'm having trouble connecting. Try again in a moment! 💭`;
          res.json({ response: fallbackResponse, coins: 0, level: 1 });
        }
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
