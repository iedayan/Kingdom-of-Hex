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
    background: linear-gradient(145deg, rgba(16, 18, 27, 0.98) 0%, rgba(26, 32, 49, 0.95) 100%);
    border: 1px solid rgba(212, 165, 116, 0.34);
    border-radius: 20px;
    padding: 2rem;
    max-width: 720px;
    max-height: 80vh;
    overflow-y: auto;
    color: white;
    box-shadow: 0 28px 80px rgba(0,0,0,0.6);
  `

  modal.innerHTML = `
    <div style="text-align:center; margin-bottom:1.5rem;">
      <h2 style="color:#d4a574; margin:0 0 0.5rem; font-size:1.95rem; letter-spacing:0.08em; text-transform:uppercase;">Hold the Crown</h2>
      <p style="color:#9aa3b2; margin:0;">Your first five turns decide the whole run.</p>
    </div>

    <div style="margin-bottom:1.5rem;">
      <h3 style="color:#ffd93d; margin:0 0 0.5rem; font-size:1.1rem;">Opening Plan</h3>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:0.75rem; color:#d7dce5; font-size:0.92rem;">
        <div style="padding:0.8rem; border-radius:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);">
          <strong style="display:block; color:#d4a574; margin-bottom:0.35rem;">1. Stabilize food</strong>
          Build a <b>Farm</b> early if you plan to field units or markets.
        </div>
        <div style="padding:0.8rem; border-radius:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);">
          <strong style="display:block; color:#d4a574; margin-bottom:0.35rem;">2. Claim tempo</strong>
          A <b>Scout</b> reveals new land fast. A <b>Library</b> accelerates your first tech spike.
        </div>
        <div style="padding:0.8rem; border-radius:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);">
          <strong style="display:block; color:#d4a574; margin-bottom:0.35rem;">3. Prepare for raids</strong>
          By the first raid, you want an answer: <b>Tower</b>, <b>Archer</b>, or <b>Knight</b>.
        </div>
      </div>
    </div>

    <div style="margin-bottom:1.5rem;">
      <h3 style="color:#ffd93d; margin:0 0 0.5rem; font-size:1.1rem;">Goal</h3>
      <p style="color:#ccc; margin:0; line-height:1.6;">
        Accumulate <strong style="color:#ffd700;">1,000 Gold</strong> before turn <strong style="color:#4ecdc4;">50</strong> to win. 
        Defend your capital - if enemies capture it, you lose!
      </p>
    </div>

    <div style="margin-bottom:1.5rem;">
      <h3 style="color:#ffd93d; margin:0 0 0.5rem; font-size:1.1rem;">Building Roles</h3>
      <div style="display:grid; gap:0.5rem; color:#ccc; font-size:0.9rem;">
        <div><strong style="color:#cd853f;">Lumber:</strong> fuels mines, libraries, and markets. Cluster camps together.</div>
        <div><strong style="color:#98fb98;">Farm:</strong> supports unit upkeep and markets. Chains of farms scale fast.</div>
        <div><strong style="color:#c0c0c0;">Mine:</strong> turns wood into fortification tempo. Great in pairs.</div>
        <div><strong style="color:#ffd700;">Market:</strong> converts food into gold. Strongest inside a developed district.</div>
        <div><strong style="color:#ff6b6b;">Tower:</strong> anchors defense and protects nearby troops.</div>
        <div><strong style="color:#00ffff;">Library:</strong> accelerates your military and economy unlocks.</div>
      </div>
    </div>

    <div style="margin-bottom:1.5rem;">
      <h3 style="color:#ffd93d; margin:0 0 0.5rem; font-size:1.1rem;">Combat Roles</h3>
      <div style="display:grid; gap:0.5rem; color:#ccc; font-size:0.9rem;">
        <div><strong style="color:#4ecdc4;">Scout:</strong> reveal land, finish weak enemies, secure objectives.</div>
        <div><strong style="color:#ff6b6b;">Archer:</strong> punish raiders and warlords from behind your line.</div>
        <div><strong style="color:#ffd93d;">Knight:</strong> break brutes and hold the frontline.</div>
      </div>
    </div>

    <div style="margin-bottom:1.5rem;">
      <h3 style="color:#ffd93d; margin:0 0 0.5rem; font-size:1.1rem;">Research</h3>
      <p style="color:#ccc; margin:0; font-size:0.9rem; line-height:1.6;">
        Click the beaker icon early. 
        <strong style="color:#00ffff;">Scholarship</strong> is the fastest way into libraries and long-term scaling.
        <strong style="color:#4ecdc4;">Archery</strong> opens archers and the path to towers.
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
      <p style="color:#8f99a8; font-size:0.85rem; margin:0 0 1rem;">
        Tip: hover placement tiles and read the hint bubble. It now tells you whether a tile is merely legal or actually strong.
      </p>
      <button id="tutorial-close" style="
        background: linear-gradient(135deg, #d4a574 0%, #b8864f 100%);
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

  document.body.appendChild(overlay)
  return overlay
}

export function shouldShowTutorial() {
  return localStorage.getItem('tutorial_seen') !== 'true'
}
