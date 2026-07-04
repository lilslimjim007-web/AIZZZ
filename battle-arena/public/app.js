// ============ Battle Arena frontend ============
const API = '';
let token = localStorage.getItem('arena_token') || null;
let state = null;
let liveMatchIds = new Set(); // to trigger the VS animation when a match flips to live
let countdownTimers = [];

const $ = (id) => document.getElementById(id);

// ---------- api helper ----------
async function api(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    // session died — back to sign-in
    signOut();
    throw new Error(data.error || 'Signed out');
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ---------- screens ----------
function show(screen) {
  ['screen-login', 'screen-username', 'screen-arena'].forEach((s) =>
    $(s).classList.toggle('hidden', s !== screen)
  );
}

function signOut() {
  token = null;
  localStorage.removeItem('arena_token');
  show('screen-login');
}

// ---------- sign in ----------
async function initGoogle() {
  try {
    const cfg = await api('/api/config');
    if (cfg.googleClientId && window.google?.accounts?.id) {
      google.accounts.id.initialize({
        client_id: cfg.googleClientId,
        callback: async (resp) => {
          try {
            const data = await api('/api/auth/google', 'POST', { credential: resp.credential });
            onSignedIn(data);
          } catch (e) {
            $('login-error').textContent = e.message;
          }
        },
      });
      google.accounts.id.renderButton($('google-btn-slot'), {
        theme: 'filled_black', size: 'large', shape: 'pill', width: 320,
      });
    } else {
      // No Google client ID configured yet — show a button that explains it
      $('btn-google-demo').classList.remove('hidden');
      $('btn-google-demo').onclick = () => {
        $('login-error').textContent =
          'Google Sign-In needs a Google Client ID set on the server (see README). Use Quick Join for now!';
      };
    }
  } catch {
    $('btn-google-demo').classList.remove('hidden');
  }
}

$('btn-apple').onclick = async () => {
  try {
    await api('/api/auth/apple', 'POST', {});
  } catch (e) {
    $('login-error').textContent = e.message;
  }
};

$('btn-guest').onclick = async () => {
  try {
    const name = $('guest-name').value.trim();
    const data = await api('/api/auth/guest', 'POST', { name });
    onSignedIn(data);
  } catch (e) {
    $('login-error').textContent = e.message;
  }
};
$('guest-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-guest').click(); });

function onSignedIn(data) {
  token = data.token;
  localStorage.setItem('arena_token', token);
  if (!data.user.username) {
    show('screen-username');
  } else {
    enterArena();
  }
}

$('btn-username').onclick = async () => {
  try {
    await api('/api/username', 'POST', { username: $('username-input').value.trim() });
    enterArena();
  } catch (e) {
    $('username-error').textContent = e.message;
  }
};
$('username-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-username').click(); });

$('btn-logout').onclick = signOut;

// ---------- arena actions ----------
$('btn-checkin').onclick = () => act('/api/checkin');
$('btn-ready').onclick = () => act('/api/ready');
$('btn-unready').onclick = () => act('/api/unready');

async function act(path) {
  try {
    await api(path, 'POST', {});
    await refresh();
  } catch (e) {
    toast(e.message, 'warn');
  }
}

async function confirmMatch(id) {
  try {
    await api('/api/match/' + id + '/confirm', 'POST', {});
    toast("🥊 You're locked in! See you in the ring.", 'match');
    await refresh();
  } catch (e) {
    toast(e.message, 'warn');
  }
}

async function reportWinner(gameId, winnerId) {
  try {
    await api('/api/game/' + gameId + '/winner', 'POST', { winner: winnerId });
    await refresh();
  } catch (e) {
    toast(e.message, 'warn');
  }
}

// ---------- main loop ----------
function enterArena() {
  show('screen-arena');
  refresh();
  if (Notification && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

async function refresh() {
  try {
    state = await api('/api/state');
  } catch {
    return;
  }
  render();
  state.notifications.forEach((n) => {
    toast(n.message, n.kind);
    browserNotify(n.message);
  });
}

setInterval(() => {
  if (token && !$('screen-arena').classList.contains('hidden')) refresh();
}, 5000);

// ---------- rendering ----------
function render() {
  const { me, checkedIn, inQueue, checkins, queue, matches, leaderboard, config } = state;

  $('me-name').textContent = me.username || '';
  $('me-record').textContent = `${me.wins}W / ${me.battles} battles`;

  // my active match (scheduled or live)
  const myMatch = matches.find((m) => m.mine && (m.status === 'scheduled' || m.status === 'live'));

  // status buttons
  $('btn-checkin').classList.toggle('hidden', checkedIn);
  $('btn-ready').classList.toggle('hidden', !checkedIn || inQueue || !!myMatch);
  $('btn-unready').classList.toggle('hidden', !inQueue);
  $('queue-status').classList.toggle('hidden', !inQueue);
  if (inQueue) $('queue-need').textContent = Math.max(0, 4 - queue.length);

  // checked-in list
  $('checkin-count').textContent = checkins.length;
  $('checkin-list').innerHTML = checkins.length
    ? checkins.map((c) =>
        `<li><span class="dot ${c.ready ? 'ready' : ''}"></span>${esc(c.username)}${c.ready ? '<span class="tag-ready">READY</span>' : ''}</li>`
      ).join('')
    : '<p class="empty-note">Nobody checked in yet — be the first! 🥊</p>';

  // queue slots (4)
  let slots = '';
  for (let i = 0; i < 4; i++) {
    const q = queue[i];
    slots += q
      ? `<div class="q-slot filled"><span class="q-glove">🥊</span>${esc(q.username)}</div>`
      : `<div class="q-slot">waiting…</div>`;
  }
  $('queue-slots').innerHTML = slots;
  $('queue-count').textContent = `${queue.length}/4`;

  // my match card
  $('card-match').classList.toggle('hidden', !myMatch);
  if (myMatch) $('match-area').innerHTML = renderMatch(myMatch, true, config);

  // all matches
  const others = matches.filter((m) => !myMatch || m.id !== myMatch.id);
  $('matches-list').innerHTML = matches.length
    ? matches.map((m) => renderMatch(m, false, config)).join('')
    : '<p class="empty-note">No matches yet today. Ready up to start one!</p>';

  // leaderboard
  $('leaderboard').innerHTML = leaderboard.length
    ? leaderboard.map((u, i) =>
        `<li><span class="rank">${i + 1}</span>${i === 0 ? '👑 ' : ''}${esc(u.username)}<span class="lb-wins">${u.wins} 🏆 · ${u.battles} battles</span></li>`
      ).join('')
    : '<p class="empty-note">No champions yet. The belt is up for grabs!</p>';

  // VS animation when one of my matches goes live
  matches.forEach((m) => {
    if (m.status === 'live' && m.mine && !liveMatchIds.has(m.id)) {
      liveMatchIds.add(m.id);
      playVS();
    }
  });

  startCountdowns(config);
}

function renderMatch(m, isMine, config) {
  const me = state.me;
  const nameOf = (id) => {
    const p = m.players.find((p) => p.id === id);
    return p ? p.username : '?';
  };

  let body = '';

  if (m.status === 'scheduled') {
    const myEntry = m.players.find((p) => p.id === me.id);
    body += `<div class="countdown" data-start="${m.scheduled_at}">--:--</div>
      <div class="cutoff-note">Ready up at least ${config.confirmCutoffMin} min before start or you lose your spot!</div>
      <div class="match-players">
        ${m.players.map((p) =>
          `<span class="chip">${esc(p.username)} ${p.confirmed ? '<span class="ok">✔ ready</span>' : '<span class="waitc">…waiting</span>'}</span>`
        ).join('')}
      </div>`;
    if (myEntry && !myEntry.confirmed) {
      body += `<button class="btn btn-confirm" onclick="confirmMatch(${m.id})">🥊 READY UP — CONFIRM MY SPOT</button>`;
    }
  }

  if (m.status === 'live' || m.status === 'complete') {
    const rows = m.games.map((g) => {
      const canReport = m.mine && !g.winner && g.p1 && g.p2;
      const cls = (id) => (g.winner ? (g.winner === id ? 'winner' : 'loser') : '');
      return `<div class="game-row">
        <span class="round-label">${g.round.replace('-', ' ')}</span>
        <span class="fighter-name ${cls(g.p1)}">${esc(nameOf(g.p1))}</span>
        <span class="vs-small">VS</span>
        <span class="fighter-name ${cls(g.p2)}">${esc(nameOf(g.p2))}</span>
        ${canReport
          ? `<span style="margin-left:auto;display:flex;gap:6px;">
               <button class="btn btn-report" onclick="reportWinner(${g.id}, ${g.p1})">${esc(nameOf(g.p1))} won</button>
               <button class="btn btn-report" onclick="reportWinner(${g.id}, ${g.p2})">${esc(nameOf(g.p2))} won</button>
             </span>`
          : g.winner ? `<span style="margin-left:auto;">🏆 ${esc(nameOf(g.winner))}</span>` : ''}
      </div>`;
    }).join('');
    body += `<div class="bracket">${rows}</div>`;
    const final = m.games.find((g) => g.round === 'final');
    if (m.status === 'complete' && final?.winner) {
      body += `<div class="champ-line">👑 CHAMPION: ${esc(nameOf(final.winner))}</div>`;
    }
  }

  if (m.status === 'cancelled') {
    body += `<p class="empty-note">Cancelled — not enough fighters readied up.</p>`;
  }

  return `<div class="match-box ${m.mine ? 'mine' : ''}">
    <div class="match-head">
      <span class="match-id">Match #${m.id}${m.mine ? ' — YOUR FIGHT' : ''}</span>
      <span class="badge ${m.status}">${m.status.toUpperCase()}</span>
    </div>
    ${body}
  </div>`;
}

// live countdowns on scheduled matches
function startCountdowns() {
  countdownTimers.forEach(clearInterval);
  countdownTimers = [];
  document.querySelectorAll('.countdown[data-start]').forEach((el) => {
    const startMs = new Date(el.dataset.start).getTime();
    const update = () => {
      const diff = startMs - Date.now();
      if (diff <= 0) { el.textContent = 'STARTING…'; return; }
      const mm = Math.floor(diff / 60000);
      const ss = Math.floor((diff % 60000) / 1000);
      el.textContent = `Starts in ${mm}:${String(ss).padStart(2, '0')}`;
      el.classList.toggle('urgent', diff < (state?.config?.confirmCutoffMin || 5) * 60000 + 60000);
    };
    update();
    countdownTimers.push(setInterval(update, 1000));
  });
}

// ---------- notifications ----------
function toast(message, kind = 'info') {
  const el = document.createElement('div');
  el.className = 'notif ' + kind;
  el.textContent = message;
  $('notif-stack').appendChild(el);
  setTimeout(() => el.remove(), 8000);
}

function browserNotify(message) {
  if (window.Notification && Notification.permission === 'granted' && document.hidden) {
    new Notification('🥊 Battle Arena', { body: message });
  }
}

function playVS() {
  const o = $('vs-overlay');
  o.classList.remove('hidden');
  setTimeout(() => o.classList.add('hidden'), 2200);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// expose for inline onclick handlers
window.confirmMatch = confirmMatch;
window.reportWinner = reportWinner;

// ---------- boot ----------
(async function boot() {
  initGoogle();
  if (token) {
    try {
      state = await api('/api/state');
      if (!state.me.username) show('screen-username');
      else { show('screen-arena'); render(); }
    } catch {
      show('screen-login');
    }
  } else {
    show('screen-login');
  }
})();
