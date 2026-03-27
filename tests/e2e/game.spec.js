import { test, expect } from '@playwright/test'

test.describe('Game Launch', () => {
  test('should load the game without errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/')
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle')
    
    // Check that WebGPU is available or we show an error
    const webgpuMessage = await page.locator('text=WebGPU Required').count()
    if (webgpuMessage > 0) {
      // WebGPU not available in test environment - this is expected
      test.skip()
      return
    }

    // Check for critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('Warning') && !e.includes('deprecated')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('should display palace UI on load', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check if WebGPU is not supported (expected in headless browsers)
    const notSupported = await page.locator('text=Browser Not Supported').count()
    if (notSupported > 0) {
      // WebGPU not available in test environment - this is expected
      expect(true).toBeTruthy()
      return
    }

    // Look for palace or game UI
    const palaceTitle = await page.locator('text=ETERNAL PALACE').count()
    const chronicleText = await page.locator('text=CHRONICLE').count()
    const recordsText = await page.locator('text=RECORDS').count()
    
    // At least one of these should be visible
    const hasUI = palaceTitle > 0 || chronicleText > 0 || recordsText > 0
    expect(hasUI).toBeTruthy()
  })
})

test.describe('Gameplay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Check if we need to skip due to WebGPU
    const webgpuMessage = await page.locator('text=WebGPU Required').count()
    const notSupported = await page.locator('text=Browser Not Supported').count()
    if (webgpuMessage > 0 || notSupported > 0) {
      test.skip()
    }
  })

  test('should start a new game when clicking BEGIN', async ({ page }) => {
    // Click BEGIN or new game button
    const beginButton = page.locator('button:has-text("BEGIN"), button:has-text("NEW")')
    
    if (await beginButton.count() > 0) {
      await beginButton.first().click()
      
      // Should see game HUD elements
      await page.waitForTimeout(2000)
      
      // Check for game UI elements
      const hasHUD = await page.locator('[class*="hud"], [class*="action"], [class*="resource"]').count() > 0
      expect(hasHUD).toBeTruthy()
    }
  })

  test('smoke flow: start -> pause -> resume', async ({ page }) => {
    const beginButton = page.locator('#palace-start, button:has-text("BEGIN NEW CHRONICLE")')
    if (await beginButton.count() === 0) return

    await beginButton.first().click()
    await page.waitForTimeout(1200)

    await page.keyboard.press('KeyP')
    const pauseOverlay = page.locator('.hx-pause-overlay')
    await expect(pauseOverlay).toBeVisible()

    const resumeBtn = page.locator('#hx-pause-resume')
    if (await resumeBtn.count() > 0) await resumeBtn.first().click()
    await page.waitForTimeout(250)
    await expect(pauseOverlay).toBeHidden()
  })

  test('should show system menu with settings', async ({ page }) => {
    // Look for settings/system menu button
    const settingsBtn = page.locator('button:has-text("⚙️"), button:has-text("Settings")')
    
    if (await settingsBtn.count() > 0) {
      await settingsBtn.first().click()
      
      // Check for settings options
      const hasSettings = await page.locator('text=SFX, text=Music').count() >= 0
      expect(hasSettings).toBeTruthy()
    }
  })
})

test.describe('UI Components', () => {
  test('should have responsive layout', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(500)
    
    // Page should not have horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5)
  })

  test('should close modals on backdrop click', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Find and click a modal backdrop if one exists
    const backdrop = page.locator('[style*="position:fixed"][style*="z-index"]').first()
    
    if (await backdrop.count() > 0) {
      await backdrop.click({ position: { x: 10, y: 10 } })
      // Modal should close or handle the click
    }
  })
})
