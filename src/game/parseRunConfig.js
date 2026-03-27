import { z } from 'zod'

const runConfigSchema = z.object({
  seed: z.number().int().nonnegative().nullable(),
})

/**
 * Parse roguelike seed from a query string (testable without `window`).
 * @param {string} search e.g. `window.location.search` or `'?seed=42'`
 */
export function parseRunConfigFromSearch(search) {
  const params = new URLSearchParams(search)
  const seedStr = params.get('seed')
  if (seedStr === null || seedStr === '') {
    return runConfigSchema.parse({ seed: null })
  }
  const n = Number(seedStr)
  const seed = Number.isFinite(n) ? Math.floor(Math.abs(n)) : null
  return runConfigSchema.parse({ seed })
}

/**
 * URL/query config for a single run (roguelike seeding, debug flags).
 */
export function parseRunConfig() {
  return parseRunConfigFromSearch(window.location.search)
}
