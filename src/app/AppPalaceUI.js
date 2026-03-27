export function initPalaceUI(app, deps) {
  const { saveManager, META_UPGRADES, RUN_MODIFIERS, gsap } = deps

  app.palaceOverlay = document.createElement('div')
  app.palaceOverlay.className = 'hx-palace-overlay'

  const renderPalace = () => {
    const d = saveManager.data

    app.palaceOverlay.innerHTML = `
      <div class="hx-palace-overlay__inner">
        <h1 class="hx-palace-title">THE ETERNAL PALACE</h1>
        <div class="hx-palace-subtitle">CHRONICLE PERSISTENCE — META PROGRESS</div>

        <div class="hx-palace-grid">
          <div class="hx-panel hx-panel--glass hx-corner-ticks" style="padding: var(--hx-space-5);">
            <h3 class="hx-font-ui" style="margin:0 0 var(--hx-space-3); color: var(--hx-text-secondary); border-bottom: 1px solid var(--hx-divider); padding-bottom: var(--hx-space-2); font-size: var(--hx-text-sm);">RECORDS</h3>
            <div style="display: flex; flex-direction: column; gap: var(--hx-space-3); font-size: var(--hx-text-sm);">
              <div style="display:flex; justify-content:space-between; gap: var(--hx-space-2);"><span style="color:var(--hx-text-muted)">Runs attempted</span> <b>${d.runs}</b></div>
              <div style="display:flex; justify-content:space-between; gap: var(--hx-space-2);"><span style="color:var(--hx-text-muted)">Kingdoms won</span> <b>${d.wins}</b></div>
              <div style="display:flex; justify-content:space-between; gap: var(--hx-space-2);"><span style="color:var(--hx-text-muted)">Win rate</span> <b>${d.runs > 0 ? Math.round((d.wins / d.runs) * 100) : 0}%</b></div>
              <div style="display:flex; justify-content:space-between; gap: var(--hx-space-2);"><span style="color:var(--hx-text-muted)">Legacy points</span> <b style="color:var(--hx-accent-gold)">${d.lp}</b></div>
            </div>
          </div>

          <div class="hx-panel hx-panel--glass hx-corner-ticks" style="padding: var(--hx-space-5);">
            <h3 class="hx-font-ui" style="margin:0 0 var(--hx-space-3); color: var(--hx-accent-info); border-bottom: 1px solid var(--hx-divider); padding-bottom: var(--hx-space-2); font-size: var(--hx-text-sm);">META-UPGRADES</h3>
            <div style="display: flex; flex-direction: column; gap: var(--hx-space-3);">
              ${Object.entries(META_UPGRADES)
                .map(([id, u]) => {
                  const lvl = d.upgrades[id] ?? 0
                  const cost = saveManager.getUpgradeCost(id)
                  const maxed = lvl >= u.maxLevel
                  return `
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: var(--hx-space-3);">
                <div style="min-width:0;">
                  <div class="hx-font-ui" style="font-weight:600;color:var(--hx-text-primary)">${u.name} <span style="opacity:0.7;font-weight:500">(Lvl ${lvl}/${u.maxLevel})</span></div>
                  <div style="font-size: var(--hx-text-xs); color: var(--hx-text-muted); margin-top: 4px;">${u.desc}</div>
                </div>
                <button type="button" class="hx-btn hx-focusable meta-buy-btn" data-meta-id="${id}" data-meta-cost="${cost}"
                  ${d.lp < cost || maxed ? 'disabled' : ''} style="flex-shrink:0; min-width: 88px;">
                  ${maxed ? 'MAX' : `${cost} LP`}
                </button>
              </div>`
                })
                .join('')}
            </div>
          </div>
        </div>

        <button type="button" id="palace-start" class="hx-btn hx-btn--primary hx-focusable"
          style="margin-top: var(--hx-space-6); padding: var(--hx-space-4) var(--hx-space-6); font-size: clamp(1rem, 2.5vw, 1.25rem); max-width: 100%; width: min(400px, 100%);">
          BEGIN NEW CHRONICLE
        </button>
        <div style="margin-top: var(--hx-space-2); display: flex; gap: var(--hx-space-2); justify-content: center; flex-wrap: wrap;">
          <button type="button" id="palace-random-seed" class="hx-btn hx-btn--ghost hx-focusable">RANDOMIZE SEED</button>
          <button type="button" id="palace-copy-seed" class="hx-btn hx-btn--ghost hx-focusable">COPY SEED</button>
        </div>
        <div class="hx-panel hx-panel--glass hx-corner-ticks" style="margin-top: var(--hx-space-3); padding: var(--hx-space-4); text-align:left;">
          <h3 class="hx-font-ui" style="margin:0 0 var(--hx-space-2); color: var(--hx-accent-info); font-size: var(--hx-text-sm);">RUN MODIFIER (PICK 1)</h3>
          <div style="display:flex; flex-direction:column; gap: var(--hx-space-2);">
            ${RUN_MODIFIERS.map((m) => `
              <button type="button" class="hx-btn hx-focusable run-mod-btn" data-mod-id="${m.id}" style="text-align:left;">
                <b>${m.name}</b><br><span style="opacity:.8; font-size: var(--hx-text-xs);">${m.desc}</span>
              </button>
            `).join('')}
          </div>
        </div>
        ${d.session ? `
        <button type="button" id="palace-continue" class="hx-btn hx-btn--secondary hx-focusable"
          style="margin-top: var(--hx-space-3); padding: var(--hx-space-4) var(--hx-space-6); font-size: 1.25rem; width: min(400px, 100%);">
          CONTINUE CHRONICLE
        </button>` : ''}
        <p class="hx-font-ui" style="margin-top: var(--hx-space-4); font-size: var(--hx-text-xs); color: var(--hx-text-faint); max-width: 32rem; margin-left: auto; margin-right: auto;">
          Gameplay controls appear after you start — expand the map, place buildings, then use End Turn.
        </p>
      </div>
    `

    if (d.session) {
      document.getElementById('palace-continue').onclick = () => app.resumeGame()
    }

    const startBtn = document.getElementById('palace-start')
    const runModButtons = [...app.palaceOverlay.querySelectorAll('.run-mod-btn')]
    const updateRunModVisuals = () => {
      for (const btn of runModButtons) {
        btn.style.background = btn.dataset.modId === app.selectedRunModifier ? 'var(--hx-bg-active)' : 'transparent'
      }
    }
    for (const btn of runModButtons) {
      btn.onclick = () => {
        app.selectedRunModifier = btn.dataset.modId
        updateRunModVisuals()
      }
    }
    updateRunModVisuals()

    startBtn.onclick = () => {
      gsap.to(app.palaceOverlay, {
        opacity: 0,
        duration: 0.85,
        ease: 'power2.inOut',
        onComplete: () => {
          app.palaceOverlay.style.display = 'none'
          app.palaceOverlay.style.opacity = '1'
          app._setGameplayHudVisible(true)
          app.applyMetaToGame()
          app.game?.applyRunModifier?.(app.selectedRunModifier)
        },
      })
    }
    const randomSeedBtn = document.getElementById('palace-random-seed')
    if (randomSeedBtn) {
      randomSeedBtn.onclick = () => {
        const url = new URL(window.location.href)
        url.searchParams.delete('seed')
        window.location.href = url.toString()
      }
    }
    const copySeedBtn = document.getElementById('palace-copy-seed')
    if (copySeedBtn) {
      copySeedBtn.onclick = async () => {
        const seedText = String(app.seed ?? app.game?.seed ?? '')
        if (!seedText) return
        try {
          await navigator.clipboard?.writeText(seedText)
        } catch {}
      }
    }

    for (const btn of app.palaceOverlay.querySelectorAll('.meta-buy-btn')) {
      btn.addEventListener('click', () => app.buyMeta(btn.dataset.metaId, Number(btn.dataset.metaCost)))
    }
  }

  document.body.appendChild(app.palaceOverlay)
  renderPalace()
  app._refreshPalace = renderPalace
}

export function resumeGame(app, deps) {
  const { saveManager, gsap } = deps
  const data = saveManager.data.session
  if (!data) return
  gsap.to(app.palaceOverlay, {
    opacity: 0,
    duration: 0.8,
    onComplete: () => {
      app.palaceOverlay.style.display = 'none'
      app.game.deserialize(data)
      app._setGameplayHudVisible(true)
      app.rebuildVisualsFromSave()
      app.updateGameUI()
      const tileMeshes = []
      for (const grid of app.city.grids.values()) if (grid.hexMesh) tileMeshes.push(grid.hexMesh)
      app.wavesMask.render(app.scene, tileMeshes, app.city.waterPlane, app.city.globalCells)
    },
  })
}

export function rebuildVisualsFromSave(app, deps) {
  const { globalToLocalGrid, HexUtils } = deps
  for (const [cKey, obj] of app.game.objects.entries()) {
    if (['scout', 'archer', 'knight', 'goblin', 'goblin_raider', 'goblin_brute', 'goblin_slinger'].includes(obj.type)) {
      app.unitManager.spawnUnit(cKey, obj.type, obj.owner)
      continue
    }

    const cell = app.city.globalCells.get(cKey)
    if (!cell?.gridKey) continue
    const grid = app.city.grids.get(cell.gridKey)
    const bType = obj.type
    const meshName = bType === 'library' ? 'building_church_yellow'
      : bType === 'market' ? 'building_market_yellow'
      : bType === 'farm' ? 'building_windmill_yellow'
      : bType === 'mine' ? 'mine'
      : bType === 'tower' ? 'building_tower_A_yellow'
      : 'building_home_B_yellow'

    const { gridX, gridZ } = globalToLocalGrid(HexUtils.parse(cKey), grid.globalCenterCube, grid.gridRadius)
    grid.decorations.clearDecorationsAt(gridX, gridZ)
    const pos = grid.getTileLocalPosition(gridX, gridZ)

    const biome = app.game.getBiome(cell.gridKey)
    const biomeVal = biome === 'winter' ? 0.5 : biome === 'wasteland' ? 1.0 : 0.0

    grid.decorations._placeInstance(
      grid.decorations.mesh,
      grid.decorations.geomIds,
      meshName,
      pos.x,
      cell.level * 0.5 + 1.0,
      pos.z,
      0,
      1,
      cell.level,
      biomeVal
    )
  }
}

export function buyMeta(app, id, cost, deps) {
  const { saveManager, Sounds } = deps
  if (saveManager.buyUpgrade(id, cost)) {
    app._refreshPalace()
    Sounds.play('good')
  } else {
    Sounds.play('incorrect')
  }
}

export function applyMetaToGame(app, deps) {
  const { saveManager } = deps
  if (!app.game) return
  app.game.resources.science += saveManager.getUpgradeBonus('science_focus')
  if (saveManager.getUpgradeBonus('starting_scout')) {
    app.game.spawnUnit('0,0,0', 'scout', 'player')
  }
  app.updateGameUI()
}
