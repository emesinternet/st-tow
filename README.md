# Typing Fever!

Realtime Typing Tug of War.

## What Is This?

**Typing Fever!** is a fast, social typing battle where two teams race to pull a dancing dragon to their side of the floor.

You are not just typing for points. Every correct word moves the match in real time for everyone watching.

## How It Plays

1. A host opens a lobby and players jump in.
2. Players are split into Red and Blue.
3. Everyone types assigned words as quickly and accurately as possible.
4. Correct words pull momentum toward your team.
5. When time runs out, sudden death and tie-break mechanics can decide everything.

The match is loud, visual, and immediate: player markers bounce, speech bubbles pop, powers trigger, and the entire room feels every action.

## What Makes It Fun

- Team-vs-team tension with live momentum swings
- Host-driven chaos with power-ups and mode shifts
- Tie-zone endings that trigger Rock-Paper-Scissors showdowns
- Party-style visuals: dancefloor effects, dragon center stage, music, and confetti
- End-of-match stats that celebrate clutch players and team output

## How It Uses SpacetimeDB

Typing Fever! leans hard into SpacetimeDB’s realtime model:

- **Single shared game truth**: everyone sees the same state, instantly.
- **Server-authoritative outcomes**: fairness for scoring, eliminations, tie-breaks, and winners.
- **Live subscriptions**: players and hosts watch the match evolve without polling.
- **Reducer-driven gameplay**: every action (typing, powers, votes) is a deterministic state transition.
- **Built-in identity/session flow**: players can reconnect and continue with consistent state.
- **Scheduled game timing**: countdowns, round clocks, and phase transitions stay synchronized.

The result is a multiplayer experience that feels immediate, reliable, and competitive even as matches get hectic.

## Core Experiences

- Lobby creation and joining by code
- Team typing tug-of-war match flow
- Host powers and host score economy
- Sudden death pressure phase
- Tie-zone + RPS tie-break sequence
- Post-game results and lobby lifecycle controls

## Project Name

This repo is still named `st-tow`, but the game brand is **Typing Fever!**
