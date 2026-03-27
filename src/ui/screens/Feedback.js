export function createFeedbackModal(app) {
  const overlay = document.createElement('div')
  overlay.id = 'feedback-overlay'
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
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    color: white;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  `

  modal.innerHTML = `
    <div style="text-align:center; margin-bottom:1.5rem;">
      <h2 style="color:#4ecdc4; margin:0 0 0.5rem; font-size:1.5rem;">Feedback</h2>
      <p style="color:#888; margin:0; font-size:0.9rem;">Help us improve Kingdom of Hex!</p>
    </div>

    <form id="feedback-form" style="display:flex; flex-direction:column; gap:1rem;">
      <div>
        <label style="display:block; color:#ccc; margin-bottom:0.5rem; font-size:0.9rem;">
          How fun was the game? (1-5)
        </label>
        <div style="display:flex; gap:0.5rem;">
          ${[1,2,3,4,5].map(n => `
            <button type="button" class="rating-btn" data-rating="${n}" style="
              width:40px; height:40px; border-radius:8px;
              border:1px solid #444; background:#2a2a3e;
              color:white; font-size:1.2rem; cursor:pointer;
              transition:all 0.2s;
            ">${n}</button>
          `).join('')}
        </div>
      </div>

      <div>
        <label style="display:block; color:#ccc; margin-bottom:0.5rem; font-size:0.9rem;">
          What was confusing or frustrating?
        </label>
        <textarea id="feedback-issues" rows="3" style="
          width:100%; padding:0.75rem; border-radius:8px;
          border:1px solid #444; background:#2a2a3e;
          color:white; font-family:inherit; resize:vertical;
          box-sizing:border-box;
        " placeholder="e.g., 'Not clear how to win', 'UI hard to understand'"></textarea>
      </div>

      <div>
        <label style="display:block; color:#ccc; margin-bottom:0.5rem; font-size:0.9rem;">
          What would you like to see added?
        </label>
        <textarea id="feedback-features" rows="3" style="
          width:100%; padding:0.75rem; border-radius:8px;
          border:1px solid #444; background:#2a2a3e;
          color:white; font-family:inherit; resize:vertical;
          box-sizing:border-box;
        " placeholder="e.g., 'More unit types', 'Different maps'"></textarea>
      </div>

      <div>
        <label style="display:block; color:#ccc; margin-bottom:0.5rem; font-size:0.9rem;">
          Any other comments?
        </label>
        <textarea id="feedback-comments" rows="2" style="
          width:100%; padding:0.75rem; border-radius:8px;
          border:1px solid #444; background:#2a2a3e;
          color:white; font-family:inherit; resize:vertical;
          box-sizing:border-box;
        " placeholder="Open feedback..."></textarea>
      </div>

      <div style="display:flex; gap:0.75rem; margin-top:0.5rem;">
        <button type="button" id="feedback-skip" style="
          flex:1; padding:0.75rem; border-radius:8px;
          border:1px solid #444; background:transparent;
          color:#888; cursor:pointer;
        ">Skip</button>
        <button type="submit" style="
          flex:2; padding:0.75rem; border-radius:8px;
          border:none; background:linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
          color:white; font-weight:bold; cursor:pointer;
        ">Submit Feedback</button>
      </div>
    </form>
  `

  overlay.appendChild(modal)

  let selectedRating = 0

  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.rating-btn').forEach(b => {
        b.style.background = '#2a2a3e'
        b.style.borderColor = '#444'
      })
      btn.style.background = '#4ecdc4'
      btn.style.borderColor = '#4ecdc4'
      selectedRating = parseInt(btn.dataset.rating)
    }
  })

  document.getElementById('feedback-skip').onclick = () => {
    overlay.remove()
    localStorage.setItem('feedback_submitted', 'true')
  }

  document.getElementById('feedback-form').onsubmit = (e) => {
    e.preventDefault()
    
    const feedback = {
      rating: selectedRating,
      issues: document.getElementById('feedback-issues').value,
      features: document.getElementById('feedback-features').value,
      comments: document.getElementById('feedback-comments').value,
      timestamp: Date.now(),
      gameResult: app.game?.phase,
      turnsPlayed: app.game?.turn
    }

    const key = `feedback_${new Date().toISOString().split('T')[0]}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    existing.push(feedback)
    localStorage.setItem(key, JSON.stringify(existing))

    overlay.innerHTML = `
      <div style="text-align:center; padding:2rem;">
        <div style="font-size:3rem; margin-bottom:1rem;">🎉</div>
        <h3 style="color:#4ecdc4; margin:0 0 0.5rem;">Thanks for your feedback!</h3>
        <p style="color:#888; margin:0;">It helps us make the game better.</p>
      </div>
    `

    setTimeout(() => {
      overlay.remove()
      localStorage.setItem('feedback_submitted', 'true')
    }, 2000)
  }

  return overlay
}

export function shouldShowFeedback() {
  if (localStorage.getItem('feedback_submitted') === 'true') return false
  const feedbackCount = parseInt(localStorage.getItem('feedback_count') || '0')
  return feedbackCount < 3
}

export function incrementFeedbackCount() {
  const count = parseInt(localStorage.getItem('feedback_count') || '0')
  localStorage.setItem('feedback_count', String(count + 1))
}
