# st-tow

Realtime SpacetimeDB tug-of-war game with a React web client.

## Repository Layout

- `server/`: SpacetimeDB TypeScript module (schema + reducers)
- `web/`: Vite + React + Tailwind + neo-brutalist UI client
- `plan.md`: product/implementation planning notes
- `AGENTS.md`: contributor runbook and architecture notes

## Current Gameplay Behavior

- Host creates a lobby and shares a join code.
- Players join, are balanced into team A/B, and submit words to add team force.
- Match flow: `Waiting -> InGame -> SuddenDeath -> PostGame`.
- The tug word is initialized at match start and **does not rotate on a timer**.
- In sudden death, active players must submit the current word before their deadline.
- If both teams are eliminated at the same tick, the match now ends deterministically (no hang).

## Reducers

Core runtime:

- `create_lobby`
- `join_lobby`
- `leave_lobby`
- `set_lobby_setting`
- `start_match`
- `end_match`
- `reset_lobby`

Tug-of-war:

- `tug_init`
- `tug_submit`
- `tug_tick`
- `tug_tick_scheduled`

## Local Development (Windows CLI + WSL code workflow)

This project currently assumes:

- `spacetime` CLI is run from **Windows PowerShell**
- Node/Vite/dev commands are run from **WSL terminal in VSCode**

### 1) Start local SpacetimeDB (PowerShell)

```powershell
taskkill /F /IM spacetimedb-standalone.exe 2>$null
taskkill /F /IM spacetimedb-cli.exe 2>$null
New-Item -ItemType Directory -Force C:\temp\stdb-local\data | Out-Null
spacetime start --data-dir "C:/temp/stdb-local/data" --listen-addr 127.0.0.1:3000 --in-memory --non-interactive
```

### 2) Publish module (PowerShell)

```powershell
cd \\wsl.localhost\Ubuntu\home\tsuda\repos\st-tow\server
spacetime publish st-tow-dev --server local -p . -y --anonymous
```

### 3) (Optional) Regenerate web bindings after schema/reducer signature changes (WSL)

```bash
cd ~/repos/st-tow/web
spacetime generate --lang typescript --out-dir src/module_bindings --module-path "$(wslpath -w ~/repos/st-tow/server)"
```

### 4) Run web app (WSL)

```bash
cd ~/repos/st-tow/web
VITE_SPACETIMEDB_DB_NAME=st-tow-dev VITE_SPACETIMEDB_HOST=ws://127.0.0.1:3000 npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`.

## Build and Typecheck

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

## Common Issues

- `403 not authorized`: publish to a fresh DB name or keep identity mode consistent.
- `No connection could be made ... 127.0.0.1:3000`: local SpacetimeDB is not running.
- DB mismatch (`st-tow` vs `st-tow-dev`): launch web with `VITE_SPACETIMEDB_DB_NAME` matching publish target.
- Old session token causing confusing auto-lobby behavior:

```js
localStorage.removeItem('auth_token');
location.reload();
```
