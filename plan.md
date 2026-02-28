# plan.md — SpacetimeDB 2.0 Minigame Platform (Modular Runtime) + Tug-of-War MVP

This document is a **step-by-step build plan** for a modular minigame platform on **SpacetimeDB 2.0**, with the first game being **Tug-of-War (1 vs 100 / 100 vs 1 friendly)**.

The plan is structured to maximize **schema and code reuse** so you can add future games by implementing only:

1. a small set of game-specific tables, and
2. a small set of game-specific reducers, and
3. a UI panel that swaps based on `game_type`.

---

## 0) Outcome Targets for the MVP

### Product goals

- Host starts a lobby → receives a join code
- Players join via code (no login/paywall)
- Auto team assignment (balanced)
- Host starts match
- Players type the displayed word; correct inputs add pull force for their team
- Rope position and timer update in realtime
- Win when rope crosses threshold
- When timer hits 0 → enter elimination mode:
  - players must type within time limit
  - one misspelling eliminates
  - timeout eliminates

### Engineering goals

- **No custom WebSocket server** or “API backend” layer.
- **One modular server runtime** used by multiple minigames.
- Client as **plain HTML/JavaScript** (proof of concept). No React required for the MVP.

---

## 1) High-level Architecture

### Components

- **SpacetimeDB module** (authoritative server logic, state, scheduling)
- **Browser client** (`index.html` + bundled JS)
- **Build tooling** (TypeScript build + bundler to ship one browser script)

### Responsibilities

- SpacetimeDB handles:
  - authoritative state
  - game logic (reducers)
  - realtime fanout (subscriptions)
  - tick scheduling (schedule tables)
- Browser client handles:
  - UI rendering
  - reducer calls (join, start, submit)
  - subscribing to tables and rendering cached results

---

## 2) Repository Layout

Recommended structure:
repo/
server/ # SpacetimeDB module
src/
core/ # reusable runtime logic
games/
tug_of_war/ # game module
spacetime.toml # module config (as applicable)
package.json
tsconfig.json
web/
index.html
src/
app.ts # minimal UI logic (no framework)
ui/
games/
tug_of_war.ts # tug UI panel
package.json
tsconfig.json
vite.config.ts (or esbuild config)

Notes:

- Keep server and web separated so game logic and client build steps don’t collide.
- Keep a stable “core runtime” folder, and isolate each game to its own folder.

---

## 3) Core Runtime Data Model (Reusable)

Design intent:

- **Core tables stay thin**: lobby lifecycle, players, match lifecycle, scheduling hooks, events.
- **Game-specific state lives in game tables** keyed by `match_id` (not `lobby_id`) so you can support rematches and history.

### 3.1 `Lobby` (public)

Represents a room that can host a game.

Fields:

- `lobby_id` (PK)
- `join_code` (unique short string)
- `host_identity` (creator identity)
- `status` enum: `Waiting | Running | SuddenDeath | Finished`
- `game_type` (string) e.g. `"tug_of_war"`
- `active_match_id` (nullable; references `Match.match_id`)
- `created_at` (timestamp)

Indexes:

- unique index on `join_code`
- index on `host_identity`

### 3.2 `LobbySettings` (public)

Generic per-lobby configuration; low-frequency reads/writes only.

Fields:

- `lobby_id` (PK part)
- `key` (PK part)
- `value_json` (string)

Examples:

- `"round_seconds": "90"`
- `"win_threshold": "100"`
- `"elimination_word_time_ms": "1800"`

### 3.3 `Player` (public)

Membership in a lobby.

Fields:

- `player_id` (PK)
- `lobby_id` (index)
- `identity` (unique per lobby)
- `display_name`
- `team` (nullable enum/string, e.g. `"A"`/`"B"`)
- `status` enum: `Active | Eliminated | Left`
- `joined_at`
- `left_at` (nullable)
- `eliminated_reason` (nullable)

Indexes:

- unique `(lobby_id, identity)`
- index `(lobby_id, status)`
- index `(lobby_id, team)`

### 3.4 `Match` (public)

One play session.

Fields:

- `match_id` (PK)
- `lobby_id` (index)
- `game_type`
- `phase` enum: `PreGame | InGame | SuddenDeath | PostGame`
- `started_at`
- `ends_at` (nullable)
- `winner_team` (nullable)
- `winner_player_id` (nullable)
- `seed` (int) optional

Indexes:

- index `(lobby_id, match_id)`
- index `(lobby_id, game_type)`

### 3.5 `MatchClock` (public)

Single authoritative timer model.

Fields:

- `match_id` (PK)
- `phase_ends_at` (timestamp)
- `seconds_remaining` (int, optional cache)
- `tick_rate_ms` (int) e.g. 250 or 500

### 3.6 `Schedule` (schedule table)

Drives ticks and transitions for any match.

Fields:

- `match_id`
- `kind` (string) e.g. `"tick"`
- `active` (bool)
- `schedule_at` (special scheduling column)

Recommended:

- one row per match per schedule kind.
- tick schedule repeats at a stable rate (you implement rescheduling in the tick reducer).

### 3.7 `GameEvent` (event table; public)

Optional but recommended. Use for host activity feed/debugging.

Fields:

- `lobby_id`
- `match_id`
- `type` (string)
- `payload_json` (string)
- `at` (timestamp)

Examples:

- `"player_joined"` payload: `{"player_id":..., "name":"..."}`
- `"submit_ok"` payload: `{"player_id":..., "team":"A"}`
- `"eliminated"` payload: `{"player_id":..., "reason":"timeout"}`

---

## 4) Tug-of-War Game Module Data Model (Game-specific)

All tug-of-war state is keyed by `match_id` so the same lobby can run multiple matches.

### 4.1 `TugState` (public; 1 row per match)

Fields:

- `match_id` (PK)
- `rope_position` (int; 0 = center, positive favors Team A)
- `win_threshold` (int; e.g. 100)
- `team_a_force` (int; accumulator)
- `team_b_force` (int)
- `current_word` (string)
- `word_version` (int)
- `mode` enum: `Normal | Elimination`
- `word_rotate_ms` (int; e.g. 3000)
- `elimination_word_time_ms` (int; e.g. 1800)

### 4.2 `TugPlayerState` (public; per player per match)

Fields:

- `match_id` (PK part)
- `player_id` (PK part)
- `correct_count` (int)
- `last_submit_at` (timestamp, nullable)
- `deadline_at` (timestamp, nullable) — elimination mode only

Indexes:

- index `(match_id, player_id)`
- index `(match_id, deadline_at)` (to quickly eliminate timeouts)

---

## 5) Core Reducers (Reusable Runtime API)

Reducers mutate state. This list is designed so the browser client can be generic.

### 5.1 Lobby lifecycle

1. `create_lobby(game_type: string) -> { lobby_id, join_code }`

   - sets `host_identity` to caller
   - creates Lobby with `status=Waiting`
   - writes default `LobbySettings` for that game (if any)

2. `join_lobby(join_code: string, display_name: string) -> { lobby_id, player_id }`

   - finds Lobby by code
   - if caller already joined: return existing player_id (reconnect)
   - else insert Player with team assignment (balanced)
   - emit `GameEvent(player_joined)`

3. `leave_lobby(lobby_id: id)`

   - mark Player `status=Left` and set `left_at`

4. `set_lobby_setting(lobby_id, key, value_json)` (host only)
   - writes to `LobbySettings`

### 5.2 Match lifecycle

5. `start_match(lobby_id) -> { match_id }` (host only)

   - creates Match with `phase=InGame`, started_at
   - sets Lobby.active_match_id = match_id and status=Running
   - initializes `MatchClock(phase_ends_at = now + round_seconds)`
   - calls **game init** reducer internally based on `game_type`
   - activates tick schedule

6. `end_match(lobby_id)` (host only)

   - sets Match.phase=PostGame, Match.ends_at
   - sets Lobby.status=Finished
   - deactivates schedule

7. `reset_lobby(lobby_id)` (host only)
   - sets Lobby.status=Waiting
   - clears Lobby.active_match_id
   - optionally clears players’ `team` (or keep)
   - used for rematch

---

## 6) Tug-of-War Reducers (Game module API)

### 6.1 Initialization

`tug_init(match_id)`

- read lobby settings:
  - `round_seconds`
  - `win_threshold`
  - `word_rotate_ms`
  - `elimination_word_time_ms`
- insert `TugState` row:
  - rope_position = 0
  - word_version = 1
  - mode = Normal
  - current_word = random word from built-in list (seeded)
- for each Player in lobby:
  - insert `TugPlayerState(match_id, player_id, ...)`

### 6.2 Player action

`tug_submit(match_id, word_version, typed)`
Validation:

- match exists and is active
- player exists, is Active, belongs to match’s lobby
- `typed` matches `TugState.current_word` exactly (MVP)
- `word_version` equals current `TugState.word_version` (prevents stale submits)
- rate limit: reject if `now - last_submit_at < 150ms` (tune later)

On correct:

- increment `TugPlayerState.correct_count`
- update `last_submit_at`
- add +1 force to the player’s team accumulator in `TugState`
- if mode=Elimination:
  - set player’s `deadline_at = now + elimination_word_time_ms`

On incorrect:

- if mode=Elimination:
  - eliminate immediately:
    - set Player.status=Eliminated
    - Player.eliminated_reason = "misspelling"
    - emit GameEvent(eliminated)

### 6.3 Tick loop (scheduled)

`tug_tick(match_id)`

Responsibilities (in order):

1. Load `Match`, `MatchClock`, `TugState`
2. Determine time left:

   - `seconds_remaining = max(0, floor((phase_ends_at - now)/1000))`
   - store it in `MatchClock.seconds_remaining` if you want clients to read it easily

3. If `Match.phase == InGame` and time left > 0:

   - Apply forces to rope:
     - `rope_position += (team_a_force - team_b_force)`
   - Decay forces:
     - `team_a_force = floor(team_a_force * 0.85)`
     - `team_b_force = floor(team_b_force * 0.85)`
   - Rotate word if needed (time-based):
     - keep a small internal timer or store `next_word_at` in `TugState` (recommended)
     - when time >= next_word_at:
       - choose new word
       - increment `word_version`
       - update next_word_at

4. Win check:

   - if rope_position >= win_threshold: Team A wins
   - if rope_position <= -win_threshold: Team B wins
   - on win:
     - set Match.phase=PostGame
     - set Lobby.status=Finished
     - set winner_team, ends_at
     - deactivate schedule

5. If time left == 0 and Match.phase == InGame:

   - transition to sudden death / elimination:
     - set Match.phase = SuddenDeath
     - set Lobby.status = SuddenDeath
     - set TugState.mode = Elimination
     - increment word_version and pick a new word
     - set each alive player’s `deadline_at = now + elimination_word_time_ms`

6. If Match.phase == SuddenDeath:

   - eliminate timed-out players:
     - for each alive player where `deadline_at < now`:
       - Player.status=Eliminated, reason="timeout"
       - emit GameEvent(eliminated)
   - End conditions during sudden death:
     - Option 1: last-team-standing wins (recommended):
       - if alive Team A == 0 → Team B wins
       - if alive Team B == 0 → Team A wins
     - Option 2: continue rope movement until win threshold (more chaotic)

7. Reschedule next tick:
   - update the schedule table row `schedule_at = now + tick_rate_ms`

---

## 7) Reusable “Game Interface” Pattern

To add future games, follow this consistent set:

- `game_init(match_id)` equivalent
- `game_action(match_id, ...)`
- `game_tick(match_id)` scheduled

Keep the **client runtime** generic by:

- always reading core tables for lobby/match/players/timer
- then switching game UI based on `Lobby.game_type`

---

## 8) Client (HTML/JS POC) Plan

### 8.1 Client screens

1. Landing:

   - Join code input
   - Display name input
   - Buttons:
     - “Join”
     - “Host (Create Lobby)”

2. Lobby view:

   - join code (big)
   - player counts by team
   - host-only “Start Match” button

3. Match HUD (shared):

   - timer
   - rope bar (center line at 0)
   - team force/score indicators
   - alive players count (especially in elimination)

4. Player input panel:
   - current word shown large
   - input box (Enter submits)
   - local status: alive/eliminated + reason

### 8.2 Subscriptions (always-on)

Subscribe to core:

- Lobby by `join_code` or `lobby_id`
- Player rows by `lobby_id`
- Match row by `active_match_id`
- MatchClock by `match_id`
- Optional GameEvent feed by `lobby_id`

Subscribe to game tables based on `Lobby.game_type`:

- Tug-of-war: `TugState` and `TugPlayerState` by match_id

### 8.3 Client reducer calls

- Host:
  - `create_lobby("tug_of_war")`
  - `start_match(lobby_id)`
- Player:
  - `join_lobby(join_code, display_name)`
  - `tug_submit(match_id, word_version, typed)`

### 8.4 Rendering strategy (no framework)

- Store the subscribed table rows in simple JS objects (or use the SDK cache directly).
- On any subscription update:
  - recompute derived UI model
  - update DOM
- Keep DOM updates minimal:
  - update rope bar width/position
  - update timer text
  - update current word
  - update team counts

---

## 9) Setup Steps — Project + Tooling (Detailed)

> The exact CLI commands and package names can vary slightly by SpacetimeDB release. Use this as the **sequence** you follow; map to the current docs/CLI.

### 9.1 Prerequisites

Install:

- Node.js (LTS)
- SpacetimeDB CLI (v2.0 compatible)
- A bundler (Vite or esbuild) for the web POC

### 9.2 Create the server module

1. `mkdir server && cd server`
2. Initialize a TypeScript module project using SpacetimeDB’s tooling.
3. Ensure you can:
   - build the module
   - run the module locally (or deploy to a dev server)
4. Add folders:
   - `src/core`
   - `src/games/tug_of_war`

### 9.3 Implement core tables and reducers

Order:

1. Define core tables:
   - Lobby
   - LobbySettings
   - Player
   - Match
   - MatchClock
   - Schedule (schedule table)
   - GameEvent (event table; optional)
2. Implement reducers:
   - create_lobby
   - join_lobby
   - leave_lobby
   - set_lobby_setting
   - start_match
   - end_match
   - reset_lobby
3. Add basic permissions:
   - only host can start/end/reset
   - only host can change settings
4. Verify with basic script or test client:
   - create lobby
   - join lobby
   - see rows appear

### 9.4 Implement tug-of-war module

Order:

1. Define tug tables:
   - TugState
   - TugPlayerState
2. Implement reducers:
   - tug_init
   - tug_submit
   - tug_tick
3. Integrate with core `start_match`:
   - switch on `Lobby.game_type`
   - call `tug_init(match_id)`
   - activate tick schedule for that match

### 9.5 Create the web POC

1. `mkdir web && cd web`
2. Initialize JS/TS project with Vite (recommended) or esbuild.
3. Add `index.html` and `src/app.ts`
4. Add SpacetimeDB client SDK dependency.
5. Generate client bindings for your module (per SpacetimeDB workflow).
6. Bundle into a single browser script and load it from index.html.

### 9.6 Run everything locally

1. Start SpacetimeDB locally (or connect to hosted dev)
2. Deploy/run the server module
3. Start the web dev server
4. Test with 2–5 browser tabs:
   - host in one tab
   - players in others
   - verify realtime updates and gameplay loop

---

## 10) MVP Implementation Order (Execution Plan)

### Phase 1 — Core runtime + lobby flow (must be stable)

- [ ] Lobby creation + join code
- [ ] Join flow + player list
- [ ] Auto team assignment (balanced)
- [ ] Host permissions enforced
- [ ] Start match creates Match + MatchClock

### Phase 2 — Tug-of-war basic gameplay

- [ ] TugState init on match start
- [ ] Word display to clients
- [ ] Submissions add force
- [ ] Tick loop updates rope
- [ ] Win condition ends match

### Phase 3 — Timer + elimination mode

- [ ] Countdown visible
- [ ] Transition at timer==0
- [ ] Elimination deadlines assigned
- [ ] Incorrect word eliminates
- [ ] Timeout eliminates
- [ ] Sudden death resolves winner

### Phase 4 — Reuse proof (strongly recommended)

Implement a tiny second game (e.g. “live poll”) using the same runtime:

- [ ] add `PollState` + `PollPlayerState`
- [ ] add `poll_init` + `poll_vote` + optional `poll_tick`
- [ ] switch UI panel based on `Lobby.game_type`

This forces modularity early and prevents “tug-of-war leaking into core”.

---

## 11) Key Design Decisions (Lock These Early)

### 11.1 Use `match_id` as the key for game state

Reason:

- supports rematches
- supports match history
- avoids overwriting state when lobby remains open

### 11.2 Keep per-game player stats out of `Player`

Use `<Game>PlayerState` tables per match.

### 11.3 Standardize the client runtime contract

Client always expects:

- Lobby + Player + Match + MatchClock
  Then game-specific:
- `<Game>State`, `<Game>PlayerState`

### 11.4 Elimination mode model (recommended)

Use **per-player deadline** reset on each correct submission:

- fairer
- less mass elimination
- more engagement

---

## 12) Anti-abuse / Fairness (MVP level)

Server-side checks in `tug_submit`:

- enforce word_version match
- per-player rate limit (150ms–250ms)
- allow only Active players
- reject submissions when not in match phase

Optional early bot resistance (later):

- per-identity join limit per lobby
- IP-based throttling (outside SpacetimeDB)
- random word lists and rotation

---

## 13) Acceptance Tests (MVP)

### Lobby + start

- [ ] Host creates lobby, gets code
- [ ] 20 players can join and are balanced by team
- [ ] Host can start match; non-host cannot

### Gameplay

- [ ] Correct submissions move rope for the correct team
- [ ] Rope updates in realtime to all players
- [ ] Win ends match consistently

### Elimination

- [ ] On timer end, elimination starts
- [ ] Misspelling eliminates
- [ ] Timeout eliminates
- [ ] Sudden death ends with a winner (team last standing)

---

## 14) “How to Add a New Game” Checklist

To add game `X`:

1. Create `server/src/games/x/`
2. Add:
   - `XState(match_id, ...)`
   - `XPlayerState(match_id, player_id, ...)`
3. Add reducers:
   - `x_init(match_id)`
   - `x_action(match_id, ...)` (one or more)
   - optional `x_tick(match_id)`
4. Update core `start_match` switch:
   - if `Lobby.game_type == "x"` → call `x_init`
5. Add client panel:
   - `web/src/games/x.ts`
   - subscribe to `XState` + `XPlayerState`
   - render panel based on `Lobby.game_type`

---

## 15) Notes on “No React” vs React

For this MVP:

- Plain HTML/JS is sufficient and faster.
- A React app becomes valuable once:
  - you have multiple games and complex UI state
  - you want reusable UI primitives and routing
  - you build streamer dashboards/analytics

You can keep your current plan and later migrate only the client UI to React without changing the schema, as long as you keep the runtime contract stable.
