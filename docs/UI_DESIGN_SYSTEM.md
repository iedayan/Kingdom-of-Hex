# HexGame — UI design system (“Obsidian charter”)

**Purpose:** Single reference for how in-game and launcher UI should look and behave.  
**Implementation:** Design tokens live in [`../src/ui/tokens.css`](../src/ui/tokens.css) — import once from the app entry (`main.js`).

---

## 1. Principles

| Principle | Meaning |
|-----------|---------|
| **Map first** | HUD stays secondary to the hex map; no heavy chrome over terrain. |
| **Calm luxury** | Deep neutrals, cool tint, **one** warm accent (gold) for priority. |
| **One-glance hierarchy** | Resources, turn, and primary action readable immediately. |
| **Touch-safe** | Primary bars meet ~44px minimum targets where possible. |
| **Systematic** | Spacing, radius, and type use shared tokens — no one-off magic numbers. |

---

## 2. Visual language

**Mood:** Night council over a living map — void background, subtle glass panels, gold for economy and CTAs.

- **Surfaces:** Near-black with cool bias (`--hx-bg-void`, `--hx-bg-elevated`).
- **Glass:** One recipe: backdrop blur + thin light border (see `.hx-panel--glass` + tokens).
- **Primary accent:** Amber/gold (`--hx-accent-gold`) — currency, “Next turn,” key selection.
- **Secondary accent:** Muted teal for neutral info (`--hx-accent-info`).
- **Danger / success:** Desaturated red and jade — never neon on dark.

**Ornament:** Optional `.hx-corner-ticks` on large panels only; avoid full medieval frames on every control.

**Texture:** If used, ≤2% noise on large panels — not on small buttons.

---

## 3. Typography

| Role | Face | Tokens / usage |
|------|------|----------------|
| **UI / HUD** | **Sora** (with Inter fallback) | `--hx-font-ui`, `.hx-font-ui` |
| **Titles / flavour / seed** | **Fraunces** | `--hx-font-display`, `.hx-font-display` |

**Scale:** Use `--hx-text-xs` through `--hx-text-xl` (fluid `clamp` in `:root`).

**Numbers:** Apply `.hx-tabular` (or `font-variant-numeric: tabular-nums`) to resources and turn counters.

Fonts load from Google Fonts via `index.html` (see links there).

---

## 4. Layout regions

```
┌─────────────────────────────────────────────┐
│  TOP STRIP — resources · mission · meta     │  ~56–72px (token: --hx-strip-height)
├─────────────────────────────────────────────┤
│                                             │
│              MAP (sacred)                    │
│                                             │
├─────────────────────────────────────────────┤
│  BOTTOM — mode · palette · primary CTA      │  ~64–88px (--hx-toolbar-height)
└─────────────────────────────────────────────┘
```

- **Top:** Horizontal chips or low capsules, not tall towers.
- **Bottom:** Segmented mode control + scrollable build palette + one dominant primary button.
- **Detail screens:** Prefer slide-over or bottom sheet over blocking the map.

---

## 5. Spacing, radius, z-index

Defined as CSS variables in `tokens.css`:

- **Spacing:** `--hx-space-1` … `--hx-space-6` (4px grid).
- **Radius:** `--hx-radius-sm|md|lg`, `--hx-radius-pill`.
- **Z-index:** `--hx-z-hud` through `--hx-z-tooltip`; debug GUI remains topmost.

---

## 6. Motion

- **Panel enter:** opacity + small translate (~6px), **180–260ms**, `--hx-ease-out`.
- **Feedback:** One-shot animations on state change; no endless pulses on the map stack.
- **`prefers-reduced-motion`:** Durations collapse to near-zero in `tokens.css`.

---

## 7. Accessibility

- **Contrast:** Verify gold on void for AA; lighten `--hx-accent-gold` if audits fail.
- **Focus:** Use `.hx-focusable` on interactive elements for visible `:focus-visible` rings.
- **Icons:** Pair critical actions with text (turn, build mode).
- **Color-blind:** Do not rely on red/green alone — use shape/pattern in selection states.

---

## 8. Using the tokens in code

### Import

```javascript
// src/main.js
import './ui/tokens.css'
```

### Inline styles (existing HUD)

Prefer tokens over raw hex:

```javascript
el.style.borderColor = 'var(--hx-border-subtle)'
el.style.color = 'var(--hx-text-primary)'
el.style.fontFamily = 'var(--hx-font-ui)'
```

### Utility classes

| Class | Use |
|-------|-----|
| `.hx-panel` `.hx-panel--glass` | Frosted card / strip |
| `.hx-btn` `.hx-btn--primary` `.hx-btn--ghost` | Actions |
| `.hx-chip` `.hx-chip__value` | Resource lines |
| `.hx-text-muted` `.hx-tabular` | Typography tweaks |
| `.hx-corner-ticks` | Optional panel ornament |

Prefix **`hx-`** avoids clashes with libraries (e.g. lil-gui).

---

## 9. Related documents

- [GAME_DESIGN.md](./GAME_DESIGN.md) — game UX sections and HUD expectations  
- [GAMEPLAN.md](../GAMEPLAN.md) — delivery phases  

---

## 10. Revision

When changing the palette or scale, update **`src/ui/tokens.css` first**, then adjust this doc’s prose if the concept shifts (e.g. new accent for a second faction theme).
