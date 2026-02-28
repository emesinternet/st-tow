# AGENTS.md

Operational guide for contributors working in `st-tow`.

## Purpose

This repository contains a SpacetimeDB 2.0 tug-of-war game:

- `server/`: authoritative game runtime (schema + reducers)
- `web/`: realtime React client (Vite + Tailwind + neo-brutalist component system)

## Architecture

### System Boundaries

- `server/` is the source of truth for all game state.
- `web/` is a projection + input layer subscribed to database tables.
- There is no REST API layer between browser and SpacetimeDB.

### Server Layering

- `server/src/index.ts`: schema, reducers, and core game loop/tick logic.
- `server/src/core/*`: constants and helpers (IDs, join codes, time math, setting parsing).
- `server/src/games/tug_of_war/*`: tug-specific assets (word list).

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

Design rule:

- Match state is keyed by `match_id`, not `lobby_id`, so rematches are clean.

### Reducer Topology

Core reducers:

- `create_lobby`
- `join_lobby`
- `leave_lobby`
- `set_lobby_setting`
- `start_match`
- `end_match`
- `reset_lobby`

Tug reducers:

- `tug_init`
- `tug_submit`
- `tug_tick`
- `tug_tick_scheduled`

Integration seam:

- `start_match` creates match + clock rows, initializes game state, and schedules ticks.

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
- `PostGame`

Flow:

- `create_lobby` -> `Waiting`
- `start_match` -> `InGame`
- timer expiry -> `SuddenDeath`
- win condition -> `PostGame` + lobby `Finished`
- `reset_lobby` -> `Waiting`

### Current Tug Rules (Important)

- Every active player has their own assigned `current_word` in `tug_player_state`.
- Words do not rotate on a timer.
- A player gets a new random word only after correctly completing their current one.
- In sudden death:
  - wrong submit eliminates player immediately
  - deadline timeout eliminates player
- If both teams reach zero active players in sudden death on the same tick, match ends (no hang).

### Web Client Structure

Main entry and shell:

- `web/src/main.tsx`
- `web/src/App.tsx`

Data/connection layer:

- `web/src/data/useSpacetimeSession.ts`: connection bootstrap + subscriptions + snapshot updates
- `web/src/data/actions.ts`: typed reducer-call wrappers
- `web/src/data/selectors.ts`: normalization boundary (camel/snake + identity/timestamp normalization)
- `web/src/lib/selectors.ts`: derived role/phase/view models

UI component domains:

- `web/src/components/layout/*`
- `web/src/components/lobby/*`
- `web/src/components/match/*`
- `web/src/components/host/*`
- `web/src/components/player/*`
- `web/src/components/shared/*`
- `web/src/components/shared/ui/*`

Generated bindings:

- `web/src/module_bindings/*` are generated artifacts.

### Frontend UX Model

- Shared responsive shell with role-aware side panel.
- Landing screen for host/create + join by code.
- Host controls for start/end/reset.
- Match HUD with rope/force/word/timer status.
- Sticky-focus player input with progressive fill and auto-submit on completion (no Enter required).
- Event feed from `game_event` telemetry.

## Environment Model (Windows launcher, WSL runtime)

Use this split consistently:

- Windows PowerShell: launch orchestration only
- WSL: all runtime commands (`spacetime`, `publish`, `generate`, `vite`, `npm`)

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
- `publish_and_generate.sh` publishes via `--js-path server/dist/bundle.js` to avoid UNC build-context failures.

### 4) Flags and logs for each run

Given DB name `<db>`, launcher writes under:

- `/tmp/sttow/<db>/ready.flag`
- `/tmp/sttow/<db>/fail.flag`
- `/tmp/sttow/<db>/publish.log`
- `/tmp/sttow/<db>/generate.log`
- `/tmp/sttow/<db>/web.log`

## Hot Reload Expectations

- `web/` edits: Vite hot reload.
- `server/` edits: not hot-reloaded.

After server logic changes:

1. restart launcher or rerun publish flow
2. refresh browser

## Build / Check Commands (WSL)

```bash
cd ~/repos/st-tow/server && npm run typecheck
cd ~/repos/st-tow/web && npm run typecheck
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
- republish with fresh DB name (default timestamp naming already does this)
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

- inspect publish/generate logs for same DB run

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
