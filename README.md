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
cd ~/repos/st-tow/server && npm run typecheck
cd ~/repos/st-tow/server && npm run test
cd ~/repos/st-tow/web && npm run typecheck
cd ~/repos/st-tow/web && npm run test
cd ~/repos/st-tow/web && npm run build
```

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
