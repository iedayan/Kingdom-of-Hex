# Kingdom of Hex

A turn-based strategy roguelike where you build a medieval kingdom, defend against goblin raids, and accumulate 1000 gold to win.

**Procedurally generated hex worlds** with Wave Function Collapse, built on Three.js/WebGPU.

## Quick Start

```bash
npm install
npm run dev
```

Requires a **WebGPU-capable browser** (Chrome 113+, Edge 113+).

## How to Play

1. **Build Economy** - Place Lumberjacks, Farms, and Mines to generate resources
2. **Deploy Units** - Train Scouts, Archers, and Knights to defend your kingdom
3. **End Turn** - Collect income and trigger enemy waves
4. **Survive** - Defend against goblin raids every 5 turns
5. **Win** - Accumulate 1000 gold before turn 50

### Controls
- **1-6**: Select buildings (Lumber, Farm, Mine, Market, Tower, Library)
- **U/A/K**: Deploy units (Scout, Archer, Knight)
- **Space**: End turn
- **Escape**: Cancel selection
- **Tab**: Cycle through your units
- **?**: Show all controls

### Tips
- Scouts have high movement - use them to explore and find good building spots
- Markets generate gold but consume food
- Towers auto-attack adjacent enemies
- Upgrade tech to unlock advanced buildings and units

## Features

- **Procedural Maps** - Each run generates a unique hex world
- **Meta-Progression** - Earn Legacy Points (LP) to unlock permanent upgrades
- **Enemy Intent System** - See what enemies plan to do before they act
- **Resource Management** - Balance gold, wood, food, stone, and science
- **Tech Tree** - Research technologies to unlock new buildings and units

## Project Structure

| Path | Role |
|------|------|
| `src/App.js` | Main app, WebGPU setup, game orchestration |
| `src/game/` | Game logic (GameSession, Combat, AI, Economy) |
| `src/ui/` | UI modules (`hud`, `screens`, shared styles) |
| `src/hexmap/` | WFC generation, hex rendering, interaction |
| `src/core/` | Core systems (audio, events, input, analytics, logging) |
| `src/gameplay/` | Gameplay rules and map mechanics |

## Development

```bash
npm test          # Run unit tests
npm run build     # Production build
npm run e2e       # End-to-end tests (requires dev server)
```

### Debug Options
- `?seed=XXXXX` - Fixed seed for reproducible maps
- `?debug=1` - Enable debug mode and FPS counter

## Technical Stack

- **Three.js + WebGPU** - 3D rendering
- **Wave Function Collapse** - Procedural terrain
- **Vite** - Build tooling
- **Vitest** - Unit testing
- **Playwright** - E2E testing

## Credits

- [felixturner/hex-map-wfc](https://github.com/felixturner/hex-map-wfc) - Base map tech
- [KayKit Medieval Hexagon Pack](https://kaylousberg.itch.io/kaykit-medieval-hexagon) - Tile assets
- [Maxim Gumin's WFC](https://github.com/mxgmn/WaveFunctionCollapse) - Wave Function Collapse

## License

[MIT](LICENSE)
