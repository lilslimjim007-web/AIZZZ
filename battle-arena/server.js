require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { run, get, all } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 5001;
// How far out matches get scheduled once 4 players are ready (default 30 min)
const MATCH_DELAY_MIN = parseInt(process.env.MATCH_DELAY_MINUTES || '30', 10);
// Players must confirm ("ready up") this many minutes before start or lose their spot
const CONFIRM_CUTOFF_MIN = parseInt(process.env.CONFIRM_CUTOFF_MINUTES || '5', 10);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

// ---------- auth helpers ----------

async function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  await run('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, userId]);
  return token;
}

async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  const session = await get('SELECT user_id FROM sessions WHERE token = ?', [token]);
  if (!session) return res.status(401).json({ error: 'Session expired, sign in again' });
  req.user = await get('SELECT * FROM users WHERE id = ?', [session.user_id]);
  if (!req.user) return res.status(401).json({ error: 'User not found' });
  next();
}

async function findOrCreateUser(provider, providerId, email) {
  let user = await get('SELECT * FROM users WHERE provider = ? AND provider_id = ?', [provider, providerId]);
  if (!user) {
    const r = await run('INSERT INTO users (provider, provider_id, email) VALUES (?, ?, ?)', [provider, providerId, email]);
    user = await get('SELECT * FROM users WHERE id = ?', [r.lastID]);
  }
  return user;
}

// ---------- auth routes ----------

// Google Sign-In: the frontend sends the credential from Google Identity Services.
// We verify it against Google's tokeninfo endpoint.
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });
    const resp = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    if (!resp.ok) return res.status(401).json({ error: 'Google sign-in failed' });
    const info = await resp.json();
    if (GOOGLE_CLIENT_ID && info.aud !== GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Google token was issued for a different app' });
    }
    const user = await findOrCreateUser('google', info.sub, info.email || null);
    const token = await createSession(user.id);
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Google sign-in error' });
  }
});

// Apple Sign-In needs an Apple Developer account + Services ID to verify tokens.
// Until those credentials are configured, this endpoint explains what's needed.
app.post('/api/auth/apple', async (req, res) => {
  res.status(501).json({
    error: 'Apple Sign-In needs an Apple Developer Services ID configured. Use Google or Quick Join for now.',
  });
});

// Quick Join: name-only entry so the team can start battling before OAuth is set up.
app.post('/api/auth/guest', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (name.length < 2 || name.length > 20) {
      return res.status(400).json({ error: 'Name must be 2-20 characters' });
    }
    const user = await findOrCreateUser('guest', name.toLowerCase(), null);
    if (!user.username) {
      await run('UPDATE users SET username = ? WHERE id = ?', [name, user.id]);
      user.username = name;
    }
    const token = await createSession(user.id);
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not join' });
  }
});

app.post('/api/username', auth, async (req, res) => {
  const username = (req.body.username || '').trim();
  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ error: 'Username must be 2-20 characters' });
  }
  const taken = await get('SELECT id FROM users WHERE username = ? AND id != ?', [username, req.user.id]);
  if (taken) return res.status(400).json({ error: 'That username is taken' });
  await run('UPDATE users SET username = ? WHERE id = ?', [username, req.user.id]);
  res.json({ ok: true, username });
});

// ---------- check-in / ready up ----------

const today = () => new Date().toISOString().slice(0, 10);

app.post('/api/checkin', auth, async (req, res) => {
  if (!req.user.username) return res.status(400).json({ error: 'Pick a username first' });
  await run('INSERT OR IGNORE INTO checkins (user_id, day) VALUES (?, ?)', [req.user.id, today()]);
  res.json({ ok: true });
});

app.post('/api/ready', auth, async (req, res) => {
  const checkedIn = await get('SELECT id FROM checkins WHERE user_id = ? AND day = ?', [req.user.id, today()]);
  if (!checkedIn) return res.status(400).json({ error: 'Check in first' });
  const inMatch = await activeMatchFor(req.user.id);
  if (inMatch) return res.status(400).json({ error: 'You already have a match — check your bracket!' });
  await run('INSERT OR IGNORE INTO queue (user_id) VALUES (?)', [req.user.id]);
  await tryCreateMatch();
  res.json({ ok: true });
});

app.post('/api/unready', auth, async (req, res) => {
  await run('DELETE FROM queue WHERE user_id = ?', [req.user.id]);
  res.json({ ok: true });
});

// Confirm your spot in an upcoming match (the "ready up 5 minutes before" step)
app.post('/api/match/:id/confirm', auth, async (req, res) => {
  const r = await run(
    `UPDATE match_players SET confirmed = 1 WHERE match_id = ? AND user_id = ?`,
    [req.params.id, req.user.id]
  );
  if (!r.changes) return res.status(400).json({ error: 'You are not in this match' });
  res.json({ ok: true });
});

// Report the winner of a game — any player in the match can report
app.post('/api/game/:id/winner', auth, async (req, res) => {
  const game = await get('SELECT * FROM games WHERE id = ?', [req.params.id]);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const inMatch = await get('SELECT * FROM match_players WHERE match_id = ? AND user_id = ?', [game.match_id, req.user.id]);
  if (!inMatch) return res.status(403).json({ error: 'Only players in this match can report' });
  if (game.winner) return res.status(400).json({ error: 'Winner already reported' });
  const winnerId = parseInt(req.body.winner, 10);
  if (winnerId !== game.p1 && winnerId !== game.p2) {
    return res.status(400).json({ error: 'Winner must be one of the two players' });
  }
  await run('UPDATE games SET winner = ? WHERE id = ?', [winnerId, game.id]);
  await advanceBracket(game.match_id);
  res.json({ ok: true });
});

// ---------- state (the app polls this) ----------

app.get('/api/state', auth, async (req, res) => {
  try {
    const me = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const checkedIn = await get('SELECT id FROM checkins WHERE user_id = ? AND day = ?', [me.id, today()]);
    const inQueue = await get('SELECT ready_at FROM queue WHERE user_id = ?', [me.id]);

    const checkins = await all(
      `SELECT u.id, u.username, c.checked_in_at,
              (SELECT 1 FROM queue q WHERE q.user_id = u.id) AS ready
         FROM checkins c JOIN users u ON u.id = c.user_id
        WHERE c.day = ? ORDER BY c.checked_in_at`,
      [today()]
    );

    const queue = await all(
      `SELECT u.id, u.username, q.ready_at FROM queue q JOIN users u ON u.id = q.user_id ORDER BY q.ready_at`
    );

    const matches = await all(
      `SELECT * FROM matches WHERE status IN ('scheduled','live') OR
              (status IN ('complete','cancelled') AND created_at > datetime('now','-1 day'))
        ORDER BY scheduled_at`
    );
    for (const m of matches) {
      m.players = await all(
        `SELECT u.id, u.username, mp.slot, mp.confirmed
           FROM match_players mp JOIN users u ON u.id = mp.user_id
          WHERE mp.match_id = ? ORDER BY mp.slot`,
        [m.id]
      );
      m.games = await all('SELECT * FROM games WHERE match_id = ? ORDER BY id', [m.id]);
      m.mine = m.players.some((p) => p.id === me.id);
    }

    const leaderboard = await all(
      `SELECT id, username, wins, battles FROM users WHERE battles > 0 ORDER BY wins DESC, battles ASC LIMIT 10`
    );

    const notifications = await all(
      `SELECT * FROM notifications WHERE user_id = ? AND seen = 0 ORDER BY id`,
      [me.id]
    );
    if (notifications.length) {
      await run('UPDATE notifications SET seen = 1 WHERE user_id = ? AND seen = 0', [me.id]);
    }

    res.json({
      me: publicUser(me),
      checkedIn: !!checkedIn,
      inQueue: !!inQueue,
      checkins,
      queue,
      matches,
      leaderboard,
      notifications,
      config: { matchDelayMin: MATCH_DELAY_MIN, confirmCutoffMin: CONFIRM_CUTOFF_MIN },
      serverTime: new Date().toISOString(),
      googleClientId: GOOGLE_CLIENT_ID,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load state' });
  }
});

// Frontend asks for this before sign-in to know whether to show the real Google button
app.get('/api/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID });
});

// ---------- match engine ----------

function publicUser(u) {
  return { id: u.id, username: u.username, email: u.email, provider: u.provider, wins: u.wins, battles: u.battles };
}

async function activeMatchFor(userId) {
  return get(
    `SELECT m.* FROM matches m JOIN match_players mp ON mp.match_id = m.id
      WHERE mp.user_id = ? AND m.status IN ('scheduled','live') LIMIT 1`,
    [userId]
  );
}

async function notify(userId, message, kind = 'info') {
  await run('INSERT INTO notifications (user_id, message, kind) VALUES (?, ?, ?)', [userId, message, kind]);
}

// When 4 players are in the ready queue, pull them out and schedule a match
async function tryCreateMatch() {
  const ready = await all('SELECT user_id FROM queue ORDER BY ready_at LIMIT 4');
  if (ready.length < 4) return;

  const scheduledAt = new Date(Date.now() + MATCH_DELAY_MIN * 60 * 1000).toISOString();
  const m = await run('INSERT INTO matches (status, scheduled_at) VALUES (?, ?)', ['scheduled', scheduledAt]);

  let slot = 1;
  for (const r of ready) {
    await run('INSERT INTO match_players (match_id, user_id, slot) VALUES (?, ?, ?)', [m.lastID, r.user_id, slot++]);
    await run('DELETE FROM queue WHERE user_id = ?', [r.user_id]);
    await notify(
      r.user_id,
      `🥊 MATCH FOUND! Your 4-player elimination match starts in ${MATCH_DELAY_MIN} minutes. ` +
        `Make sure you ready up at least ${CONFIRM_CUTOFF_MIN} minutes before the start or you'll lose your spot!`,
      'match'
    );
  }
}

// Runs every 15s: enforce the confirm cutoff, backfill dropped spots, start matches
async function tick() {
  try {
    const now = Date.now();
    const scheduled = await all(`SELECT * FROM matches WHERE status = 'scheduled'`);

    for (const m of scheduled) {
      const startMs = new Date(m.scheduled_at).getTime();
      const cutoffMs = startMs - CONFIRM_CUTOFF_MIN * 60 * 1000;

      // Past the ready-up cutoff: drop anyone who didn't confirm, backfill from the queue
      if (now >= cutoffMs && now < startMs) {
        const unconfirmed = await all(
          'SELECT user_id, slot FROM match_players WHERE match_id = ? AND confirmed = 0',
          [m.id]
        );
        for (const u of unconfirmed) {
          await run('DELETE FROM match_players WHERE match_id = ? AND user_id = ?', [m.id, u.user_id]);
          await notify(u.user_id, `⏰ You missed the ready-up cutoff and lost your spot in match #${m.id}. Ready up again to get a new match!`, 'warn');
          const sub = await get('SELECT user_id FROM queue ORDER BY ready_at LIMIT 1');
          if (sub) {
            await run('DELETE FROM queue WHERE user_id = ?', [sub.user_id]);
            await run('INSERT INTO match_players (match_id, user_id, slot, confirmed) VALUES (?, ?, ?, 1)', [m.id, sub.user_id, u.slot]);
            await notify(sub.user_id, `🥊 A spot opened up! You're IN match #${m.id} starting soon. Get ready!`, 'match');
          }
        }
      }

      // Start time: launch the bracket if we still have 4, otherwise cancel and requeue
      if (now >= startMs) {
        const players = await all('SELECT user_id, slot FROM match_players WHERE match_id = ? ORDER BY slot', [m.id]);
        if (players.length === 4) {
          await run(`UPDATE matches SET status = 'live' WHERE id = ?`, [m.id]);
          await run('INSERT INTO games (match_id, round, p1, p2) VALUES (?, ?, ?, ?)', [m.id, 'semifinal-1', players[0].user_id, players[1].user_id]);
          await run('INSERT INTO games (match_id, round, p1, p2) VALUES (?, ?, ?, ?)', [m.id, 'semifinal-2', players[2].user_id, players[3].user_id]);
          for (const p of players) {
            await run('UPDATE users SET battles = battles + 1 WHERE id = ?', [p.user_id]);
            await notify(p.user_id, `🔔 DING DING DING! Match #${m.id} is LIVE. Fight your semifinal and report the winner!`, 'live');
          }
        } else {
          await run(`UPDATE matches SET status = 'cancelled' WHERE id = ?`, [m.id]);
          for (const p of players) {
            await run('INSERT OR IGNORE INTO queue (user_id) VALUES (?)', [p.user_id]);
            await notify(p.user_id, `😤 Match #${m.id} was cancelled (not enough fighters readied up). You're back at the front of the queue.`, 'warn');
          }
          await tryCreateMatch();
        }
      }
    }
  } catch (e) {
    console.error('tick error', e);
  }
}

// After a winner is reported: create the final when both semis are done, close out the match when the final is done
async function advanceBracket(matchId) {
  const games = await all('SELECT * FROM games WHERE match_id = ?', [matchId]);
  const semi1 = games.find((g) => g.round === 'semifinal-1');
  const semi2 = games.find((g) => g.round === 'semifinal-2');
  const final = games.find((g) => g.round === 'final');

  if (semi1 && semi2 && semi1.winner && semi2.winner && !final) {
    await run('INSERT INTO games (match_id, round, p1, p2) VALUES (?, ?, ?, ?)', [matchId, 'final', semi1.winner, semi2.winner]);
    for (const id of [semi1.winner, semi2.winner]) {
      await notify(id, `🏆 You won your semifinal! The FINAL is up — go claim the belt!`, 'live');
    }
  }

  if (final && final.winner) {
    await run(`UPDATE matches SET status = 'complete' WHERE id = ?`, [matchId]);
    await run('UPDATE users SET wins = wins + 1 WHERE id = ?', [final.winner]);
    const champ = await get('SELECT username FROM users WHERE id = ?', [final.winner]);
    const players = await all('SELECT user_id FROM match_players WHERE match_id = ?', [matchId]);
    for (const p of players) {
      await notify(p.user_id, `🏆 ${champ.username} is the CHAMPION of match #${matchId}!`, 'result');
    }
  }
}

setInterval(tick, 15 * 1000);

app.listen(PORT, () => {
  console.log(`🥊 Battle Arena running on http://localhost:${PORT}`);
  console.log(`   Matches scheduled ${MATCH_DELAY_MIN} min out, ready-up cutoff ${CONFIRM_CUTOFF_MIN} min before start`);
});
