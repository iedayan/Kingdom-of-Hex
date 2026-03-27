# HexGame — Game Design Document (GDD)

**Project:** HexGame (fork of [hex-map-wfc](https://github.com/felixturner/hex-map-wfc))  
**Document purpose:** Single source of truth for creative direction, systems, scope, and delivery alignment.  
**Companion:** [GAMEPLAN.md](../GAMEPLAN.md) — condensed vision, pillars, and phased **production** roadmap.

---

## Table of contents

1. [Executive summary](#1-executive-summary)  
2. [Design pillars](#2-design-pillars)  
3. [Influences & what we are not](#3-influences--what-we-are-not)  
4. [Audience, platform, and business context](#4-audience-platform-and-business-context)  
5. [Setting, tone, and fantasy](#5-setting-tone-and-fantasy)  
6. [Session & meta structure](#6-session--meta-structure)  
7. [Core gameplay loops](#7-core-gameplay-loops)  
8. [World, map, and terrain](#8-world-map-and-terrain)  
9. [Resources & economy](#9-resources--economy)  
10. [Settlements & territory](#10-settlements--territory)  
11. [Production, buildings, and queues](#11-production-buildings-and-queues)  
12. [Units, movement, and orders](#12-units-movement-and-orders)  
13. [Combat](#13-combat)  
14. [Fortifications & siege pressure](#14-fortifications--siege-pressure)  
15. [Exploration & visibility](#15-exploration--visibility)  
16. [Research, unlocks, and factions](#16-research-unlocks-and-factions)  
17. [Opponents & AI](#17-opponents--ai)  
18. [Events, scenarios, and difficulty](#18-events-scenarios-and-difficulty)  
19. [Victory & defeat](#19-victory--defeat)  
20. [User interface & UX](#20-user-interface--ux)  
21. [Audio, VFX, and readability](#21-audio-vfx-and-readability)  
22. [Accessibility & settings](#22-accessibility--settings)  
23. [Technical design alignment](#23-technical-design-alignment)  
24. [Content budget & data-driven defs](#24-content-budget--data-driven-defs)  
25. [MVP vs later](#25-mvp-vs-later)  
26. [Risks & mitigations](#26-risks--mitigations)  
27. [Non-goals](#27-non-goals)  
28. [Open questions](#28-open-questions)  
29. [Glossary](#29-glossary)  
30. [Technical debt & testing strategy](#30-technical-debt--testing-strategy)

---

## 1. Executive summary

**HexGame** is a **turn-based** strategy experience on a **procedural medieval hex world** generated with **Wave Function Collapse**, rendered in the browser with **WebGPU**. Runs are **short** (roughly **25–40 minutes** as a design target), **seeded** for replay and sharing, and structured like a **roguelike**: clear win/lose conditions, restart-friendly flow, optional meta-progression only after the core loop is proven fun.

The design **draws inspiration** from:

- **4X / turn-based empire** games (e.g. *Civilization*-style hex ownership, cities, research),
- **Tactical turn-based** clarity (readable moves, limited rules overhead),
- **RTS economy fantasy** (*Age of Empires*-style gathering and spending pressure, without real-time APM),
- **Castle / siege fantasy** (*Stronghold*-style holding ground, breaches, and pressure—abstracted, not a full city-builder sim).

The game is **not** a clone of any single title. The **spine** is **turn-based**; RTS and Stronghold influences appear as **verbs** (expand, raid, fortify, break) and **pressure** (timers, waves, supply), not as full real-time systems.

---

## 2. Design pillars

| Pillar | Player-facing promise | Design enforcement |
|--------|------------------------|------------------|
| **Readable strategy** | “I always know why I won or lost.” | Few resources, clear modifiers, predictable resolution order, good tooltips. |
| **Map as co-designer** | “This seed created a story.” | Terrain, coast, elevation, chokes affect movement, combat, economy, and events. |
| **Run-sized commitment** | “One sitting, one arc.” | Turn limits or pressure clocks, small tech surface, no mandatory 10-hour campaigns. |
| **Replayable seeds** | “Same seed, same world; different choices.” | Deterministic generation + deterministic combat where randomness exists (logged seed + RNG stream). |
| **Smooth presentation** | “It feels good to move the camera and act.” | Stable frame budget, crisp selection, optional “pulse” animations after End Turn. |

---

## 3. Influences & what we are not

### 3.1 Civilization-style (and similar 4X TBS)

**Borrow:** Hex map, city sites, borders or control zones, research unlocking units/buildings, fog of war, AI factions, victory types.  
**Do not ship in v1:** Deep diplomacy, trade networks, espionage, happiness/culture complexity, huge tech trees, world congress, etc.

### 3.2 Other turn-based tactics

**Borrow:** Clear move/attack resolution, initiative simplicity, “one primary action” per unit per turn (unless a later rule explicitly grants more).  
**Avoid early:** Per-unit inventory RPG depth, grid-height puzzles unrelated to the map.

### 3.3 Age of Empires–style RTS

**Borrow:** Villager/worker fantasy, gather → spend loop, military production tension, map control.  
**Avoid:** Real-time micro, multi-queue juggling, economic death by APM. Implement economy as **turn-based ticks** or **phased resolution** after orders are locked in.

### 3.4 Stronghold-style castle fantasy

**Borrow:** Walls/gates as **delay** and **objectives**, siege countdowns, defender advantage.  
**Avoid:** Freeform wall drawing, full peasant happiness / chain production sim. Start with **abstract fort levels** or **preset fort tiles** before any freeform builder.

---

## 4. Audience, platform, and business context

### 4.1 Primary audience

- Players who enjoy **strategy** and **roguelikes / roguelites** with readable rules.
- Players who like **pretty procedural maps** and sharing seeds.

### 4.2 Platforms (in order of alignment with current stack)

1. **Web** (WebGPU) — fastest iteration, link sharing, itch.io / PWA.  
2. **Packaged desktop** (Electron/Tauri or similar) — if store distribution is required.  
3. **Mobile** — only after input/UI pass and performance/fallback strategy.

### 4.3 Business & legal

- **Code:** Upstream MIT where applicable.  
- **Assets:** [KayKit Medieval Hexagon Pack](https://kaylousberg.itch.io/kaykit-medieval-hexagon) and any added art must be cleared for **commercial** use before monetization.  
- Monetization is **out of scope** for this GDD’s mechanics; any model must respect asset licenses and platform rules.

---

## 5. Setting, tone, and fantasy

- **Era / aesthetic:** Medieval fantasy grounded enough for intuitive units (militia, archer, knight analogs) and structures (farm, wall, workshop).  
- **Tone:** Hopeful struggle against map and rivals—not grimdark requirement; humor optional in event text.  
- **Narrative scope:** **Emergent** from map and factions; no mandatory campaign cutscene pipeline for MVP.

---

## 6. Session & meta structure

### 6.1 Run

- Player starts with a **seed** (URL param, menu, or random).  
- Run proceeds through **turns** until victory, defeat, or abandon.  
- **End of run:** summary (turns, score, key events), option to **copy seed**, **restart**, or return to menu.

### 6.2 Roguelike meta (later)

- **Unlock:** new starting boons, factions, or scenario mutators—**only after** base loop is validated.  
- **No pay-to-win** assumptions in design; power stays map- and skill-driven.

### 6.3 Roguelike identity (explicit)

HexGame embraces these roguelike principles:

- **Permadeath (MVP):** no mid-run saves; defeat = restart.  
- **Procedural worlds:** every seed produces distinct geography and pressure patterns.  
- **Emergent stories:** terrain + events + player choices create unique “run narratives.”  
- **Run-to-run variety:** seed variety first; meta unlocks only after the core loop is proven fun.  
- **Replayability through seeds:** share “impossible seed” / “god seed” runs and compare outcomes.

What we are **not** (early):

- **Hades/Isaac-style power creep meta:** unlocks must not become required to win.  
- **Deckbuilder roguelike:** no card mechanics; strategy is spatial/positional.  

---

## 7. Core gameplay loops

### 7.1 Outer loop (between runs)

Choose seed / difficulty / starting loadout → play run → reflect on outcome → retry with new seed or same seed.

### 7.2 Inner loop (each turn)

**Observe** (visibility, threats, economy) → **Decide** (moves, builds, research) → **Commit** (End Turn) → **Resolve** (movement, combat, production, events, AI) → **Feedback** (animations, UI, logs).

### 7.3 Micro loop (optional “RTS feel”)

After End Turn, play **short ordered animations** (unit steps, hits, captures) without requiring player input—skippable in settings.

---

## 8. World, map, and terrain

### 8.1 Topology

- Gameplay uses the same **hex graph** as the renderer: cells present in **`globalCells`** with stable **cube keys** (`cubeKey(q,r,s)`).  
- Any hex not in the solved set is **void** (impassable / irrelevant).

### 8.2 Terrain categories (design-level)

Map **tile type** and **elevation** from WFC output drive:

- **Movement cost** (plains vs forest vs hill vs mountain).  
- **Defense modifier** (optional v1+).  
- **Build eligibility** (e.g. cannot found on water; mountain restrictions).  
- **Economic yield** (e.g. coast/fish, hills/mine—exact table is content, not engine).

### 8.3 Strategic geography

- **Chokepoints, peninsulas, inland seas** should matter for combat and expansion.  
- Design scenarios or generation bias so not every seed is a flat optimal blob.

---

## 9. Resources & economy

### 9.1 Resource philosophy

Start with **2–3 global resources** plus **per-city production** (hammers/shields) to avoid spreadsheet fatigue.

**Example baseline (tunable):**

| Resource | Role |
|----------|------|
| **Food** | Growth / upkeep / recovery |
| **Gold** | Rush purchases, maintenance, events |
| **Production** (per city) | Builds units and structures each turn |

*Alternative MVP:* single **“supplies”** resource + per-city production only.

### 9.2 Income & upkeep

- **Yields** from controlled/worked tiles and buildings.  
- **Upkeep** on units and fortifications to prevent infinite doom-stacks without economy.  
- **Stockpiles** global or per-city—pick one model early and keep UI honest.

### 9.3 Gathering (AoE flavor, TBS execution)

- **Assign workers** to tiles or buildings (abstract “work orders”), resolved at end of turn.  
- No real-time pathing for gather cycles in MVP.

### 9.4 AoE economy abstraction (turn-based implementation)

The “Age of Empires fantasy” translates into **spend pressure** and **visible trade-offs**, not APM:

- **Resource pressure:** resources exist to be spent (expansion vs defense), not hoarded.  
- **Gathering loop (turn-based):** workers persist on a job; reassignment costs a turn (or small MP/action).  
- **Scaling constraint:** more workers increase income but introduce **food upkeep** (prevents infinite expansion).  
- **Raiding pressure:** workers and soft targets can be threatened to recreate RTS tension.

### 9.5 Resource economy (numbers draft, tunable)

**Starting resources (draft):**

- Gold: 100  
- Wood: 50  
- Food: 50  
- Stone: 0  
- Science: 0  

**Baseline income (draft):**

- Baseline science: **+2 science/turn** (even with no buildings)  
- Buildings generate yields per turn (e.g. farm → food, lumberjack → wood, mine → stone, library → science).  
- Market converts 5 food into bonus gold if the player can afford it (trade-off sink).  

**Example unit costs (draft):**

| Unit | Cost | Upkeep/turn |
|------|------|-------------|
| Settler | 50 food, 50 gold | 1 food |
| Scout | 20 gold | 0.5 food |
| Militia | 30 gold | 1 food |
| Archer | 40 gold | 1 food |

**Economic tension target:** by turn ~10 the player should feel the trade-off of “settler vs walls vs units.”

**Prototype note (current implementation):**

- Unit upkeep is currently **2 food/turn** per unit (scout/archer/knight) and starvation deals damage if food is insufficient.

---

## 10. Settlements & territory

### 10.1 Founding

- **Settler** (or equivalent) consumes a turn and creates a **city** on a valid hex.  
- Constraints: distance from other cities, terrain eligibility, optional “hostile territory” rules later.

### 10.2 Territory control

- **Lite Civ:** fixed **radius** or **BFS** ownership from city center up to N rings, clipped to passable/claimable hexes.  
- **Border friction:** entering owned territory may cost extra movement or cause diplomatic flags (if diplomacy exists).

### 10.3 City stats (minimal)

- Population tier or “city level” (abstract).  
- Defense value (wall/fort level adds to this in siege).  
- Buildings list (bitfield or array of building ids).

---

## 11. Production, buildings, and queues

### 11.1 Buildings

Data-driven list: **id**, **cost**, **prerequisites** (tech/building), **effects** (yield, defense, unlocks unit).

**Starter set examples (not final):**

- Farm / mill → food or gold  
- Barracks → unlock military units  
- Workshop → production bonus  
- **Fort / walls** → defense and siege mechanics (see §14)

### 11.2 Queues

- **MVP:** **one** military or civilian unit queue **or** one building per city per turn (choose simplest that is fun).  
- **Later:** dual queue, rush with gold.

---

## 12. Units, movement, and orders

### 12.1 Unit types (MVP sketch)

| Unit | Role |
|------|------|
| **Settler** | Found city |
| **Scout** | Vision, cheap explore |
| **Melee** | Core combat |
| **Ranged** | Optional v1 if pathfinding + LoS rules stay simple |

### 12.2 Movement

- **Movement points (MP)** per turn; terrain modifies cost.  
- **Pathfinding:** A* (or equivalent) on hex graph restricted to `globalCells` and passability rules.  
- **Zone of control** optional—adds depth but UI cost.

### 12.3 Orders

- Move, hold, attack (if adjacent or in range), settle, fortify (defensive stance).  
- **No** real-time retargeting; all committed before End Turn.

---

## 13. Combat

### 13.1 Triggers

- Player orders attack, or AI initiates; optionally **mutual reveal** when war is declared (design choice).

### 13.2 Resolution (recommended MVP)

- **One engagement per attacker action** (no stack-splitting complexity early).  
- Inputs: attacker/defender **strength**, **HP**, **terrain modifier**, optional **fort bonus**.  
- Output: damage, retreat, or death; **seeded RNG** for variance with replay consistency.

### 13.3 City combat

- Treat city as **tile with garrison** + **defense value**.  
- Capture conditions: reduce garrison / breach fort (tie to §14) per chosen rule set.

---

## 14. Fortifications & siege pressure

### 14.1 Design intent

Deliver **Stronghold-adjacent fantasy** without full sim: players should feel **relief** when a wall buys a turn, and **tension** when a **siege timer** ticks.

### 14.2 MVP implementations (pick one path first)

1. **Fort level** on city tile: +defense, reduces damage taken; attacker must spend turns “breaching” to remove bonus.  
2. **Separate wall hexes** (occupying adjacent slots) with HP—higher fidelity, more UI.  
3. **Scenario modifier:** “Siege in 15 turns” as external pressure on a scenario map.

### 14.3 Siege clock

- Optional global or per-city **countdown** until penalty (attrition, loss, or boss wave).  
- Must be **telegraphed** in UI at all times.

### 14.4 Siege pressure system (concrete)

**Fortification tiers (draft):**

| Tier | Name | Defense bonus | Pressure required |
|------|------|---------------|-------------------|
| 0 | Village | +0 | N/A |
| 1 | Palisade | +2 | 3 turns |
| 2 | Stone wall | +5 | 6 turns |
| 3 | Castle | +8 | 10 turns |

**Siege pressure:**

- Each hostile unit adjacent to the city adds **+1 pressure/turn**.  
- When pressure ≥ requirement, fort tier drops by 1 and pressure resets (or rolls over—pick one and document).  
- At tier 0, the city can be captured by direct combat.

**Repair:**

- Repairs cost **production** (not gold) to preserve tension and “hold the line” decisions.

---

## 15. Exploration & visibility

### 15.1 Fog of war states

- **Hidden:** unknown terrain (black or stylized veil).  
- **Explored:** terrain known, units not updated.  
- **Visible:** current intel.

### 15.2 Sources of vision

- Units (scout > melee range), cities, watchtowers, optional high-ground rule tied to elevation data.

### 15.3 Line of sight

- **MVP:** range-based only (no geometric LoS).  
- **Later:** elevation-based LoS if it stays understandable with one glance.

---

## 16. Research, unlocks, and factions

### 16.1 Research

- **Small directed graph** (e.g. 8–15 nodes for first commercial slice).  
- Costs **science per turn**; unlocks units, buildings, or passive bonuses.  
- Avoid parallel “civic + tech + religion” for MVP—**one** research stream is enough.

### 16.2 Factions / leaders (roguelike hook)

- **Asymmetric bonuses:** e.g. +wall strength, +scout vision, cheaper economy, raider start.  
- **Scenario factions** can be AI-only with simple behavioral tags (expander, turtler, raider).

### 16.3 Tech tree (MVP sketch, 10–12 nodes)

**Ancient (T0 unlocks):**

- Agriculture → Farms, +food from worked tiles  
- Mining → Mines, +gold from hills  
- Archery → Archer unit  

**Classical (requires 2 ancient):**

- Masonry → Tier 1 walls  
- Writing → Libraries (+science)  
- Bronze Working → Spearman (defense bias)  

**Medieval (requires Masonry + either Archery or Writing):**

- Engineering → Catapult / siege bonus  
- Feudalism → Knight (mobility)  
- Fortification → Tier 3 castle  

**Cost curve (draft):** Ancient 40, Classical 80, Medieval 160 science.

---

## 17. Opponents & AI

### 17.1 MVP AI goals

- **Understandable:** player can predict why the AI moved.  
- **Fair:** telegraphed aggression, no full-map omniscience unless difficulty calls for it.

### 17.2 Layered AI (build in order)

1. **Random legal moves** (sanity test only).  
2. **Priority list:** defend capital → build military if weak → expand if safe → harass workers.  
3. **Scoring heuristics** for target tiles and combat trades.  
4. **Search** (only if needed and budget allows).

### 17.3 Diplomacy

- **MVP:** permanent war/peace or “always hostile AI.”  
- **Later:** simple trades, ceasefires, joint war against player.

### 17.4 AI personality tags (MVP)

Three simple archetypes (MVP):

- **Expander (Green):** prioritizes settlers until 3+ cities; avoids aggression unless provoked.  
- **Militarist (Red):** builds military toward a cap; attacks when stronger; targets weakest city.  
- **Turtle (Blue):** prioritizes walls and defense; small army; attacks mainly in self-defense.

**AI decision order (per turn, draft):**

1. Emergency: city under siege → rush defenders / repair  
2. Military production: if below threshold → build unit  
3. Expansion: if cities < target → found city  
4. Buildings: spend surplus on highest priority building  
5. Movement: scouts explore; military pressures objectives

---

## 18. Events, scenarios, and difficulty

### 18.1 Events

- **Map events:** ruin found, storm, bandit camp, migration.  
- **Choices** with 2–3 options; outcomes affect resources, units, or temporary modifiers.  
- Events should respect seed and turn for reproducibility.

### 18.2 Scenarios

- **Daily / challenge seed** (optional): fixed objective, leaderboard-friendly.  
- **Tutorial scenario:** scripted small map or constrained seed.

### 18.3 Difficulty knobs

- AI production bonus, starting units, event harshness, vision cheats, siege timer length—not only stat inflation.

### 18.4 Event templates (MVP examples)

**Ruin event (on exploring a ruin hex):**

> Ruins discovered!  
> A) Weapons cache → +50 gold, scout +10 XP  
> B) Ancient texts → +15 science  
> C) Trap! → scout takes damage  

**Barbarian camp (spawns at distance):**

> Barbarians sighted!  
> A) Attack → chance-based outcome, reward on win  
> B) Bribe → pay gold, camp disperses  
> C) Ignore → raiders arrive in N turns  

**Event rules (draft):**

- No more than 1 event every 3–10 turns  
- Outcomes deterministic per seed + turn (for shareable runs)  

---

## 19. Victory & defeat

### 19.1 Victory types (prioritize one for MVP, add others later)

| Type | Condition (examples) |
|------|----------------------|
| **Conquest** | Eliminate all hostile capitals. |
| **Score** | Highest score at turn limit. |
| **Economic / wonder** | Accumulate milestone or hold objective hex N turns. |
| **Scenario** | Custom win tied to event chain. |

### 19.2 Defeat

- Lose capital / last city, fail siege scenario, hit **defeat event**, or **abandon run**.

### 19.3 Stalemate protection

- Optional **turn limit** with score resolution; **anti-stall** events on long peace.

---

## 20. User interface & UX

### 20.1 HUD

- Resources, research progress, turn number, **End Turn** (with optional “unmoved units” warning).  
- **Seed** visible or copyable from pause/summary.

### 20.2 Map interaction

- Selection ring, path preview, cost tooltip, danger overlay (optional).  
- Camera: existing pan/zoom/rotate; **WASD** pan; ensure UI focus does not steal gameplay keys.

### 20.3 Screens

- **Main menu:** new run, seed entry, settings, credits.  
- **In-run pause:** resume, restart, concede, **how to play** one-pager.  
- **City panel (lite):** yields, queue, build list.  
- **Unit panel:** stats, actions, skip turn.

### 20.4 Onboarding

- **First-run** guided prompts tied to real objectives (move scout, settle, end turn).  
- No wall of text; **contextual** tooltips.

---

## 21. Audio, VFX, and readability

- **Audio:** subtle UI clicks; combat stingers; ambient loop that does not obscure warnings.  
- **VFX:** hit flashes, capture poofs, siege crack—must not obscure hex readability.  
- **Color-blind** considerations for ownership and danger (patterns, not color alone).

---

## 22. Accessibility & settings

- Remappable keys (including WASD and camera).  
- **Color-blind modes** (if team colors matter).  
- **Reduce motion** / skip combat animations.  
- **Large UI** scale for web.  
- Subtitles for any voiced content (if ever added).

---

## 23. Technical design alignment

- **Renderer:** Three.js WebGPU stack from hex-map-wfc; gameplay **must not** live inside shaders.  
- **Simulation:** deterministic **game state** under `src/game/` (and siblings); **pure rules** testable without WebGPU.  
- **Bridge:** map `cubeKey` ↔ selection, overlays for borders/fog/units.  
- **Persistence:** JSON save of state + seed + turn + RNG stream id (when exposed).  
- **Performance:** target stable **60 FPS** on mid desktop; **fallback** plan for non-WebGPU browsers before broad launch.  
- **Networking:** **not** assumed for MVP; all design is **single-player first**.

### 23.6 Performance targets

**Frame rate:**

- 60 FPS on mid-range desktop GPU  
- 30 FPS on integrated graphics baseline acceptable  

**Turn time (simulation + AI):**

- Early game: < 0.5s  
- Mid game: < 1.0s  
- Late game: < 2.0s  

---

## 24. Content budget & data-driven defs

Recommended **data tables** (JSON or TS modules):

- `terrain.json` — movement/defense/yield tags keyed to engine tile categories.  
- `units.json`, `buildings.json`, `tech.json` — costs, stats, prerequisites.  
- `events.json` — weights, conditions, options.  
- `factions.json` — modifiers + AI tag.

**Content pipeline:** start with **10–20 hexes of hand-tuned scenario** before balancing infinite procedural.

---

## 25. MVP vs later

### 25.1 MVP (vertical slice → first public build)

**Playable content (draft):**

- 1 fixed seed (tutorial) + a small set of random seeds for replayability  
- Small map for MVP (tight arc; avoid 10-hour campaigns)

**Must-have features:**

- Turn-based loop with **End Turn**  
- 1 player, 1 AI opponent  
- 3 unit types: Scout, Militia, Archer  
- 3 buildings: Farm, Mine, Barracks  
- 5 tech nodes (small, readable tree)  
- Melee + ranged combat (keep rules minimal)  
- Simple resources: Gold + Food (plus production abstraction)  
- Territory system and basic fog of war  
- Win: destroy / overrun enemy capital  
- Loss: lose capital  

**Nice-to-have (if time):**

- Walls tier 1  
- Small events system (3–5 events)  
- Run summary screen with seed sharing  

### 25.2 Phase 2

- Ranged combat, more units, buildings, **fort/siege** v1, richer events.  
- Meta unlocks, daily seed, **save/load**.

### 25.3 Phase 3+

- Diplomacy lite, naval/embark, elevation LoS, multiplayer (only with dedicated plan).

---

## 26. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Scope explosion (“mini Civ”) | Lock MVP in §25; **non-goals** in §27. |
| Hex gameplay misaligned with art mesh | Authoritative **logical hex** = `globalCells`; visuals follow. |
| WebGPU reach | Telemetry + **fallback** renderer or reduced FX mode. |
| AI feels random or unfair | Telemetry on player loss reasons; telegraph aggression; difficulty as **knobs** not cheats. |
| Asset license blocks shipping | Legal review before marketing or paid release. |
| Run length drift | Playtest median session; tune **pressure** and **turn limit**. |

---

## 27. Non-goals (initial releases)

- Full **multiplayer** real-time or async.  
- **Campaign** with hours of scripted narrative.  
- **Freeform** castle wall drawing at full Stronghold fidelity.  
- **Civ V–parity** diplomacy, religion, tourism, espionage.  
- **AoE**-parity economy micro and unit formation tactics in real time.

---

## 28. Open questions

*To resolve in design reviews before implementation lock:*

1. **Global vs per-city** resource stockpiles?  
2. **Worker** model: explicit unit vs abstract “worked tiles”?  
3. **Water:** naval in v1 or hard “impassable until tech X”?  
4. **City capture:** always raze/flip/puppet— which for MVP?  
5. **Turn structure:** simultaneous move resolution or strict initiative?  
6. **Price / monetization** model and its constraints on content cadence.

### 28.1 Open questions (resolved, draft)

| Question | Resolution | Rationale |
|----------|------------|-----------|
| Global vs per-city resources | **Global** (MVP) | Simpler UI, clearer decisions |
| Worker model | **Explicit workers** (later) | Better AoE fantasy + raiding targets |
| Water | **Impassable** (MVP) | Naval adds complexity; revisit later |
| City capture | **Always capture** (MVP) | Simplest to explain and balance |
| Turn structure | **Phased resolution** (MVP) | Fast and predictable |

---

## 29. Glossary

| Term | Meaning |
|------|---------|
| **Run** | Single playthrough from seed to outcome. |
| **Turn** | Atomic game tick after player (and AI) orders are locked. |
| **Hex key** | Stable id for a cell in cube coordinates (`cubeKey`). |
| **globalCells** | Authoritative set/map of existing world hexes from WFC solve. |
| **Pulse** | Post–End Turn animated resolution phase. |
| **Fort level** | Abstract defense/siege stat before full wall geometry. |

---

## 30. Technical debt & testing strategy

### 30.1 Testing layers

- **Unit tests:** combat resolution, economy calculations, tech prerequisites, victory/defeat checks  
- **Integration tests (later):** end-to-end turn cycle, seed reproducibility, save/load roundtrip  

### 30.2 Data-driven enforcement

- Units/buildings/tech/events defined in data tables (JSON or TS modules)  
- Schema validation on load  

### 30.3 Determinism requirements

- All RNG is seeded (no `Math.random()` in gameplay)  
- Combat variance (if any) derived from seed + deterministic streams  
- Events deterministic from seed + turn  


---

*End of document. Update this GDD when scope changes; keep [GAMEPLAN.md](../GAMEPLAN.md) in sync for milestone dates and engineering priorities.*
