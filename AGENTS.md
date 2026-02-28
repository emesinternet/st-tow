# AGENTS.md

Operational guide for contributors working in this repository (`st-tow`).

## Purpose

This repo contains a SpacetimeDB 2.0 tug-of-war MVP with:

- `server/`: SpacetimeDB TypeScript module (schema + reducers)
- `web/`: Vite + TypeScript browser client

This document defines a **known-good local workflow** for mixed Windows + WSL usage.

## Application Architecture

### System Boundaries

- `server/` is the authoritative runtime.
- `web/` is a realtime projection and input client.
- There is no separate REST/backend service layer between browser and SpacetimeDB.

### Server-Side Layers

- Schema + reducers are centralized in `server/src/index.ts`.
- `server/src/core/*` contains reusable runtime concepts:
  - lobby lifecycle constants/enums
  - ID/code/time helpers
  - reusable key builders (`settingId`, `scheduleId`, etc.)
- `server/src/games/tug_of_war/*` contains tug-specific domain assets and logic helpers.

### Data Model Partitioning

Core/shared tables (cross-game runtime contract):

- `lobby`
- `lobby_settings`
- `player`
- `match`
- `match_clock`
- `game_event`
- `schedule` (private scheduled table backing tick execution)

Tug-specific tables:

- `tug_state` (single row per match)
- `tug_player_state` (per-player per-match state)

Design rule:

- All game state is keyed by `match_id` (not `lobby_id`) so rematches/history are possible without mutating previous match state.

### Reducer Topology

Core reducers:

- `create_lobby`
- `join_lobby`
- `leave_lobby`
- `set_lobby_setting`
- `start_match`
- `end_match`
- `reset_lobby`

Game reducers:

- `tug_init`
- `tug_submit`
- `tug_tick` (manual trigger)
- `tug_tick_scheduled` (called by scheduled table entries)

Key rule:

- `start_match` is the integration seam. It creates match/clock state, then dispatches to game init by `lobby.game_type`.

### Tick/Scheduling Architecture

- SpacetimeDB scheduled tables require:
  - `scheduled_id: u64`
  - `scheduled_at: ScheduledAt`
- `schedule` rows are used as durable scheduling records.
- The tick loop is pull-based per schedule entry:
  - schedule row invokes `tug_tick_scheduled`
  - reducer verifies `active`/`kind`
  - reducer runs core tick logic (`runTugTick`)
  - match end states deactivate/remove schedule rows

### Match Phase State Machine

Lobby statuses:

- `Waiting`
- `Running`
- `SuddenDeath`
- `Finished`

Match phases:

- `PreGame`
- `InGame`
- `SuddenDeath`
- `PostGame`

Transition summary:

- `create_lobby` -> `Waiting`
- `start_match` -> `InGame` + clock + tug init + tick schedule
- timer expiry in tick -> `SuddenDeath` + elimination deadlines
- win/last-team-standing -> `PostGame` + lobby `Finished`
- `reset_lobby` returns lobby to `Waiting`

### Web Client Architecture

- `web/src/app.ts` is a no-framework controller:
  - connection bootstrap
  - subscriptions
  - reducer invocations
  - UI derivation/render
- `web/src/ui/games/tug_of_war.ts` is a pure render helper for game panel HTML.
- `web/src/module_bindings/*` are generated typed bindings and must be treated as generated artifacts.

Client render model:

- subscribe to shared + tug tables
- build derived view model from cached rows
- render sections:
  - landing/join
  - lobby team lists + host controls
  - match HUD + rope + word submit
  - event feed

### Naming/Binding Contract

- Server schema field names are snake_case.
- Generated TypeScript row/reducer bindings expose camelCase accessors/args in many contexts.
- Client code currently uses a compatibility helper (`field(...)`) to read either style and avoid brittle runtime mismatches.

### Eventing and Observability

- `game_event` is used for operational trace and UI feed.
- Emit events for:
  - lobby creation
  - join/reconnect/leave
  - settings changes
  - match start/end
  - tug init/submission/elimination/sudden death transition

### Extending to New Games

To add a game module cleanly:

1. Add `server/src/games/<name>/`.
2. Add `<name>_state` and `<name>_player_state` keyed by `match_id`.
3. Add `<name>_init`, `<name>_action`, optional `<name>_tick`.
4. Add dispatch branch in `start_match` game init integration seam.
5. Add web panel under `web/src/ui/games/<name>.ts` and switch by `lobby.game_type`.

## Environment Model (Important)

In the current setup, `spacetime` is installed in **Windows**, not native Linux WSL.
Because of lock/path/identity issues, commands should be split like this:

- **PowerShell**: all `spacetime ...` commands
- **WSL terminal (VSCode)**: `npm`, `vite`, and general code editing commands

Do not mix unless you intentionally know why.

## Canonical Local Run Sequence

### 1) Start local SpacetimeDB (PowerShell, terminal #1)

```powershell
taskkill /F /IM spacetimedb-standalone.exe 2>$null
taskkill /F /IM spacetimedb-cli.exe 2>$null
New-Item -ItemType Directory -Force C:\temp\stdb-local\data | Out-Null
spacetime start --data-dir "C:/temp/stdb-local/data" --listen-addr 127.0.0.1:3000 --in-memory --non-interactive
```

Keep this terminal open.

### 2) Publish module (PowerShell, terminal #2)

```powershell
cd \\wsl.localhost\Ubuntu\home\tsuda\repos\st-tow\server
spacetime publish st-tow-dev --server local -p . -y --anonymous
```

### 3) Generate client bindings (WSL)

```bash
cd ~/repos/st-tow/web
spacetime generate --lang typescript --out-dir src/module_bindings --module-path "$(wslpath -w ~/repos/st-tow/server)"
```

### 4) Run web dev server (WSL)

```bash
cd ~/repos/st-tow/web
VITE_SPACETIMEDB_DB_NAME=st-tow-dev VITE_SPACETIMEDB_HOST=ws://127.0.0.1:3000 npm run dev -- --host 127.0.0.1 --port 5173
```

Open: `http://127.0.0.1:5173/`

### 5) Reset stale browser token (if needed)

In browser console:

```js
localStorage.removeItem('auth_token')
location.reload()
```

## Hot Reload Expectations

- `web/` edits: hot reload via Vite.
- `server/` edits: **not** hot-reloaded automatically.
  After server changes:
  1. republish module (PowerShell)
  2. regenerate bindings if schema/reducer signatures changed (WSL)

## Known Failure Modes and Fixes

### A) `403 ... not authorized to update database`

Cause: database name already exists under a different local identity.

Fix:

- publish to a fresh name (recommended, e.g. `st-tow-dev`)
- keep using same publish mode (`--anonymous`) consistently

### B) `error while taking database lock on spacetime.pid` / `os error 1` / `os error 33`

Cause: Windows-side lock contention (multiple `spacetime` processes / WSL invoking Windows binary unpredictably).

Fix:

```powershell
taskkill /F /IM spacetimedb-standalone.exe 2>$null
taskkill /F /IM spacetimedb-cli.exe 2>$null
```

Then restart using the canonical run sequence above.

### C) `No connection could be made ... 127.0.0.1:3000`

Cause: local server not running.

Fix: start step (1) again in PowerShell.

### D) WebSocket attempts `/database/st-tow/...` while module published as `st-tow-dev`

Cause: DB name mismatch.

Fix: launch Vite with:

```bash
VITE_SPACETIMEDB_DB_NAME=st-tow-dev
```

### E) `Could not detect the language of the module`

Cause: running `spacetime publish` from wrong directory.

Fix: run from `server/` (`-p .`) or pass correct module path.

## Build / Check Commands

### WSL

```bash
cd ~/repos/st-tow/server && npm run typecheck
cd ~/repos/st-tow/web && npm run typecheck
cd ~/repos/st-tow/web && npm run build
```

### PowerShell

```powershell
cd \\wsl.localhost\Ubuntu\home\tsuda\repos\st-tow\server
spacetime build
```

## Repository Conventions

- Keep shared runtime logic under `server/src/core`.
- Keep game-specific logic under `server/src/games/<game_name>`.
- Keep client generic for core tables; switch game UI by `game_type`.
- Prefer adding new reducers/tables modularly instead of special-casing tug logic in core.

## When Adding/Changing Server Schema

Always do this sequence:

1. Edit server schema/reducers.
2. `npm run typecheck` in `server/`.
3. Publish (`spacetime publish ...`).
4. Regenerate bindings in `web/src/module_bindings`.
5. `npm run typecheck` in `web/`.
6. Validate in browser with 2+ tabs.

## Quick Stop Commands

### PowerShell

```powershell
taskkill /F /IM spacetimedb-standalone.exe 2>$null
taskkill /F /IM spacetimedb-cli.exe 2>$null
```

### WSL

```bash
pkill -f "vite --host 127.0.0.1 --port 5173" || true
pkill -f "npm run dev -- --host 127.0.0.1 --port 5173" || true
```

## Notes for Future Improvement

- Install native `spacetime` inside a newer WSL distro (glibc >= 2.32) to avoid cross-OS command split.
- Add scripted tasks (`Makefile` or npm scripts) to run publish + generate + dev with one command.
- Consider introducing `spacetime dev` workflow once environment is fully native.
