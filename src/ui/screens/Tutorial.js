export function createTutorialModal(app) {
  const overlay = document.createElement('div')
  overlay.id = 'tutorial-overlay'
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
  `

  const modal = document.createElement('div')
  modal.style.cssText = `
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 1px solid #4ecdc4;
    border-radius: 16px;
    padding: 2rem;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    color: white;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  `

  modal.innerHTML = `
    <div style="text-align:center; margin-bottom:1.5rem;">
      <h2 style="color:#4ecdc4; margin:0 0 0.5rem; font-size:1.8rem;">How to Play</h2>
      <p style="color:#888; margin:0;">Kingdom of Hex</p>
    </div>

    <div style="margin-bottom:1.5rem;">
      <h3 style="color:#ffd93d; margin:0 0 0.5rem; font-size:1.1rem;">🎯 Goal</h3>
      <p style="color:#ccc; margin:0; line-height:1.6;">
        Accumulate <strong style="color:#ffd700;">1,000 Gold</strong> before turn <strong style="color:#4ecdc4;">50</strong> to win. 
        Defend your capital - if enemies capture it, you lose!
      </p>
    </div>

    <div style="margin-bottom:1.5rem;">
      <h3 style="color:#ffd93d; margin:0 0 0.5rem; font-size:1.1rem;">🏗️ Buildings</h3>
      <div style="display:grid; gap:0.5rem; color:#ccc; font-size:0.9rem;">
        <div><strong style="color:#cd853f;">🪓 Lumberjack:</strong> +10 Wood/turn</div>
        <div><strong style="color:#98fb98;">🌾 Farm:</strong> +10 Food/turn</div>
        <div><strong style="color:#c0c0c0;">⛏️ Mine:</strong> +5 Stone/turn</div>
        <div><strong style="color:#ffd700;">💰 Market:</strong> 5 Food → 15 Gold (needs Currency)</div>
        <div><strong style="color:#ff6b6b;">🏰 Tower:</strong> Auto-attacks nearby enemies (needs Ballistics)</div>
        <div><strong style="color:#00ffff;">📚 Library:</strong> +8 Science/turn (needs Scholarship)</div>
      </div>
    </div>

    <div style="margin-bottom:1.5rem;">
      <h3 style="color:#ffd93d; margin:0 0 0.5rem; font-size:1.1rem;">⚔️ Units</h3>
      <div style="display:grid; gap:0.5rem; color:#ccc; font-size:0.9rem;">
        <div><strong style="color:#4ecdc4;">🧭 Scout:</strong> Fast (3 MP), 10 HP, 2 ATK</div>
        <div><strong style="color:#ff6b6b;">🏹 Archer:</strong> Ranged (2 range), 8 HP, 4 ATK</div>
        <div><strong style="color:#ffd93d;">🛡️ Knight:</strong> Heavy hitter, 20 HP, 6 ATK</div>
      </div>
    </div>

    <div style="margin-bottom:1.5rem;">
      <h3 style="color:#ffd93d; margin:0 0 0.5rem; font-size:1.1rem;">🔬 Research</h3>
      <p style="color:#ccc; margin:0; font-size:0.9rem; line-height:1.6;">
        Click the beaker icon to research technologies. 
        <strong style="color:#00ffff;">Scholarship</strong> unlocks Libraries for more Science.
        <strong style="color:#4ecdc4;">Archery</strong> unlocks Archers and Ballistics.
      </p>
    </div>

    <div style="margin-bottom:1.5rem;">
      <h3 style="color:#ffd93d; margin:0 0 0.5rem; font-size:1.1rem;">⌨️ Controls</h3>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.25rem; color:#ccc; font-size:0.85rem;">
        <div><kbd style="background:#333;padding:2px 6px;border-radius:4px;">Space</kbd> End Turn</div>
        <div><kbd style="background:#333;padding:2px 6px;border-radius:4px;">T</kbd> Tech Tree</div>
        <div><kbd style="background:#333;padding:2px 6px;border-radius:4px;">1-6</kbd> Build Menu</div>
        <div><kbd style="background:#333;padding:2px 6px;border-radius:4px;">?</kbd> Help</div>
        <div><kbd style="background:#333;padding:2px 6px;border-radius:4px;">Home</kbd> Center Camera</div>
        <div><kbd style="background:#333;padding:2px 6px;border-radius:4px;">Tab</kbd> Cycle Units</div>
      </div>
    </div>

    <div style="text-align:center; margin-bottom:1rem;">
      <p style="color:#666; font-size:0.85rem; margin:0 0 1rem;">
        Tip: Build Farms early for food, then Lumberjacks for economy.
      </p>
      <button id="tutorial-close" style="
        background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
        border: none; padding: 0.75rem 2rem;
        border-radius: 8px; color: white;
        font-size: 1rem; font-weight: bold;
        cursor: pointer; transition: transform 0.2s;
      ">Start Playing!</button>
    </div>
  `

  overlay.appendChild(modal)

  document.getElementById('tutorial-close').onclick = () => {
    overlay.style.opacity = '0'
    overlay.style.transition = 'opacity 0.3s'
    setTimeout(() => overlay.remove(), 300)
    localStorage.setItem('tutorial_seen', 'true')
  }

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      document.getElementById('tutorial-close').click()
    }
  }

  return overlay
}

export function shouldShowTutorial() {
  return localStorage.getItem('tutorial_seen') !== 'true'
}
