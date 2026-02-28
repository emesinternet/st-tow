# st-tow

Realtime SpacetimeDB tug-of-war game with a React web client.

## Repository Layout

- `server/`: SpacetimeDB TypeScript module (schema + reducers)
- `web/`: Vite + React + Tailwind + neo-brutalist UI client
- `plan.md`: product/implementation planning notes
- `AGENTS.md`: contributor runbook and architecture notes

## Current Gameplay Behavior

- Host creates a lobby and shares a join code.
- Players join, are balanced into team A/B, and complete words to add team force.
- Match flow: `Waiting -> PreGame(3s countdown) -> InGame -> SuddenDeath -> PostGame`.
- Words are per-player. Each player gets their own random target stream.
- Words do not rotate on a timer; a new word is assigned only when that player completes the current word.
- In sudden death, active players must complete their word before their deadline.
- If both teams are eliminated on the same tick, the match ends deterministically.
- Host has a separate `tug_host_state` stream:
  - correct host submits increment host score only
  - host does not change rope force
  - host cannot be eliminated

## Current UI Semantics

- Header contains connection/phase/role badges and host start/end/reset controls.
- Match HUD row displays `A pulls | timer | B pulls | host score`.
- Rope position is rendered from normalized tug position.
- `teamAForce` / `teamBForce` are physics force values.
- `teamAPulls` / `teamBPulls` are cumulative correct submissions.
- Event feed is compact and anchored at the bottom of the app shell.

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

## Local Development (Windows launcher + WSL runtime)

This project now uses a WSL-native runtime model:

- Windows PowerShell only orchestrates terminal windows.
- `spacetime`, `publish`, `generate`, and `vite` run inside WSL.
- No UNC working directory execution is used for publish/generate.

### One-time checks

From Windows PowerShell:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
wsl -d Ubuntu -e bash -lc "command -v spacetime && command -v npm && command -v nvm || true"
```

### Daily start command

From Windows PowerShell:

```powershell
cd C:\Users\emesi\Desktop\scripts
.\launch-local-windows.ps1
```

What it launches:

- terminal 1: WSL `spacetime start`
- terminal 2: WSL publish + bindings generate
- terminal 3: WSL web dev server (waits for publish/generate success)

Implementation detail:

- local server uses `C:/temp/stdb-local/data` for lock compatibility with the Windows Spacetime binary invoked from WSL.
- publish uses `--js-path server/dist/bundle.js` to avoid UNC build-context issues.

### Optional launcher commands

```powershell
cd C:\Users\emesi\Desktop\scripts
.\launch-local-windows.ps1 -FirstRunChecks
.\launch-local-windows.ps1 -StopOnly
.\launch-local-windows.ps1 -DatabaseName st-tow-dev-20260228010101
```

### Run artifacts and logs

All run-state files live in WSL:

- `/tmp/sttow/<db>/ready.flag`
- `/tmp/sttow/<db>/fail.flag`
- `/tmp/sttow/<db>/stage.log`
- `/tmp/sttow/<db>/build.log`
- `/tmp/sttow/<db>/publish.log`
- `/tmp/sttow/<db>/generate.log`
- `/tmp/sttow/<db>/web.log`

## Build and Typecheck

WSL:

```bash
cd ~/repos/st-tow/server && npm run typecheck
cd ~/repos/st-tow/server && npm run test
cd ~/repos/st-tow/web && npm run typecheck
cd ~/repos/st-tow/web && npm run test
cd ~/repos/st-tow/web && npm run build
```

## Near-Term Roadmap

- Large centered match-start countdown overlay polish on top of current server-authoritative `PreGame` phase.
- Host score effects on gameplay are intentionally deferred; current host score is display-only.

## Common Issues

- `publish failed` in launcher:
  - open `/tmp/sttow/<db>/publish.log`
  - validate `spacetime` exists in WSL (`command -v spacetime`)
- `publish failed` with `missing bundle`:
  - ensure `/home/tsuda/repos/st-tow/server/dist/bundle.js` exists
- web terminal exits with publish/generate failure:
  - inspect `/tmp/sttow/<db>/publish.log` and `/tmp/sttow/<db>/generate.log`
- web says disconnected:
  - confirm server terminal is still running on `127.0.0.1:3000`
  - confirm web DB env matches published DB name
- auth token confusion (unexpected auto-lobby behavior):

```js
localStorage.removeItem('auth_token');
location.reload();
```
