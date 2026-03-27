# Launch Guide: Kingdom of Hex

## Step 1: Build the Game

```bash
npm run build
```

This creates a `dist/` folder with your game.

## Step 2: Create Itch.io Account

1. Go to [itch.io](https://itch.io)
2. Click "Register" (top right)
3. Or "Log in" if you already have an account

## Step 3: Create Your Game Page

1. Click your username → "Create new project"
2. **Title**: Kingdom of Hex
3. **Genre**: Strategy / Turn-based / Indie
4. **Has publicly playable demo**: ✅ Yes

## Step 4: Upload Your Game

1. Set **"This file will be played in the browser"**
2. Upload the entire `dist/` folder contents
   - Click "Upload files" and drag ALL files from `dist/`
3. Your main file should be `index.html`

## Step 5: Configure Pricing

**Recommended for launch:**
- **"Pay what you want"** with **$0 minimum**
- This removes payment pressure but allows donations

**Later, you can change to:**
- **"$5"** or **"$10"** if people are playing

## Step 6: Write Your Description

Copy this template:

```
Kingdom of Hex is a turn-based strategy roguelike where you build, research, and defend your kingdom.

🏰 **Build Your Kingdom**
- Lumberjacks, farms, mines, markets, towers, and libraries
- Each building has unique bonuses based on neighbors

⚔️ **Train Units**
- Scouts for exploration
- Archers for ranged attacks  
- Knights for heavy combat

🔬 **Research Technologies**
- Unlock new buildings and units
- Choose your own tech path

🎯 **Win Condition**
- Accumulate 1,000 gold before turn 50
- Defend your capital from goblin waves!

Controls:
- Space: End Turn
- 1-6: Build Menu
- T: Tech Tree
- ?: Help

A procedural hex strategy game built with Three.js.
```

## Step 7: Add Cover Image

Create a 630x500px image:
1. Screenshot your game in action
2. Or use a title card with game name

**Free tools:**
- [Canva.com](https://canva.com) - Easy templates
- [Figma.com](https://figma.com) - Design tool

## Step 8: Publish!

Click **"Save and view page"**

---

## After Launch Checklist

- [ ] Play through the game yourself 3 times
- [ ] Test on Chrome, Firefox, Safari
- [ ] Share the link with 5 friends
- [ ] Post on Twitter/Reddit if you want

---

## Monitoring Feedback

Check your analytics:
```javascript
// In browser console:
Analytics.getMetrics()
```

Check feedback submissions:
```javascript
// View collected feedback:
JSON.parse(localStorage.getItem('feedback_2025-XX-XX') || '[]')
```

---

## Common Issues

**"WebGPU not supported" error:**
- Game requires Chrome 113+, Edge 113+, or Safari 17+
- Add a note: "Best played on Chrome or Edge"

**Game is slow:**
- Lower your graphics settings
- Close other browser tabs

---

## Next Steps After First Players

1. **Read feedback** from the feedback modal
2. **Fix bugs** reported by players
3. **Consider pricing** after 50+ downloads
4. **Add more content** based on requests
