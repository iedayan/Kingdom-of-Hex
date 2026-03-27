/**
 * Status line + console logging without importing App (avoids circular deps).
 * Relies on window.app being set by App constructor.
 */

export function setStatus(text) {
  const el = typeof window !== 'undefined' ? window.app?.statusElement : null
  if (el) el.textContent = text
}

export function setStatusAsync(text) {
  setStatus(text)
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
}

export function log(text, style = '') {
  if (style) console.log(`%c${text}`, style)
  else console.log(text)
  setStatus(text)
}
