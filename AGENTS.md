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
- Words **do not rotate on a timer**.
- A player gets a new random word only after correctly completing their current one.
- In sudden death:
  - wrong submit eliminates player immediately
  - deadline timeout eliminates player
- If both teams reach zero active players in sudden death on the same tick, match now ends (no hang).

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

## Environment Model (Windows + WSL Split)

Use this split consistently:

- **PowerShell**: all `spacetime ...` commands
- **WSL terminal (VSCode)**: `npm`, `vite`, typecheck/build, editing

Avoid running Windows `spacetime` from WSL unless explicitly needed.

## Canonical Local Run Sequence

### 1) Start local SpacetimeDB (PowerShell terminal #1)

```powershell
taskkill /F /IM spacetimedb-standalone.exe 2>$null
taskkill /F /IM spacetimedb-cli.exe 2>$null
New-Item -ItemType Directory -Force C:\temp\stdb-local\data | Out-Null
spacetime start --data-dir "C:/temp/stdb-local/data" --listen-addr 127.0.0.1:3000 --in-memory --non-interactive
```

Keep it running.

### 2) Publish module (PowerShell terminal #2)

```powershell
cd \\wsl.localhost\Ubuntu\home\tsuda\repos\st-tow\server
spacetime publish st-tow-dev --server local -p . -y --anonymous
```

### 3) Regenerate web bindings only when signatures/schema changed (WSL)

```bash
cd ~/repos/st-tow/web
spacetime generate --lang typescript --out-dir src/module_bindings --module-path "$(wslpath -w ~/repos/st-tow/server)"
```

### 4) Run web dev server (WSL)

```bash
cd ~/repos/st-tow/web
VITE_SPACETIMEDB_DB_NAME=st-tow-dev VITE_SPACETIMEDB_HOST=ws://127.0.0.1:3000 npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`.

## Hot Reload Expectations

- `web/` edits: Vite hot reload.
- `server/` edits: not hot-reloaded.

After any server logic change:

1. republish module (PowerShell)
2. regenerate bindings if reducer/table signatures changed (WSL)
3. refresh browser

## Build / Check Commands

WSL:

```bash
cd ~/repos/st-tow/server && npm run typecheck
cd ~/repos/st-tow/web && npm run typecheck
cd ~/repos/st-tow/web && npm run build
```

PowerShell:

```powershell
cd \\wsl.localhost\Ubuntu\home\tsuda\repos\st-tow\server
spacetime build
```

## Known Failure Modes

### A) `403 ... not authorized to update database`

Cause: local DB owned by different identity.

Fix:

- publish to fresh DB name (e.g. `st-tow-dev`)
- keep publish mode consistent (`--anonymous`)

### B) `spacetime.pid` lock errors (`os error 1`/`33`)

Cause: multiple Windows `spacetime` processes.

Fix:

```powershell
taskkill /F /IM spacetimedb-standalone.exe 2>$null
taskkill /F /IM spacetimedb-cli.exe 2>$null
```

Then restart server.

### C) Connection refused on `127.0.0.1:3000`

Cause: local SpacetimeDB not running.

Fix: restart step (1).

### D) Wrong DB name in browser connection

Cause: published DB and web env mismatch.

Fix: run web with matching `VITE_SPACETIMEDB_DB_NAME`.

### E) Landing/join screen missing unexpectedly

Cause: stale browser auth token auto-rejoins previous identity context.

Fix in browser console:

```js
localStorage.removeItem('auth_token');
location.reload();
```

## Repo Conventions

- Keep shared primitives in `server/src/core` and game-specific logic in `server/src/games/<name>`.
- Treat `web/src/module_bindings/*` as generated.
- Keep backend contracts stable unless intentionally versioning schema/reducer signatures.
