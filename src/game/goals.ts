/** Single source for win/loss pacing and HUD copy. */
export const WIN_GOLD_GOAL = 1000
export const MAX_TURNS = 50

/** World origin / revealed start; goblins path here. */
export const CAPITAL_CUBE_KEY = '0,0,0'
export const CAPITAL_SEAT_NAME = 'Eternal Palace'

export function capitalMissionLines() {
  const [q, r, s] = CAPITAL_CUBE_KEY.split(',').map(Number)
  return {
    title: CAPITAL_SEAT_NAME,
    coords: `${q} · ${r} · ${s}`,
    /** One short HUD line; full rules in `tooltip`. */
    hint: 'Defend the crown hex.',
    tooltip: `Seat of power at (${q}, ${r}, ${s}). You lose if an enemy enters this hex. Gather ${WIN_GOLD_GOAL} gold before turn ${MAX_TURNS} to win.`,
  }
}
