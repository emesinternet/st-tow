# AGENTS.md

Operational guide for contributors working in `st-tow`.

## Purpose

This repository contains a SpacetimeDB 2.0 realtime typing tug-of-war game:

- `server/`: authoritative game runtime (schema + reducers + tick loop)
- `web/`: realtime React client (Vite + Tailwind + neo-brutalist component system)

Product-facing name in UI: `Typing Fever!`.

## Architecture

### System Boundaries

- `server/` is the source of truth for lobby/match/gameplay state.
- `web/` is a projection + input layer subscribed to database tables.
- SpacetimeDB is used directly from the browser (no REST middle layer).
- WebRTC media is peer-to-peer; SpacetimeDB rows are signaling-only.

### Server Layering

- `server/src/index.ts`: schema, reducers, scheduling, game loop, tie-break flow.
- `server/src/core/*`: constants and helpers (IDs, join codes, time math, setting parsing).
- `server/src/games/tug_of_war/*`: tug-specific content (word catalog + selection logic).

### Data Model

Core/shared tables:

- `lobby`
- `lobby_settings`
- `player`
- `match`
- `match_clock`
- `game_event`
- `schedule` (private scheduled-tick backing table)

Tug-specific tables:

- `tug_state`
- `tug_player_state`
- `tug_host_state`
- `tug_camera_state`
- `tug_webrtc_signal`
- `tug_rps_state`
- `tug_rps_vote`

Design rule:

- Match state is keyed by `match_id`, not `lobby_id`, so rematches stay isolated.

### Reducer Topology

Core reducers:

- `create_lobby`
- `join_lobby`
- `leave_lobby`
- `set_lobby_setting`
- `start_match`
- `end_match`
- `close_post_game`
- `reset_lobby`

Tug reducers:

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

Integration seam:

- `start_match` creates match + clock rows, enters `PreGame` (3s), initializes tug state, and schedules ticks.

### Tick and State Machine

Lobby statuses:

- `Waiting`
- `Running`
- `SuddenDeath`
- `Finished`

Match phases:

- `PreGame`
- `InGame`
- `SuddenDeath`
- `TieBreakRps`
- `PostGame`

Flow:

- `create_lobby` -> `Waiting`
- `start_match` -> `PreGame` (3s countdown)
- countdown expiry -> `InGame`
- timer expiry -> `SuddenDeath`
- terminal check:
  - rope outside tie zone -> finish to `PostGame`
  - rope inside tie zone -> `TieBreakRps` voting/reveal rounds until resolved
- host `tug_rps_continue` -> `PostGame`
- host `close_post_game` -> 10s close countdown and players return to landing
- idle safeguard: post-game auto close after 5 minutes with no host action
- `reset_lobby` -> `Waiting`

### Current Tug Rules (Important)

- Every active player has their own assigned `current_word` in `tug_player_state`.
- Player words advance only on correct completion.
- In sudden death:
  - wrong submit eliminates player immediately
  - deadline timeout eliminates player
- Lock lobby option (`lock_in_progress_join`) blocks new/rejoining-left players once match start is clicked (includes `PreGame`).
- Tie zone width is configurable before lobby creation: `10%`, `20%`, `30%`, `40%`.
- If tie-break voting resolves to no valid team choice, random RPS choices are assigned for both teams to force resolution.

Host-specific:

- Host has independent state in `tug_host_state`.
- Host correct submits increase host score/power meter only.
- Host cannot be eliminated and does not directly add rope force.
- Host powers (server-authoritative) can change mode/difficulty windows.

### Web Client Structure

Main entry and shell:

- `web/src/main.tsx`
- `web/src/App.tsx`

Data/connection layer:

- `web/src/data/useSpacetimeSession.ts`: connection bootstrap + subscriptions + snapshot updates
- `web/src/data/actions.ts`: typed reducer wrappers
- `web/src/data/selectors.ts`: normalization boundary (camel/snake + identity/timestamp normalization)
- `web/src/lib/selectors.ts`: derived role/phase/view models
- `web/src/lib/useHostWebcamMesh.ts`: host webcam capture + viewer peer mesh signaling runtime

UI domains:

- `web/src/components/layout/*`
- `web/src/components/lobby/*`
- `web/src/components/match/*`
- `web/src/components/host/*`
- `web/src/components/player/*`
- `web/src/components/shared/*`
- `web/src/components/shared/ui/*`

Generated bindings:

- `web/src/module_bindings/*` are generated artifacts.

### Frontend UX Model (Current)

- Header shows product title, music track selector + mute, `Reset Session`, and `Online/Offline` badge.
- Clicking the lobby code badge copies it to clipboard and shows a toast.
- Landing screen has two cards:
  - `How to Play` + `Join a Match`
  - `Host a Match` (`Name`, match minutes, lock lobby toggle, tie zone size)
- Match area:
  - large timer
  - left/right pull counters in tug area corners
  - tie-zone dancefloor visuals in the center
  - dragon overlay marker
  - player balls/names in outer 25% lanes with bounce/cheer effects on correct words
  - host power bar below tug area
- Center typing panel is hidden for host during active match phases.
- Host controls are in a dedicated panel below typing (start/end toggle, reset lobby, camera toggle).
- Host power ability buttons show only for host in `InGame`/`SuddenDeath`.
- RPS tie-break uses modal flow (voting + reveal) with role-based visibility.
- Post-game modal includes team totals, host successful words, per-player table, and host/player-specific close behavior.
- Event feed/debug panel is not rendered in the main app shell.

## Environment Model (Windows launcher, WSL runtime)

Use this split consistently:

- Windows PowerShell: launch orchestration only
- WSL: runtime commands (`spacetime`, `publish`, `generate`, `vite`, `npm`)

Never run publish/generate through Windows UNC working directories.

## Canonical Local Run Sequence

### 1) Launch from Windows

```powershell
cd C:\Users\emesi\Desktop\scripts
.\launch-local-windows.ps1
```

This launches 3 windows:

- `st-tow: server`
- `st-tow: publish+generate`
- `st-tow: web`

### 2) Optional helper modes

```powershell
cd C:\Users\emesi\Desktop\scripts
.\launch-local-windows.ps1 -FirstRunChecks
.\launch-local-windows.ps1 -StopOnly
.\launch-local-windows.ps1 -DatabaseName st-tow-dev-20260228010101
```

### 3) Linux-side scripts used by launcher

- `scripts/local/doctor.sh`
- `scripts/local/start_server.sh`
- `scripts/local/publish_and_generate.sh`
- `scripts/local/start_web.sh`

Notes:

- `start_server.sh` uses `C:/temp/stdb-local/data` by default to avoid lock errors when WSL invokes the Windows Spacetime binary.
- `publish_and_generate.sh` publishes via `--js-path server/dist/bundle.js`.

### 4) Flags and logs for each run

Given DB name `<db>`, launcher writes under:

- `/tmp/sttow/<db>/ready.flag`
- `/tmp/sttow/<db>/fail.flag`
- `/tmp/sttow/<db>/stage.log`
- `/tmp/sttow/<db>/build.log`
- `/tmp/sttow/<db>/publish.log`
- `/tmp/sttow/<db>/generate.log`
- `/tmp/sttow/<db>/web.log`

## Hot Reload Expectations

- `web/` edits: Vite hot reload.
- `server/` edits: not hot-reloaded.

After server changes:

1. rerun publish flow
2. refresh browser

## Build / Check Commands (WSL)

```bash
cd ~/repos/st-tow/server && npm run typecheck
cd ~/repos/st-tow/server && npm run test
cd ~/repos/st-tow/web && npm run typecheck
cd ~/repos/st-tow/web && npm run test
cd ~/repos/st-tow/web && npm run build
```

## Known Failure Modes

### A) `publish failed`

Cause:

- compile/publish error in module
- server not ready
- DB auth mismatch

Fix:

- inspect `/tmp/sttow/<db>/publish.log`
- confirm server window is running on `127.0.0.1:3000`
- republish with a fresh DB name
- if log shows `missing bundle`, ensure `server/dist/bundle.js` exists

### B) `generate failed`

Cause:

- binding generation error after publish

Fix:

- inspect `/tmp/sttow/<db>/generate.log`
- rerun after fixing schema/reducer issues

### C) Web window exits with publish/generate failure

Cause:

- `fail.flag` created by publish step

Fix:

- inspect publish/generate logs for the same DB run

### D) Web disconnected from SpacetimeDB

Cause:

- server stopped
- DB name mismatch

Fix:

- keep server window running
- verify `VITE_SPACETIMEDB_DB_NAME` matches published DB (launcher sets this automatically)

### E) Landing/join screen missing unexpectedly

Cause:

- stale browser auth token auto-rejoins previous identity context

Fix in browser console:

```js
localStorage.removeItem('auth_token');
location.reload();
```

## Repo Conventions

- Keep shared primitives in `server/src/core` and game-specific logic in `server/src/games/<name>`.
- Treat `web/src/module_bindings/*` as generated.
- Keep backend contracts stable unless intentionally versioning schema/reducer signatures.
