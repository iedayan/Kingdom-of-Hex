import { DECREES, RUN_MODIFIERS } from './runContent.js'

const PLAYTEST_STORAGE_KEY = 'hx_playtest_runs_v1'
const MAX_STORED_RUNS = 30

function cloneTracks(tracks = []) {
  return tracks.map((track) => ({
    id: track.id,
    label: track.label,
    percent: Math.round(track.percent ?? 0),
    completed: Boolean(track.completed),
    value: track.value ?? 0,
    target: track.target ?? 0,
  }))
}

function getIdentitySummary(runModifier) {
  const identity = RUN_MODIFIERS.find((modifier) => modifier.id === runModifier)
  return {
    id: identity?.id || null,
    name: identity?.name || 'Unsworn Realm',
  }
}

function getDecreeNames(chosenDecrees = []) {
  return chosenDecrees.map((decreeId) => DECREES.find((decree) => decree.id === decreeId)?.name || decreeId)
}

export function buildPlaytestRunSummary(game, outcome = {}) {
  if (!game) return null

  const identity = getIdentitySummary(game.runModifier)
  const objectives = Array.isArray(game.objectives) ? game.objectives : []
  const completedObjectives = objectives.filter((objective) => objective.completed).map((objective) => objective.title)
  const failedObjectives = objectives.filter((objective) => objective.failed).map((objective) => objective.title)
  const researched = game.researched instanceof Set ? [...game.researched] : [...(game.researched || [])]
  const tracks = cloneTracks(game.getVictoryTracks?.() || [])
  const bestTrack = tracks.slice().sort((a, b) => (b.percent || 0) - (a.percent || 0))[0] || null

  return {
    endedAt: new Date().toISOString(),
    seed: String(game.seed ?? ''),
    turn: game.turn ?? 0,
    result: outcome.victory ? 'win' : 'loss',
    loseReason: outcome.reason || game.loseReason || null,
    victoryReason: outcome.victoryReason || game.victoryReason || null,
    identity,
    resources: { ...(game.resources || {}) },
    runStats: { ...(game.runStats || {}) },
    decrees: getDecreeNames(game.chosenDecrees || []),
    completedObjectives,
    failedObjectives,
    researched,
    tracks,
    bestTrack,
  }
}

export function getPlaytestRuns(storage = globalThis.localStorage) {
  if (!storage?.getItem) return []
  try {
    const raw = storage.getItem(PLAYTEST_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function clearPlaytestRuns(storage = globalThis.localStorage) {
  storage?.removeItem?.(PLAYTEST_STORAGE_KEY)
}

export function recordPlaytestRun(game, outcome = {}, storage = globalThis.localStorage) {
  const summary = buildPlaytestRunSummary(game, outcome)
  if (!summary || !storage?.setItem) return summary

  const runs = getPlaytestRuns(storage)
  runs.push(summary)
  const trimmed = runs.slice(-MAX_STORED_RUNS)
  storage.setItem(PLAYTEST_STORAGE_KEY, JSON.stringify(trimmed))
  return summary
}

export function installPlaytestTools(globalScope = globalThis, storage = globalThis.localStorage) {
  if (!globalScope) return
  globalScope.HX_PLAYTEST = {
    runs: () => getPlaytestRuns(storage),
    clear: () => clearPlaytestRuns(storage),
  }
}
