# Realtime State Model

## Source of Truth

- Server (`server/`) is authoritative for all gameplay and lifecycle state.
- Web client (`web/`) renders projections from subscribed tables.

## Client Data Pipeline

1. `useSpacetimeSession` subscribes to SpacetimeDB and captures snapshots.
2. `web/src/data/selectors.ts` normalizes raw rows into typed entities.
3. `web/src/lib/selectors.ts` derives role/phase/view-models used by components.

## Subscription Strategy

- Default mode: full table subscriptions for compatibility.
- Scoped mode (`VITE_SCOPED_SUBSCRIPTIONS=1`):
  1. Base subscription for `lobby`, `player`, and `match`.
  2. Derived lobby/match scope for detail table subscriptions.
  3. Re-scope subscriptions when active lobby/match changes.

## Event Payload Parsing

- Parse event payloads via typed helpers in `web/src/lib/events.ts`.
- Avoid ad-hoc JSON parsing in UI components.

## Safety Rules

1. Reducer signatures are treated as public contracts.
2. Generated bindings under `web/src/module_bindings/*` are never edited manually.
3. Schema/reducer changes require regenerated bindings and selector validation.
