# st-tow

SpacetimeDB 2.0 Tug-of-War MVP scaffold with modular runtime layout.

## Structure

- `server/`: SpacetimeDB TypeScript module
- `web/`: plain HTML + TypeScript client (Vite)
- `plan.md`: implementation plan and acceptance checklist

## Server reducers implemented

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
- `tug_tick` (manual)
- `tug_tick_scheduled` (schedule table hook)

## Local setup

1. Install dependencies:

```bash
cd server && npm install
cd ../web && npm install
```

2. Generate web bindings (once `spacetime` CLI is available and module is built/published):

```bash
cd web
spacetime generate --lang typescript --out-dir src/module_bindings --module-path ../server
```

3. Run web app:

```bash
cd web
npm run dev
```

## Notes

- `web/src/module_bindings/index.ts` is a temporary stub so the app can boot before generation.
- The current implementation prioritizes Phases 1-3 server flow from `plan.md` with a minimal no-framework client.
