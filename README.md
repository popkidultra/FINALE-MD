# FINALE-MD

A WhatsApp multi-device bot rebuilt on the latest stable `@whiskeysockets/baileys` (v6.17.16),
with a signal-key cache to cut down on the disk/decrypt overhead that causes older bots to lag.

## What changed from the old version

- Bumped `@whiskeysockets/baileys` to the latest **stable** line (6.17.16). Note: Baileys also
  publishes a `7.0.0-rc*` line with breaking API changes — this project intentionally stays on
  the stable line so your existing plugin patterns keep working. See `Migrating to Baileys 7`
  below if you want to move to it later.
- Added `makeCacheableSignalKeyStore` so signal keys are cached in memory instead of hit on disk
  for every message — this is the biggest single fix for the "bot gets slower over time" problem.
- Reconnect logic now backs off (3s, 6s, 9s... capped at 30s) instead of hammering WhatsApp every
  5 seconds, and correctly stops retrying on `loggedOut`.
- Replaced the ad-hoc SQLite/JSON mix with a single dependency-free JSON store
  (`data/db.js`) — no native modules to compile, which was a recurring deploy failure.
- Split the giant `index.js` into `lib/serialize.js` (message helpers), `lib/antidelete.js`,
  `lib/groupevents.js`, and a real `command.js` registry so plugins are self-contained files.
- Command handler now enforces `ownerOnly` / `groupOnly` / `adminOnly` centrally instead of each
  plugin checking manually.
- Session loading no longer depends on MEGA at all. `SESSION_ID` is now a
  self-contained `POPKID~<base64 payload>` string — decoded and written straight
  to `sessions/creds.json` with no external network call. Legacy `F~`, `SILA-MD~`,
  and `NEXUS___` prefixed strings still work (see `lib/sessionLoader.js`).

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set SESSION_ID (or leave blank to scan a QR code), OWNER_NUMBER, PREFIX, etc.
npm start
```

If `SESSION_ID` is blank and no `sessions/creds.json` exists yet, a QR code prints in the
terminal — scan it with WhatsApp > Linked Devices.

## Project structure

```
FINALE-MD/
├── index.js              # connection, event wiring, command dispatch
├── config.js              # loads .env into one object
├── command.js              # cmd() registry used by all plugins
├── lib/
│   ├── serialize.js        # sms() message wrapper (reply/react/download helpers)
│   ├── functions.js         # getBuffer, runtime, sleep, etc.
│   ├── antidelete.js        # detects + resends revoked messages
│   └── groupevents.js       # welcome/goodbye/promote/demote messages
├── data/
│   ├── db.js                 # JSON read/write helper
│   └── index.js               # antidelete settings, message cache, contacts, group cache
├── plugins/                 # one file per feature — drop new ones in and restart
│   ├── ping.js
│   ├── alive.js
│   ├── menu.js
│   ├── owner.js
│   └── groupmanage.js
└── sessions/                # creds.json lives here (gitignored)
```

## Writing a new plugin

```js
// plugins/hello.js
const { cmd } = require('../command')

cmd({
  pattern: 'hello',
  desc: 'Say hi',
  category: 'general'
}, async (conn, mek, m, { reply }) => {
  await reply('Hey there 👋')
})
```

Drop the file in `plugins/` and restart the bot — it's auto-loaded.

## Deploying

- **Render / Katabump**: push this repo, set the env vars from `.env.example` in the dashboard,
  build command `npm install`, start command `npm start`. The included `Procfile` also works for
  Heroku-style platforms.
- Keep `sessions/` and `data/store/` on persistent storage (a volume) if your host wipes the
  filesystem between deploys — otherwise you'll need to re-scan the QR code every time.

## Migrating to Baileys 7 (optional, breaking)

Baileys 7 (`7.0.0-rc*`) introduced breaking changes to auth state and some socket methods — see
https://whiskey.so/migrate-latest for the official migration notes before switching
`package.json` to that version, since it will require updating the plugins in this project.
