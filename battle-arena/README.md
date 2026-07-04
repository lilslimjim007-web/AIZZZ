# 🥊 Battle Arena

A check-in and matchmaking app to get your team active online. Fighters check in for the day, ready up, and the app automatically builds **4-player elimination tournaments** (two semifinals + a final), schedules them **30 minutes out**, and alerts everyone to ready up before the bell.

## How it works (player flow)

1. **Sign in** — Google, Apple, or Quick Join (just a name)
2. **Pick a fighter name** (username)
3. **Check in** — you're on today's fight card
4. **Ready Up** — you enter the 4-slot ready queue
5. When **4 fighters are ready**, a match is created **30 minutes out** and everyone gets alerted:
   > 🥊 MATCH FOUND! Your match starts in 30 minutes. Ready up at least 5 minutes before or you'll lose your spot!
6. **Confirm your spot** before the 5-minute cutoff. No-shows are dropped and their spot is backfilled from the queue. If the match can't fill, remaining fighters go back to the front of the queue.
7. At start time the bracket goes **LIVE**: Semifinal 1, Semifinal 2, then the Final. Players report winners, and the champion goes on the 🏆 Champions Board.

Everything (who's checked in, who's ready, matches, results, wins) is stored in a SQLite database — that's your record of who's battling and who's not.

## Run it

```bash
cd battle-arena
npm install
cp .env.example .env
npm start
```

Open http://localhost:5001 — that's the whole app (the server also serves the frontend).

### Fast testing mode

Waiting 30 minutes to test is painful, so:

```bash
npm run dev
```

runs with 2-minute matches and a 1-minute ready-up cutoff. Open 4 browser tabs, Quick Join with 4 different names, check in and ready up in each — you'll see the full flow in a couple of minutes.

## Setting up Google Sign-In (real)

1. Go to https://console.cloud.google.com/apis/credentials
2. Create an **OAuth Client ID** → type **Web application**
3. Add your app's URL (e.g. `http://localhost:5001` and your deployed URL) to **Authorized JavaScript origins**
4. Put the client ID in `.env` as `GOOGLE_CLIENT_ID=...` and restart

The real "Sign in with Google" button appears automatically once the ID is set.

## Apple Sign-In

Apple requires a paid Apple Developer account and a Services ID. The button is in place; the backend endpoint (`/api/auth/apple`) currently returns a friendly "not configured" message. Until then players can use Google or Quick Join.

## Config (.env)

| Variable | Default | What it does |
|---|---|---|
| `PORT` | 5001 | Server port |
| `MATCH_DELAY_MINUTES` | 30 | How far out matches are scheduled |
| `CONFIRM_CUTOFF_MINUTES` | 5 | Ready-up deadline before start |
| `GOOGLE_CLIENT_ID` | (empty) | Enables real Google Sign-In |

## API quick reference

- `POST /api/auth/google` / `POST /api/auth/apple` / `POST /api/auth/guest` — sign in
- `POST /api/username` — set fighter name
- `POST /api/checkin` — check in for today
- `POST /api/ready` / `POST /api/unready` — join/leave the queue
- `POST /api/match/:id/confirm` — ready up for your scheduled match
- `POST /api/game/:id/winner` — report a game winner
- `GET /api/state` — everything the app shows (polled every 5s)

## Notifications

Players get in-app alerts (toasts) plus **browser notifications** when the tab is in the background (they'll be asked for permission on first check-in). For SMS/push to phones, that would be a follow-up feature (e.g. Twilio or a PWA with web push).
