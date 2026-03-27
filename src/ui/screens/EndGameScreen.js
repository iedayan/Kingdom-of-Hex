import { saveManager } from '../../game/SaveManager.js'
import { Sounds } from '../../core/audio/Sounds.js'

export function createEndGameScreen(app, isWin) {
  const stats = saveManager.getStats()
  const victoryReason = app.game?.victoryReason || 'treasury'
  const lpGain = isWin 
    ? Math.floor((app.game?.resources?.gold || 0) / 10) + (app.game?.resources?.science || 0)
    : Math.floor(((app.game?.resources?.gold || 0) / 20) + ((app.game?.resources?.science || 0) / 2))

  const overlay = document.createElement('div')
  overlay.id = 'endgame-overlay'
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99998;
    background: rgba(0,0,0,0.9);
    display: flex; align-items: center; justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
    animation: fadeIn 0.5s ease;
  `

  overlay.innerHTML = `
    <style>
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      @keyframes confetti { 0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
    </style>
    <div style="
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 2px solid ${isWin ? '#4ecdc4' : '#ff6b6b'};
      border-radius: 20px;
      padding: 2.5rem;
      max-width: 450px;
      width: 90%;
      text-align: center;
      color: white;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      animation: slideUp 0.5s ease 0.2s both;
    ">
      <div style="font-size:80px; margin-bottom:1rem; animation: pulse 2s infinite;">
        ${isWin ? '🏆' : '💀'}
      </div>
      
      <h1 style="
        color:${isWin ? '#4ecdc4' : '#ff6b6b'}; 
        font-size:2.5rem; 
        margin:0 0 0.5rem;
        text-shadow: 0 0 20px ${isWin ? 'rgba(78,205,196,0.5)' : 'rgba(255,107,107,0.5)'};
      ">
        ${isWin ? 'VICTORY!' : 'DEFEAT'}
      </h1>
      
      <p style="color:#ccc; margin:0 0 1.5rem; font-size:1rem;">
        ${isWin 
          ? victoryReason === 'knowledge'
            ? 'Your scholars have secured a learned victory for the realm.'
            : victoryReason === 'fortress'
              ? 'Your bastions held. The frontier became an iron wall.'
              : 'Your kingdom prospers! The Eternal Palace stands strong.'
          : app.game?.loseReason === 'capital' 
            ? 'The Eternal Palace has fallen...' 
            : 'Time ran out before you could reach 1000 gold.'}
      </p>

      <div style="
        background:rgba(255,255,255,0.05);
        border-radius:12px;
        padding:1.25rem;
        margin-bottom:1.5rem;
      ">
        <h3 style="color:#ffd93d; margin:0 0 1rem; font-size:1rem;">Battle Report</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; text-align:left; font-size:0.9rem;">
          <div style="color:#888;">Turns Played:</div>
          <div style="color:white;">${app.game?.turn || 0}</div>
          <div style="color:#888;">Gold Earned:</div>
          <div style="color:#ffd700;">${app.game?.resources?.gold || 0}</div>
          <div style="color:#888;">Science Gained:</div>
          <div style="color:#00ffff;">${app.game?.resources?.science || 0}</div>
          <div style="color:#888;">LP Earned:</div>
          <div style="color:#4ecdc4;">+${lpGain}</div>
          <div style="color:#888;">Victory Path:</div>
          <div style="color:${isWin ? '#4ecdc4' : '#888'};">${isWin ? victoryReason.toUpperCase() : 'FAILED'}</div>
        </div>
      </div>

      <div style="
        background:rgba(78,205,196,0.1);
        border-radius:12px;
        padding:1rem;
        margin-bottom:1.5rem;
      ">
        <div style="display:flex; justify-content:space-around; font-size:0.85rem;">
          <div>
            <div style="color:#888;">Total LP</div>
            <div style="color:#4ecdc4; font-size:1.5rem; font-weight:bold;">${stats.lp + (isWin ? lpGain : 0)}</div>
          </div>
          <div>
            <div style="color:#888;">Wins</div>
            <div style="color:#4ecdc4; font-size:1.5rem; font-weight:bold;">${stats.wins}</div>
          </div>
          <div>
            <div style="color:#888;">Win Rate</div>
            <div style="color:#4ecdc4; font-size:1.5rem; font-weight:bold;">${stats.winRate}%</div>
          </div>
        </div>
      </div>

      <div style="display:flex; gap:0.75rem; flex-direction:column;">
        <button id="play-again" style="
          padding:0.875rem;
          border-radius:10px;
          border:none;
          background:linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
          color:white;
          font-size:1rem;
          font-weight:bold;
          cursor:pointer;
          transition:transform 0.2s;
        ">
          Play Again
        </button>
        <button id="main-menu" style="
          padding:0.75rem;
          border-radius:10px;
          border:1px solid #444;
          background:transparent;
          color:#888;
          font-size:0.9rem;
          cursor:pointer;
        ">
          Return to Title
        </button>
      </div>
    </div>
  `

  if (isWin) {
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div')
      confetti.style.cssText = `
        position:fixed;
        width:10px;
        height:10px;
        background:${['#4ecdc4', '#ffd93d', '#ff6b6b', '#ffd700', '#00ffff'][Math.floor(Math.random() * 5)]};
        left:${Math.random() * 100}%;
        animation: confetti ${2 + Math.random() * 2}s linear forwards;
        animation-delay:${Math.random() * 0.5}s;
        z-index:99997;
      `
      overlay.appendChild(confetti)
    }
  }

  document.body.appendChild(overlay)

  document.getElementById('play-again').onclick = () => {
    overlay.remove()
    location.reload()
  }

  document.getElementById('main-menu').onclick = () => {
    saveManager.clearSession()
    overlay.remove()
    location.reload()
  }

  if (isWin) {
    Sounds.play('good')
  }

  return overlay
}
