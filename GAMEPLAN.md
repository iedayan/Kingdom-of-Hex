# HexGame — design & delivery plan

**Full game design (systems, UX, content, risks):** [docs/GAME_DESIGN.md](./docs/GAME_DESIGN.md)

This document is the **condensed** working plan for the game built on top of [felixturner/hex-map-wfc](https://github.com/felixturner/hex-map-wfc) (procedural hex map + WebGPU). The upstream project provides **terrain generation and rendering**; we add **run-based strategy gameplay**.

## Vision (one-liner)

**Short roguelike-style runs** on a seeded procedural medieval hex world—readable, replayable, and distinct from long-form 4X sessions.

## Pillars

| Pillar | Intent |
|--------|--------|
| **Session length** | Target ~25–40 minutes per run (tunable). |
| **Roguelike spine** | Seeded maps, clear win/lose, restart-friendly; meta-progression only after the core loop is fun. |
| **Map as character** | Use elevation, coast, and chokes from the hex/WFC output as tactical and economic pressure. |
| **Smooth play** | Stable frame budget, clear UI feedback, deterministic simulation from **seed + player actions** where it matters. |

## Setting & art

- **Medieval** aligns with existing KayKit-style tiles already in the stack (AoE / Stronghold *flavor*, not a clone).
- **Differentiation** is the **run structure** and **hex/WFC identity**, not a new renderer.
- **Commercial use**: confirm [KayKit Medieval Hexagon Pack](https://kaylousberg.itch.io/kaykit-medieval-hexagon) license terms before monetizing.

## Technical direction

- **Stack**: Extend the existing **Vite + Three.js (WebGPU)** project; do not build a general-purpose engine.
- **Game layer**: Small modules under `src/game/` (run config, session state, rules, UI). Add ECS or a UI framework only when complexity forces it.
- **Seeding**: `?seed=<number>` in the URL for fixed runs; global RNG via `SeededRandom.js`.
- **Reach**: WebGPU is not universal—plan a **fallback path** (reduced effects / WebGL2) before a wide launch.

## Phased roadmap

### Phase 0 — Lock scope (short)

- Finalize **one sentence** pitch and **non-goals** (e.g. no multiplayer at first).
- Pick **one primary win** and **one primary loss** for the first playable.

### Phase 1 — Vertical slice

- Integrate gameplay with the **existing map**: minimal economy (one resource), one **unit** or **tile action**, simple **combat or capture**.
- **End screen** + **restart** + visible **seed**.
- No meta-unlocks yet—prove the minute-to-minute loop.

### Phase 2 — Roguelike layer

- Small set of **starting boons** or **unlockables** (choose one system).
- **Difficulty** knobs tied to map pressure, not only stat inflation.
- Content that **combos with terrain** (water, height, chokes).

### Phase 3 — Polish & platform

- In-run **tutorial** or first-run guidance.
- Audio, options, **save/resume** if runs stretch longer.
- Performance pass + fallback rendering strategy for web.

### Phase 4 — Distribution

- Choose primary channel: **web** (itch, PWA), **Steam**, or **mobile**—each drives packaging and QA focus.

## Success criteria (before scaling content)

Players **finish runs voluntarily** and **start a second run with a new seed** without needing meta-rewards.

## Project tooling

- **Issues / roadmap**: GitHub Issues + milestones is enough early on; [Linear](https://linear.app) is optional if you want cycles and integrations—pick **one** source of truth.

## Upstream & license

- Game code fork inherits upstream **MIT** where applicable; **assets** may have separate terms—verify before shipping.
