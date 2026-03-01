# st-tow

`st-tow` is **Typing Fever!**, a realtime SpacetimeDB typing tug-of-war game.

## Repository Layout

- `server/`: SpacetimeDB TypeScript module (schema, reducers, tick loop)
- `web/`: Vite + React + Tailwind + neo-brutalist UI client
- `AGENTS.md`: contributor runbook and architecture notes
- `plan.md`: planning notes

## Current Gameplay

- Host creates a lobby and shares the join code.
- Players join and are team-balanced (A/B internally, shown as red/blue in UI).
- Match flow:
  - `Waiting -> PreGame(3s) -> InGame -> SuddenDeath -> TieBreakRps(optional) -> PostGame`
- Words are per-player and advance only on correct completion.
- Sudden death elimination is immediate on wrong submit or deadline timeout.
- Tie-zone at match end triggers RPS tie-break modal flow.
- Host has independent typing/power state:
  - host score/power meter increases on host correct words
  - host does not directly add rope force
  - host cannot be eliminated

## Current UX

- Header: title, music selector, mute toggle, `Reset Session`, online status badge.
- Landing: side-by-side `Join a Match` and `Host a Match` cards.
- Host options before lobby creation:
  - match minutes (`1..10`, default `3`)
  - lock lobby after match start
  - tie-zone width (`10/20/30/40%`)
- Match HUD:
  - large centered timer
  - red/blue pull counters in tug area corners
  - center tie-zone dancefloor + dragon overlay
  - player markers and cheer bubbles inside tug area
  - host power bar under tug area
- Host controls in dedicated panel below typing area.
- RPS voting/reveal modal for tie-breaks.
- Post-game modal with team totals, host successful words, and player accuracy table.

## Server Contracts

### Public tables

- `lobby`
- `lobby_settings`
- `player`
- `match`
- `match_clock`
- `game_event`
- `tug_state`
- `tug_player_state`
- `tug_host_state`
- `tug_camera_state`
- `tug_webrtc_signal`
- `tug_rps_state`
- `tug_rps_vote`

(`schedule` is the private scheduled table backing server ticks and timed closes.)

### Reducers

Core:

- `create_lobby`
- `join_lobby`
- `leave_lobby`
- `set_lobby_setting`
- `start_match`
- `end_match`
- `close_post_game`
- `reset_lobby`

Tug:

- `tug_init`
- `tug_submit`
- `tug_record_miss`
- `tug_activate_power`
- `tug_set_camera_enabled`
- `tug_send_webrtc_signal`
- `tug_rps_cast_vote`
- `tug_rps_continue`
- `tug_tick`
- `tug_tick_scheduled`

## Local Development (Windows launcher + WSL runtime)

### Daily start

From Windows PowerShell:

```powershell
cd C:\Users\emesi\Desktop\scripts
.\launch-local-windows.ps1
```

Launcher starts:

1. SpacetimeDB server
2. publish + bindings generation
3. web dev server

### Optional launcher modes

```powershell
cd C:\Users\emesi\Desktop\scripts
.\launch-local-windows.ps1 -FirstRunChecks
.\launch-local-windows.ps1 -StopOnly
.\launch-local-windows.ps1 -DatabaseName st-tow-dev-20260228010101
```

### Run logs

- `/tmp/sttow/<db>/ready.flag`
- `/tmp/sttow/<db>/fail.flag`
- `/tmp/sttow/<db>/stage.log`
- `/tmp/sttow/<db>/build.log`
- `/tmp/sttow/<db>/publish.log`
- `/tmp/sttow/<db>/generate.log`
- `/tmp/sttow/<db>/web.log`

## Checks

```bash
cd ~/repos/st-tow/server && npm run format:check
cd ~/repos/st-tow/server && npm run lint
cd ~/repos/st-tow/server && npm run typecheck
cd ~/repos/st-tow/server && npm run test
cd ~/repos/st-tow/web && npm run format:check
cd ~/repos/st-tow/web && npm run lint
cd ~/repos/st-tow/web && npm run check:module-bindings
cd ~/repos/st-tow/web && npm run typecheck
cd ~/repos/st-tow/web && npm run test
cd ~/repos/st-tow/web && npm run build
```

## Production Deploy (GitHub Pages + Spacetime Maincloud)

This repo includes CI/CD workflows for:

- web deploy: `.github/workflows/deploy-pages.yml`
- server publish: `.github/workflows/publish-spacetime.yml`

### 1) One-time setup (GitHub)

In your GitHub repo:

1. `Settings -> Pages`
2. Source: `GitHub Actions`

Then set repository variables:

1. `Settings -> Secrets and variables -> Actions -> Variables`
2. Add:
   - `VITE_SPACETIMEDB_HOST`
   - `VITE_SPACETIMEDB_DB_NAME`
   - `SPACETIMEDB_DB_NAME`
   - `VITE_BASE_PATH`

Recommended values:

- `VITE_SPACETIMEDB_HOST=https://maincloud.spacetimedb.com`
- `VITE_SPACETIMEDB_DB_NAME=<your-db-name>`
- `SPACETIMEDB_DB_NAME=<your-db-name>`
- `VITE_BASE_PATH=/` for user/org pages or custom domain, `/<repo-name>/` for project pages

Add repository secret:

1. `Settings -> Secrets and variables -> Actions -> Secrets`
2. Add:
   - `SPACETIMEDB_TOKEN=<token from spacetime login>`

### 2) One-time setup (Spacetime token)

Generate a token locally and copy it:

```bash
spacetime login
spacetime login show
```

Use the shown token for the GitHub secret `SPACETIMEDB_TOKEN`.

### 3) Publish server module

Use the GitHub Actions workflow:

1. `Actions -> Publish Server To Spacetime Maincloud`
2. `Run workflow`
3. Optional `db_name` override
4. `delete_data=on-conflict` (recommended default)

### 4) Deploy web

Push to `main` (or run `Deploy Web To GitHub Pages` manually).

The workflow builds `web/` with your repo variables and deploys `web/dist` to Pages.

## Engineering Docs

- `docs/engineering/ui-conventions.md`
- `docs/engineering/accessibility-checklist.md`
- `docs/engineering/realtime-state-model.md`

## Optional Scoped Subscription Mode

Set `VITE_SCOPED_SUBSCRIPTIONS=1` in the web environment to enable scoped client subscriptions.

- Base subscription: `lobby`, `player`, `match`
- Detail subscriptions are scoped to the currently resolved lobby/match
- Reconnect safety remains via full snapshot extraction on applied updates

## Common Issues

- `publish failed`:
  - inspect `/tmp/sttow/<db>/publish.log`
  - verify server is running on `127.0.0.1:3000`
  - verify `server/dist/bundle.js` exists
- `generate failed`:
  - inspect `/tmp/sttow/<db>/generate.log`
- unexpected auto-join behavior from stale auth:

```js
localStorage.removeItem('auth_token');
location.reload();
```
