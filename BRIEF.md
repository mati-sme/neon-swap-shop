# Neon Swap Shop — build brief

Build an ORIGINAL phone-first mobile web game (vanilla HTML/CSS/JS, no build step, no external CDNs, no paid APIs) in this folder.
It is inspired by the loop of the PC game "Probably Stolen" (cyberpunk pixel-art shopkeeper sim) but must NOT copy its names, characters, text or assets.
Players include kids aged 4 and 6: NON-GORY, no weapons, drugs, organs, contraband, shooting or injuries. Keep it cozy-cyberpunk and funny.

## What the inspiration does (for reference only)
Side-on pixel-art shop on a space station's lower levels. Each day: stock the display case, open the shutter, call customers one by one to a
counter; they want to buy or sell items. You drag goods to a negotiation counter, haggle (better prices vs reputation), inspect items with a
magnifying glass against a handbook to catch counterfeits (Papers, Please-like "spot the difference"), appraise rare items, and handle a
grid inventory. Rent rises weekly; goal is to buy out the shop and expand. At night you sleep (machines craft overnight) or go scavenging
in a junk dump with a limited number of digs and a bag that must hold the haul. Fun = every customer is a small gamble, detective-style
inspection, the "find a gem in junk" scavenging rush, and steadily growing the shop.

## Our adaptation: "Neon Swap Shop"
You are a friendly robot-ish shopkeeper running a swap shop on a neon space station. Portrait 390x844 target, scales to any phone.
Chunky procedural PIXEL ART drawn on canvas (low-res offscreen canvas e.g. 195x422 or similar scaled up with imageSmoothingEnabled=false),
neon cyberpunk palette (magenta/cyan/purple on dark), cute customers (aliens, robots, cats in spacesuits, etc.).

### Camera / movement
3/4 top-down view of a small shop room. The player character walks with an INVISIBLE FLOATING JOYSTICK: touch anywhere on the play area
(not on UI buttons) and drag; the stick origin is where the finger went down; show only a faint ring+knob while touching; analog speed.
NO d-pad. Desktop fallback: WASD/arrows + mouse drag works like touch. Reuse/adapt the joystick approach from
/workspace/projects/scrap-nest/js/main.js (search "joystick") but make it floating (spawn at touch point).
Walking near a station shows a big round context ACTION button (icon) bottom-right; tap it to interact. Auto-interact is not needed.

### Stations in the shop (top-down room)
- Counter + bell: customers queue outside the shutter and walk to the counter. Interact to serve the next customer.
- Display shelf: choose which items are on display (few slots, upgradeable). Displayed items attract buying customers that want them.
- Workbench: repair/clean junk into better items (short timer, plays a satisfying animation), or combine 3 same items into a shinier tier.
- Storage box: inventory grid view (simple slot grid, not tetris shapes).
- Door to the Junk Dump (night/any time once the day's customers are done): scavenge mode.
- Bed/sleep pod: end the day -> summary screen with coins earned, XP, rewards, then next day.

### Customer trade (core loop, quick, icon-first)
A customer card pops up with portrait, a speech-bubble icon of what they want (BUY item X / SELL you item Y), and an offered price.
Options as big icon buttons: Accept ✓, Haggle (↔), Inspect (🔍, for sell offers), No ✗.
- Haggle: a moving needle on a colored bar; tap to stop. Green = big better price, yellow = small, red = customer gets grumpy (price stays, small mood/rep loss — never harsh).
- Inspect (spot-the-fake): show the item big next to a "genuine" reference from the Handbook; fakes differ in 1 detail (color of a part,
  missing logo star, wrong number of buttons, etc. — procedurally drawn). Player taps "Real" or "Fake"; or taps the differing area. Correct catch
  of a fake = bonus coins + reputation + sparkle; mistaken accusation = small rep loss. Early days have no fakes; introduce them gently from day 2-3.
- Rare items occasionally: "Appraise" mini-game (tap 3 hidden marks on the item to reveal value) -> big payout jackpot moment.
- Some customers are VIPs (gold glow) with bigger budgets. Occasional "Helper" requests (give a cheap item to a poor kid robot for free = reputation hearts + sticker). Make choices kid-readable with icons.
Item set: ~30 kid-friendly items in tiers (bolts, toaster, retro game cartridge, plush alien, lava lamp, hover skates, robot pet, star crystal,
antique space helmet, golden gear...). Each has base value; prices fluctuate with a daily "station news" event shown as an icon banner
(e.g. "Cargo ship docked: gadgets cheap today").

### Scavenge mode (Junk Dump)
A separate small scrolling top-down map, same joystick. Glowing dig spots; walk onto one and tap the dig button; a quick "tap to dig"
3-tap animation then loot pops out with a rarity flash (common/rare/epic/legendary). Limited digs per trip (start 5, upgradeable) and a bag
capacity (start 6). Friendly hazard only: little dust bunnies / sleepy junk-bots to walk around (bumping just makes you drop 1 coin, no damage).
Always guarantee at least something decent per trip (pity timer for rares).

### Progression that NEVER stalls + frequent dopamine
- Coins, XP and Shop Level. Level up often (first levels in ~1-2 min), every level gives a reward chest + unlocks something visible.
- Weekly "Station Fee" (rent) goal shown as a progress bar. If short, the landlord bot gives a friendly extension with a small fee — NO game over, never lose save.
  Paying the fee/buyout goal advances the "Shop Rank" (Stall -> Kiosk -> Shop -> Mega Store -> Station Icon...), each rank visibly expands/redecorates the room and adds slots.
- Upgrades shop (icon grid): more display slots, bigger bag, more digs, faster walk, better haggle green zone, magnifier hint, workbench speed,
  Helper Bot that auto-serves simple customers, neon decorations (purely cosmetic, cheap, satisfying). Costs scale gently (~1.15-1.35x) so there is always something affordable within ~1 minute of play.
- Collection Book of all items (silhouettes until found) with completion rewards; stickers/achievements popups.
- Daily login gift, streak combos for consecutive good trades (x2, x3 coin multiplier with juicy number popups), confetti, coin fly-to-counter animation, screen shake light, WebAudio blips (synthesized, mute toggle).
- Simulate the economy mentally: from a fresh save, a player should hit a new reward at least every ~30-60s and never reach a state with no money, no items and no way forward (scavenging is always free and always yields sellable stuff).

### UI
Icon-first, big touch targets (>=48px), minimal text (short words are fine for a 6-year-old reading level). Top HUD: coins, level/XP bar, day + rent bar, gear/menu. 
Use safe-area insets, prevent page scroll/zoom/double-tap zoom, touch-action:none on canvas, no text selection. 60fps on phones: one requestAnimationFrame loop, dt-based, avoid allocations in the hot loop, cap devicePixelRatio scaling.
First-run 3-step icon tutorial (arrow pointing to counter, etc.).

### Persistence / PWA
- Autosave to localStorage (versioned key, e.g. "neonswap.save.v1") every few seconds and on visibilitychange/pagehide; reset option in settings with confirm.
- Offline PWA: manifest.webmanifest (portrait, standalone, theme color), sw.js cache-first of all app files with a versioned cache name, relative paths only (site is served from https://mati-sme.github.io/neon-swap-shop/). Generate icons (192, 512, maskable) as PNG files using a small script (Python PIL is available, or node) — commit the PNGs.
- See /workspace/projects/scrap-nest/sw.js and manifest for an existing pattern.

### Testability (important)
Expose `window.__game` with read access to state and helpers so a Playwright test can drive it: e.g. `__game.state`, `__game.scene`,
`__game.player` (x,y), `__game.nearStation`. Do not require audio to start. No console errors or warnings.
Write `test/smoke.mjs` using Playwright (node; check `npx playwright --version` / installed browsers; if missing use whatever chromium exists, e.g. `/usr/bin/chromium` or playwright's cached browsers) that: serves the folder on a local port (simple node http server in the script), opens at 390x844 with hasTouch+isMobile, fails on any console error/pageerror, does touch-drag joystick movement via CDP Input.dispatchTouchEvent (and verify player position changed), walks to the counter and serves several customers including haggle, goes scavenging and digs, sleeps to next day, simulates ~3 minutes of play (can speed time via a `?fast=1` debug flag), verifies localStorage save exists and reload restores progress, and saves screenshots to test/shots/*.png (title/shop, trade card, junk dump).
Run it yourself and fix issues until it passes.

### Files
index.html, style.css, js/*.js (split sensibly: main, input/joystick, render/pixel art, data/items, shop, scavenge, ui, audio, save), sw.js,
manifest.webmanifest, icons/, README.md (how to play, controls, credits "inspired by shopkeeper sims"), .nojekyll, test/.
Do not git push or create remotes; I will do that. You may git commit locally.
