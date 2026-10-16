# RetroParty UI/UX & Design System Audit Report

**Auditor:** Design, UI & Consumer UX Expert  
**Date:** October 16, 2026  
**Status:** Complete  
**Scope:** Frontend visual hierarchy, consumer onboarding, design tokens, HUD/in-game consistency, and responsive/touch experience.  
**Target:** `artifacts/sega-party/`

---

## Executive Summary

RetroParty demonstrates a compelling, immersive **"Obsidian Lounge"** aesthetic that blends dark cyberpunk elegance with nostalgic retro-arcade hardware motifs. The color palette (obsidian `#090b12`, card slate `#0f131d`, electric cyan/SEGA blue, and neon purple accents) effectively elevates the platform beyond typical utilitarian browser emulators into a premium cloud social gaming experience.

However, the audit identified critical friction points across four main areas:
1. **Accessibility & Typography Integrity:** Incomplete Google font imports and low-contrast muted labels (`< 4.5:1`) that fail WCAG AA guidelines.
2. **Onboarding & Launch Friction:** Host-centric layout dominating invited guest links, console auto-detection silently overwriting user selections, and extensive vector graphics pushing primary CTAs below the fold.
3. **In-Game HUD Overlaps & Fullscreen Trapping:** Radix dialogs trapped behind the `z-[80]` cinema stage, hover-only toolbars invisible on touch devices, and simultaneous on-canvas toasts colliding with the windowed chat sidebar.
4. **Mobile & Touch Ergonomics:** Hardcoded Genesis button layouts for all 12 console platforms, discrete D-Pad buttons lacking touch-sweep/diagonal tracking, and missing `viewport-fit=cover` viewport metadata.

---

## Priority Issues Matrix

| ID | Category | Severity | Issue Summary | Affected Components |
|---|---|---|---|---|
| **AUD-01** | In-Game HUD | **HIGH** | Radix Dialogs trapped behind Fullscreen Cinema Stage (`z-[50]` vs `z-[80]`) | `InviteModal.tsx`, `RomFilePicker.tsx`, `session.tsx` |
| **AUD-02** | Mobile UX | **HIGH** | Hover-only floating in-stream toolbar is inaccessible on touch devices | `session.tsx` |
| **AUD-03** | Mobile UX | **HIGH** | Touch D-Pad uses discrete buttons; cannot register swipe/diagonal movement | `TouchGamepad.tsx` |
| **AUD-04** | Mobile UX | **HIGH** | Fixed 6-button Sega layout for all consoles, including 2-button systems | `TouchGamepad.tsx` |
| **AUD-05** | Onboarding | **HIGH** | Invited guest flow forces users to scroll past the entire Host launcher | `home.tsx` |
| **AUD-06** | Onboarding | **HIGH** | Dropping a ROM file silently overwrites user's Step 1 console selection | `home.tsx`, `ConsoleShowcase.tsx` |
| **AUD-07** | Design System | **MEDIUM** | Font loading mismatch: `index.html` only loads Inter; `index.css` `@import` causes FOUT | `index.html`, `index.css` |
| **AUD-08** | Design System | **MEDIUM** | Sub-4.5:1 contrast ratios on muted text and small metadata tags | `index.css`, `ConsoleShowcase.tsx`, `ControlsModal.tsx` |
| **AUD-09** | In-Game HUD | **MEDIUM** | Floating InGameChatOverlay collides with In-Stream Toolbar on compact screens | `InGameChatOverlay.tsx`, `session.tsx` |
| **AUD-10** | In-Game HUD | **MEDIUM** | Dual-chat redundancy: toasts pop up over canvas while sidebar ChatPanel is open | `session.tsx`, `InGameChatOverlay.tsx`, `ChatPanel.tsx` |
| **AUD-11** | Mobile UX | **MEDIUM** | Missing `viewport-fit=cover` causes letterboxing on notched devices | `index.html` |
| **AUD-12** | Visual Polish | **LOW** | Obtrusive "Click Screen to Enable Audio" banner covers in-game HUD | `session.tsx` |
| **AUD-13** | Visual Polish | **LOW** | 6-card SVG Console Showcase pushes ROM dropzone below the fold on 1080p | `home.tsx`, `ConsoleShowcase.tsx` |

---

## Detailed Findings & Recommendations

### 1. Visual Hierarchy & Obsidian-Lounge Aesthetic

#### 1.1 Font Loading Architecture & FOUT Risk
* **Severity:** Medium
* **Affected Files:** `artifacts/sega-party/index.html` (L9-L11), `artifacts/sega-party/src/index.css` (L1)
* **Friction Description:**
  `index.html` includes a `<link rel="stylesheet">` specifically fetching only `Inter:wght@400;500;600;700`. Meanwhile, `src/index.css` line 1 issues a separate `@import url(...)` requesting `Inter`, `JetBrains Mono`, and `Plus Jakarta Sans`.
  Because `@import` in CSS blocks subsequent CSS parsing and parallel font downloading, users on standard mobile or desktop connections experience a flash of unstyled text (FOUT) or invisible text (FOIT) on headers utilizing `var(--font-display)` (`Plus Jakarta Sans`).
* **Recommendation:**
  1. Remove `@import url(...)` from `src/index.css`.
  2. Consolidate font preconnects and the complete multi-family font URL into `index.html` `<head>`:
     ```html
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
     <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
     ```

#### 1.2 Contrast Ratios on Micro-Typography (WCAG AA Compliance)
* **Severity:** Medium
* **Affected Files:** `src/components/ConsoleShowcase.tsx` (L623), `src/components/ControlsModal.tsx` (L779), `src/pages/home.tsx` (L541), `src/index.css` (L75)
* **Friction Description:**
  The base `--muted-foreground` token is set to `218 15% 65%` (~`#949fb0`), which achieves ~8.5:1 contrast over `#090b12` background. However, components frequently combine this with fractional opacity (`text-muted-foreground/60`, `text-muted-foreground/40`) and small font sizes (`text-[10px]`, `text-[9px]`).
  - Example: `ConsoleShowcase.tsx` generation subtitle: `text-[10px] text-muted-foreground truncate` drops contrast to ~3.8:1.
  - Example: `ControlsModal.tsx` unbound keys: `text-muted-foreground/40 border-dashed border-white/10` drops contrast to ~2.6:1.
  On high-refresh rate displays with black-crush or in sunny environments, secondary metadata becomes unreadable.
* **Recommendation:**
  1. Never reduce opacity on text below 12px; use a solid secondary token such as `text-slate-400` (`#94a3b8`, 8.1:1 contrast) or `text-slate-300` (`#cbd5e1`, 12.4:1 contrast).
  2. For dashed/empty state indicators, provide high-contrast iconography rather than faded text.

#### 1.3 Ambient Glow Token Standardization
* **Severity:** Low
* **Affected Files:** `ConsoleShowcase.tsx`, `RomDropzone.tsx`, `session.tsx`
* **Friction Description:**
  Ambient glows are currently hardcoded with ad-hoc RGB strings and arbitrary box-shadow spreads across multiple files (e.g., `0 0 25px rgba(56, 189, 248, 0.35)` in `RomDropzone.tsx`, `shadow-[0_0_30px_rgba(0,140,255,0.9)]` in `session.tsx`, and inline box-shadows in `ConsoleShowcase.tsx`).
* **Recommendation:**
  Standardize glow utilities in `index.css`:
  ```css
  .glow-cyan { box-shadow: 0 0 20px rgba(56, 189, 248, 0.35); }
  .glow-accent { box-shadow: 0 0 20px rgba(168, 85, 247, 0.35); }
  .glow-emerald { box-shadow: 0 0 20px rgba(16, 185, 129, 0.35); }
  ```

---

### 2. Landing & Game Launch UX (`home.tsx`)

#### 2.1 Invited Guest Flow Disorientation
* **Severity:** High
* **Affected Files:** `artifacts/sega-party/src/pages/home.tsx` (L245-L485)
* **Friction Description:**
  When a player clicks a shared invite link (e.g. `retroparty.com/?code=MARIO1`), the URL parameter sets `hasInviteCode = true` and fills the code.
  However, the layout is fixed 8-columns for Host (Left) and 4-columns for Guest (Right).
  - **On Desktop:** The guest's eyes are drawn to the massive "Start a Party Room" banner on the left, which asks them to choose a system and drop a ROM. The Join box is relegated to the right sidebar.
  - **On Mobile:** The Join box is stacked at the very bottom. The invited guest must scroll past the Hero, 6 Console Cards, the ROM Dropzone, and Host nickname field before they see "Join a Friend's Room".
* **Recommendation:**
  When `hasInviteCode` is true:
  1. Swap the visual hierarchy: render the "Join a Friend's Room" card as a focused, hero-level dialog or banner at the top of the page.
  2. On mobile, automatically scroll the guest card into view or collapse the Host accordion.

#### 2.2 ROM Dropzone Auto-Detection Overwriting User Core Selection
* **Severity:** High
* **Affected Files:** `src/pages/home.tsx` (L87-L95), `src/components/RomDropzone.tsx`
* **Friction Description:**
  In `home.tsx`, Step 1 is "Choose Your System" and Step 2 is "Load Game". If a user deliberately clicks "Super Nintendo" in Step 1, and in Step 2 drops a `.zip` or `.bin` file, `handleFileSelected` executes:
  ```ts
  const sys = detectConsoleFromFilename(file.name);
  setSelectedCore(sys.id);
  setDetectedCore(sys.id);
  ```
  If `file.name` is ambiguous or contains a substring matching another platform, their explicit choice in Step 1 is silently replaced without notice.
* **Recommendation:**
  If the user has manually selected a core, present auto-detection as a non-destructive suggestion pill:
  *"Detected Sega Genesis · [Switch to Genesis] or [Keep SNES]"*.

#### 2.3 6-Card Showcase Height Pushing Primary CTA Below Fold
* **Severity:** Low to Medium
* **Affected Files:** `src/components/ConsoleShowcase.tsx` (L568-L630), `src/pages/home.tsx`
* **Friction Description:**
  The isometric SVG console illustrations are visually outstanding, but each card is ~150px tall. In `home.tsx`, Step 1 occupies over 240px of vertical real estate. On 1366x768 and 1080p laptop viewports, the primary "Start Party" launch CTA is pushed 300px below the viewport fold.
* **Recommendation:**
  Add a compact/grid view toggle or reduce card vertical padding on desktop (`py-2` instead of `p-3`, SVG height `h-14` instead of `h-20`), ensuring Step 1, Step 2, and the Launch button fit in a single viewport.

---

### 3. In-Game HUD & Overlay Consistency

#### 3.1 Radix Modals Trapped Behind Fullscreen Cinema Stage
* **Severity:** High
* **Affected Files:** `src/components/InviteModal.tsx`, `src/components/RomFilePicker.tsx`, `src/pages/session.tsx` (L1826-L1833)
* **Friction Description:**
  In `session.tsx`, entering Fullscreen mode sets `isFullscreen = true`, applying `fixed inset-0 z-[80] w-screen h-screen bg-black` to `videoContainerRef`.
  While `ControlsModal.tsx` was correctly updated to use `createPortal(..., document.fullscreenElement || document.body)` at `z-[200]`, `InviteModal.tsx` still uses standard Radix `<DialogContent>` which renders at `z-50` in `document.body`.
  **Result:** When a host or guest is in fullscreen and clicks "Invite Friends" from the floating toolbar, the Invite Modal opens **behind** the fullscreen emulator. The UI appears frozen or unresponsive because the modal backdrop blocks pointer events while being visually obscured.
* **Recommendation:**
  Convert `InviteModal.tsx` and `RomPicker` to use `createPortal` with `z-[200]` targeting `(document.fullscreenElement as HTMLElement) || document.body`, identical to `ControlsModal.tsx`.

#### 3.2 Hover-Only In-Stream Floating Toolbar on Touch Devices
* **Severity:** High
* **Affected Files:** `src/pages/session.tsx` (L1866, L2064)
* **Friction Description:**
  The in-stream toolbar (volume, keybinds, chat toggle, fullscreen, eject) is styled with:
  `opacity-0 group-hover:opacity-100 transition-opacity duration-200`
  On touchscreens (tablets, iPads, mobile phones), CSS hover states do not trigger naturally. Tapping the screen registers a click, which can accidentally click underlying emulator elements, toggle audio, or trigger canvas pointer locks.
* **Recommendation:**
  Implement a touch-friendly visibility state:
  - If a coarse pointer is detected (`window.matchMedia('(pointer: coarse)').matches`), show the toolbar on screen tap and auto-hide it after 3.5 seconds of inactivity.
  - Add an always-visible, semi-transparent toggle pill in the corner for mobile users.

#### 3.3 HUD Collision: InGameChatOverlay vs In-Stream Toolbar
* **Severity:** Medium
* **Affected Files:** `src/components/InGameChatOverlay.tsx` (L104), `src/pages/session.tsx` (L1866, L2064)
* **Friction Description:**
  `InGameChatOverlay` is positioned at `bottom-14 left-4` with width `w-80 sm:w-96` (320px–384px).
  The in-stream toolbar is positioned at `bottom-14 right-3` with width ~260px.
  On viewports narrower than 768px (such as mobile landscape orientation or split-screen windows), the chat input drawer and the floating controls collide, overlapping buttons and preventing text submission.
* **Recommendation:**
  1. On viewports `< 768px`, anchor `InGameChatOverlay` to the top-left (`top-14 left-3`) or elevate its bottom offset (`bottom-24`).
  2. Ensure the active typing drawer occupies a full-width bottom sheet on mobile devices.

#### 3.4 Dual-Chat Redundancy in Windowed Mode
* **Severity:** Medium
* **Affected Files:** `src/pages/session.tsx`, `src/components/ChatPanel.tsx`, `src/components/InGameChatOverlay.tsx`
* **Friction Description:**
  When playing in normal windowed desktop mode, `session.tsx` renders `ChatPanel` in the right column (4 cols) with live scroll and input. Concurrently, incoming chat messages trigger floating toasts in `InGameChatOverlay` inside the game canvas.
  This duplicates every chat notification twice on screen simultaneously, partially obscuring the game's retro HUD (e.g. score, lives, health bars in the bottom-left).
* **Recommendation:**
  Suppress on-canvas passive toasts when `!isFullscreen` and the viewport is wide enough to display the right-hand `ChatPanel`. Only enable `InGameChatOverlay` when in Fullscreen mode or on compact screens where `ChatPanel` is collapsed.

#### 3.5 Obtrusive "Click Screen to Enable Audio" Banner
* **Severity:** Low
* **Affected Files:** `src/pages/session.tsx` (L2046-L2059)
* **Friction Description:**
  The audio unlock banner (`bg-primary/95 text-primary-foreground px-6 py-3 rounded-full shadow-[0_0_30px_rgba(0,140,255,0.9)]`) is positioned at `top-6 left-1/2 -translate-x-1/2` and pulses continuously. In 4:3 aspect games, it covers the top-center area of the video, blocking game timers and boss health bars.
* **Recommendation:**
  Relocate the audio unlock prompt to a sleek bottom-center floating toast, or integrate a pulsing unmute pill into the floating toolbar that dismisses immediately upon first user interaction.

---

### 4. Responsive & Mobile/Touch Experience

#### 4.1 Fixed Sega 6-Button Layout on TouchGamepad
* **Severity:** High
* **Affected Files:** `src/components/TouchGamepad.tsx` (L119-L163)
* **Friction Description:**
  `TouchGamepad` currently renders a fixed layout of 6 action buttons (top row: X, Y, Z; bottom row: A, B, C) with Mega Drive blue and red styling.
  When a player emulates NES (A, B), Game Boy (A, B), or SNES (A, B, X, Y), the presence of dead or unmapped buttons (Z, C, Mode) causes confusion and accidental misclicks during gameplay.
* **Recommendation:**
  Dynamically adapt `TouchGamepad` based on `activeCore`:
  - **NES / Game Boy:** 2 oversized buttons (B, A).
  - **SNES / GBA / PSX:** 4-button diamond layout (Y, X, B, A) + L/R shoulder buttons.
  - **Genesis / Arcade:** 3 or 6 button arc.

#### 4.2 Touch D-Pad Lacks Continuous Swipe/Diagonal Tracking
* **Severity:** High
* **Affected Files:** `src/components/TouchGamepad.tsx` (L66-L100)
* **Friction Description:**
  The touch D-Pad uses discrete `<button>` elements with individual `onTouchStart` and `onTouchEnd` listeners.
  In mobile gaming, players naturally slide their thumbs across directions. When a player slides their thumb from `▲` to `▶`:
  - The browser continues tracking the touch on the original `▲` button.
  - The character continues moving Up and never switches to Right.
  - Diagonal inputs (Up+Right) are nearly impossible to hit without pressing both buttons with two distinct touch points.
* **Recommendation:**
  Replace discrete buttons with a single unified touch-tracking surface that computes vector deflection from the center touch origin:
  ```ts
  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - originX;
    const dy = touch.clientY - originY;
    // Compute 8-way directional deadzone & trigger inputs
  };
  ```

#### 4.3 Missing `viewport-fit=cover` in Meta Viewport
* **Severity:** Medium
* **Affected Files:** `artifacts/sega-party/index.html` (L5)
* **Friction Description:**
  `index.html` defines:
  `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />`
  Without `viewport-fit=cover`, mobile browsers (iOS Safari, Android Chrome) enforce pillarboxing around the notch and home indicator bar, preventing full edge-to-edge game immersion.
* **Recommendation:**
  Update meta tag in `index.html`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover" />
  ```
  Add `safe-area-inset` utilities to the fullscreen container:
  ```css
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
  ```

#### 4.4 Header Action Cramping on Mobile Screens (< 480px)
* **Severity:** Medium
* **Affected Files:** `src/pages/session.tsx` (L1705-L1809)
* **Friction Description:**
  The in-game session header displays the room code, copy button, live indicator, Change Game button, Eject button, Touch Pad button, and Keybinds button (`"{consoleSys.shortName} Keybinds (P1)"`). On viewports `< 480px`, these elements overflow horizontally or wrap into an uneven header height that pushes the game canvas down.
* **Recommendation:**
  On screens `< 640px`:
  1. Abbreviate the Keybind button to an icon + "P1" badge.
  2. Move secondary utilities (Eject, Touch Pad toggle) into a three-dots `...` overflow menu.

---

## Actionable Design Polish Checklist

- [ ] **Fonts & CSS:** Move Google Fonts bundle into `index.html` `<head>`; remove `@import` from `src/index.css`.
- [ ] **Contrast:** Replace all instances of `text-muted-foreground/40` and `text-muted-foreground/60` with solid `text-slate-400` / `text-slate-300` to guarantee WCAG AA compliance.
- [ ] **Guest Onboarding:** When `?code=` is detected in URL, present the Join Party form prominently at the top of `home.tsx`.
- [ ] **Core Selection:** Change auto-detection behavior from silent overwrite to an informative recommendation pill.
- [ ] **Fullscreen Dialogs:** Refactor `InviteModal.tsx` and `RomPicker` to portal at `z-[200]` into `document.fullscreenElement || document.body`.
- [ ] **In-Stream Toolbar:** Add touch-tap auto-fade support for the floating game toolbar on mobile/tablet devices.
- [ ] **Chat Dual-Display:** Suppress floating canvas toasts when the windowed `ChatPanel` is already visible on desktop.
- [ ] **Touch Gamepad:** Implement continuous vector/swipe tracking on the D-Pad and console-specific button layouts (NES, SNES, Genesis).
- [ ] **Viewport Fit:** Add `viewport-fit=cover` to `index.html` for edge-to-edge mobile fullscreen.

---
*Report compiled autonomously by the Design, UI & Consumer UX Expert.*
