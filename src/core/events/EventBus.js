/**
 * EventBus - Simple pub/sub event system for decoupled game communication.
 * 
 * Usage:
 *   EventBus.emit('turnEnd', { turn: 5, resources: {...} })
 *   EventBus.on('turnEnd', (data) => console.log('Turn ended:', data.turn))
 *   EventBus.off('turnEnd', handler) // Remove specific handler
 *   EventBus.clear() // Remove all handlers
 */

const handlers = new Map()

export const EventBus = {
  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} handler - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    if (!handlers.has(event)) {
      handlers.set(event, new Set())
    }
    handlers.get(event).add(handler)
    return () => this.off(event, handler)
  },

  /**
   * Subscribe once (auto-unsubscribes after first emission)
   * @param {string} event - Event name
   * @param {Function} handler - Callback function
   */
  once(event, handler) {
    const wrapper = (data) => {
      this.off(event, wrapper)
      handler(data)
    }
    this.on(event, wrapper)
  },

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} handler - Specific handler to remove (optional)
   */
  off(event, handler) {
    if (!handlers.has(event)) return
    if (handler) {
      handlers.get(event).delete(handler)
    } else {
      handlers.delete(event)
    }
  },

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (!handlers.has(event)) return
    for (const handler of handlers.get(event)) {
      try {
        handler(data)
      } catch (error) {
        console.error(`[EventBus] Handler error for "${event}":`, error)
      }
    }
  },

  /**
   * Remove all event handlers
   */
  clear() {
    handlers.clear()
  },

  /**
   * Get number of handlers for an event (for debugging)
   * @param {string} event - Event name
   * @returns {number} Number of handlers
   */
  handlerCount(event) {
    return handlers.has(event) ? handlers.get(event).size : 0
  },
}

export default EventBus
