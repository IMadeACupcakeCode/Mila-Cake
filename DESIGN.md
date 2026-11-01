---
name: Mila OS
description: A confectionery site that randomly visits five classic platform-inspired interfaces, with animated transitions and a hidden visual picker.
colors:
  primary: "#3b5998"
  primary-deep: "#1d2129"
  primary-light: "#6d84b4"
  surface: "#ffffff"
  surface-2: "#f7f8fa"
  surface-glass: "#ffffff"
  text: "#1d2129"
  muted: "#6b7280"
  border: "#c9d3e3"
  border-strong: "#3b5998"
  title-1: "#3b5998"
  title-2: "#4e69a2"
  title-text: "#ffffff"
  accent-text: "#ffffff"
  link: "#3b5998"
  medal: "#f2b705"
  focus: "#3b5998"
  selection: "rgba(59,89,152,0.20)"
  scrollbar: "#3b5998"
  scrollbar-track: "#eef0f4"
typography:
  display:
    fontFamily: "Segoe UI, Tahoma, Verdana, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.625rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0em"
  headline:
    fontFamily: "Segoe UI, Tahoma, Verdana, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Segoe UI, Tahoma, Verdana, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Segoe UI, Tahoma, Verdana, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Segoe UI, Tahoma, Verdana, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.05em"
  mono:
    fontFamily: "Consolas, Courier New, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "3px"
  md: "7px"
  lg: "14px"
  pill: "20px"
  full: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.md}"
    padding: "9px 16px"
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "9px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "9px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "16px"
  nav-tab:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.md}"
    padding: "7px 12px"
  segmented-control:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: "7px 14px"
  window:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "20px"
---

# Design System: Mila OS

## Overview

**Creative North Star: "The Sugar-Glass Desktop"**

Mila's site randomly opens in one of five platform-inspired interfaces: Facebook, Google+, 4shared, MediaFire, or Friv. Each visual changes the navigation, surfaces, typography accents, page structure, and motion while keeping the bot's real data and actions intact. A nearly hidden button opens the playful “Me Descobriu, Chapa!” picker, where visitors can select a visual or roll another at random.

The aesthetic is nostalgic and platform-specific: a compact blue social feed for Facebook, a bright stream for Google+, file lists and sharing controls for 4shared and MediaFire, and a compact purple activity grid for Friv. Mila's local character art, emoji-led labels, and “Açúcares 🍬” currency tie the experiences together without flattening their differences.

**Key Characteristics:**
- Five platform-inspired visuals switched via `data-theme`: `facebook`, `gplus`, `fourshared`, `mediafire`, and `friv`.
- When the bot is offline or its status API cannot be reached, an original digital-interference screen replaces the site UI and offers a manual connection check; the local Mila artwork is used instead of third-party game imagery.
- Distinctive, compact platform-inspired navigation and page layouts; controls lead to working Mila pages rather than imitating unavailable services.
- Segoe UI-led typography with a restrained accent palette; mono (Consolas) only for command/code chips.
- Theme changes use an exit motion for the current skin and a matching entrance for the next; reduced-motion preferences disable the effects.
- The initial skin is random on each visit; no previous choice is persisted.
- Confectionery voice in copy and emoji, never in the structural chrome.

## Colors

The palette is per-visual. The frontmatter above records the **Facebook** tokens; every other active visual redefines the same custom-property names under its own `[data-theme="..."]` block, so components stay token-driven and never hardcode a visual's colors.

### Primary
- **Facebook Blue** (#3b5998): the markup fallback accent. Active tabs, buttons, focus rings, and progress bars.
- **Facebook Ink** (#1d2129): title and chrome text.
- **Facebook Light** (#6d84b4): secondary accent and gradient partner.

### Neutral
- **Panel** (#ffffff): the default card/window surface.
- **Panel 2** (#f7f8fa): recessed surface for chips and inputs.
- **Ink** (#1d2129): primary text on light surfaces.
- **Muted Slate** (#6b7280): secondary text and help text.
- **Border** (#c9d3e3): default border and dividers.
- **Strong Border** (#3b5998): emphasized borders and focus.
- **Title Bar 1** (#3b5998) / **Title Bar 2** (#4e69a2): Facebook header tones.
- **Title Text** (#ffffff): text on the default title bars.
- **Accent Text** (#ffffff): text on filled primary surfaces.
- **Link Blue** (#3b5998): inline links (underlined on hover).
- **Medal Gold** (#f2b705): ranking positions, creator crown, achievement accents.
- **Focus Blue** (#3b5998): focus-visible outline.
- **Selection Tint** (rgba(59,89,152,0.20)): text selection background.

### Platform-inspired visuals (five)
- **Facebook**: compact blue header, timeline-like surfaces, and blue active navigation.
- **Google+**: light stream, red accent, and sharp header rule.
- **4shared**: blue file-sharing interface with file-oriented navigation and controls.
- **MediaFire**: bright cloud-storage interface with sharing-focused navigation.
- **Friv**: compact game portal grid with purple, yellow, and orange accents.

**The One Voice Rule.** Each skin contributes exactly one accent voice; primary is used on active tabs, primary buttons, progress bars, and focus rings only. Decorative color lives in the skin's own surfaces and gradients, never in ad-hoc accents.

## Typography

**Display Font:** Segoe UI (with Tahoma, Verdana, sans-serif fallback)
**Body Font:** Segoe UI (same stack)
**Label/Mono Font:** Consolas (with Courier New, monospace fallback) for code chips only

**Character:** A single, workhorse, OS-native sans (Segoe UI) carries every role from display to label. Weight does the hierarchy work (700 for titles/actions, 400 for body), with 14px body copy for comfortable reading. Consolas appears only inside `<code>` chips for commands like `/diario`.

### Hierarchy
- **Display** (700, clamp(1.75rem, 4vw, 2.625rem), 1.05): hero headline "Oi! Eu sou a Mila." with the accent color on the name.
- **Headline** (700, 1.25rem, 1.2): profile name, section titles inside windows.
- **Title** (700, 1rem, 1.25): card titles, category headers, window title bars.
- **Body** (400, 0.875rem, 1.55): descriptions, help text, max ~60ch.
- **Label** (700, 0.75rem, 1.2, tracking 0.05em, uppercase): stat labels, chips, status text.
- **Mono** (400, 0.75rem, 1.4): command chips (`/diario`, `/loja`).

### Named Rules
**The Single Family Rule.** One sans family across all roles and all nine skins; hierarchy is carried by weight and size, never by mixing families. Only code chips break the rule, and only with Consolas.

## Layout

The layout is a centered desktop column: `width: min(1180px, calc(100% - 40px))`, auto margins, `26px` top / `40px` bottom, `22px` vertical rhythm between windows. Below 760px it becomes full-width with `22px` gutters and a horizontally scrollable tab bar. Windows stack vertically with a `22px` gap; inside, content uses `20px` padding (`14px` on mobile).

Grids are fluid: cards use `repeat(auto-fit, minmax(230px, 1fr))` with a `16px` gap; shop items `minmax(260px, 1fr)`; themes `minmax(200px, 1fr)`; profile stats `minmax(130px, 1fr)`. Spacing rhythm is 4/8/16/24 (xs/sm/md/lg). Windows skins carry fixed shortcut icons at top-left; social and game portals hide them.

Responsive changes: hide desktop icons, full-width work area, scrollable tabs, reduced window padding, stacked hero with centered mascot. Motion is disabled entirely under `prefers-reduced-motion: reduce`.

## Elevation & Depth

Depth is conveyed primarily by **layered shadows plus inset glass highlights**, not flat tonal layering. Every elevated surface carries an inset top highlight (`inset 0 1px 0 rgba(255,255,255,.85)`) to fake an Aero glass edge, plus an outer drop shadow. Shadows are structural (windows at rest) and reactive (hover lifts a card 4px, a ranking row 4px sideways, a button 1px down on press).

### Shadow Vocabulary
- **Window (rest):** `0 14px 34px rgba(8,42,80,.32)` plus inset top highlight — the Aero glass drop.
- **Window (Win7 override):** `0 18px 44px rgba(8,42,80,.38)` plus `inset 0 1px 0 rgba(255,255,255,.7)`.
- **Window (hover):** `0 18px 40px rgba(0,0,0,.22)`.
- **Card:** inset highlight + `0 4px 12px rgba(0,0,0,.10)`; hover becomes `0 12px 26px rgba(0,0,0,.18)` with a 4px lift.
- **Button:** inset highlight + `0 1px 2px rgba(0,0,0,.15)`; hover lifts to `0 3px 8px`.
- **Mascot image:** `0 8px 24px rgba(0,0,0,.18)` plus inset highlight.
- **Speech bubble:** `0 3px 10px rgba(0,0,0,.15)`.

### Named Rules
**The Glass-Edge Rule.** Every elevated surface keeps an inset top highlight; flat surfaces without it read as broken. Shadows are never the only depth cue — they always pair with the highlight.

## Shapes

Corner language is **skin-dependent but consistent within a skin**: Windows Aero uses 7–8px, Tumblr and Facebook are squarer, Skype is softer, and game portals use rounded cards. Shared structural radii: 3px for code chips, 7–8px default (`--raio`), 14px large (`--raio-lg`), 20px pills, 50% circles (avatars and status dots).

Borders are 1px solid in the skin's border color. Window title bars carry a bottom border; cards a single border. No border-radius on the desktop background itself.

## Components

### Buttons
- **Shape:** 8px radius (skin-overridden), 1px border, inset top highlight.
- **Primary:** accent gradient (accent-2 → accent), white bold text, 9px 16px padding, inset highlight + drop shadow.
- **Hover / Focus:** brightness 1.1 (primary) / 1.06 (default); shadow lift; active presses 1px down. Focus-visible: 2px solid focus outline, 2px offset.
- **Secondary / Ghost:** neutral surface gradient, ink text, same chrome; used for "Abrir loja" beside a primary.
- **Segmented (`.seg`):** pill-less segmented control inside a bordered group; active segment fills with accent.

### Cards / Containers
- **Corner Style:** skin radius (8px default).
- **Background:** surface (Cool Panel) with inset highlight.
- **Shadow Strategy:** resting drop + inset highlight; hover lifts 4px with deeper shadow and a sweep highlight.
- **Border:** 1px solid border color; cards on the grid have a subtle top-left sheen on hover.
- **Internal Padding:** 16px.

### Inputs / Fields
- **Style:** 1px strong border, 8px radius, surface-2 background, inset shadow, 9px 12px padding.
- **Focus:** accent-2 outline (2px) + 1px offset, border shifts to accent, caret colored with accent.
- **Error / Disabled:** error text in `#c0392b` (shared across skins); disabled not yet specified.

### Navigation
- **Style:** top title bar with brand (logo + "Mila OS" + subtitle), tab buttons (`.aba`) with 8px radius, status pill on the right. Active tab fills with accent and white text plus an inner highlight.
- **States:** hover adds a translucent white wash; active press translates 1px down.
- **Mobile:** tabs reorder to a full-width horizontally scrollable row.

### Window chrome
- **Style:** Windows themes use a title bar gradient (title-1 → title-2), caption text, decorative right-aligned controls, 1px border, and a glass shadow. Other platforms do not show desktop window controls.
- **Distinctive:** each skin restyles its own navigation and surfaces (Tumblr slate, Facebook navy, Windows glass, game portals with bright headers).

### Ranking row
- **Style:** bordered surface row with medal position, avatar circle, name, progress bar (accent gradient), value. Hover translates 4px right.

### Chips / Tags
- **Style:** 20px pill, surface-2 background, border, 5px 10px padding; blocked state grayscale at 45% opacity.

## Do's and Don'ts

### Do:
- **Do** keep all nine skins working; a change must render correctly under every `data-theme`.
- **Do** use the CSS custom properties (`--accent`, `--painel`, `--raio`, …) in components; never hardcode a skin's hex outside its `[data-theme]` block.
- **Do** keep the inset top highlight on elevated surfaces (The Glass-Edge Rule).
- **Do** use Segoe UI for everything except code chips, which use Consolas.
- **Do** keep body text at 13–14px and titles at 700 weight for the desktop density.
- **Do** respect `prefers-reduced-motion: reduce` (all animation and transition disabled).
- **Do** carry the confectionery voice in copy and emoji, not in structural chrome.

### Don't:
- **Don't** add or remove a theme without updating the theme picker and this inventory.
- **Don't** mix font families or add a display serif; the single-family rule is non-negotiable.
- **Don't** use shadows without the paired inset highlight.
- **Don't** ship a component that only works in the default (Aero) skin.
- **Don't** override the desktop wallpaper gradient with a flat color.
- **Don't** add marketing-style hero sections; the desktop metaphor is the layout.

## Historical references

The archive review informed the page structures rather than supplying a single screenshot to trace:

- [Friv.com in the Wayback Machine](https://web.archive.org/web/*/http://www.friv.com/): the 2011 capture showed a dense game-icon grid on a purple field. The skin uses that purple backdrop and tile-like cards; the four cards remain Mila features, not fake game links.
- [Click Jogos in the Wayback Machine](https://web.archive.org/web/*/http://www.clickjogos.com.br/): the 2012 capture showed game covers, titles, and categories in a portal-style listing. The skin borrows that listing rhythm while its controls still lead to Mila's real pages.
- [Gartic in the Wayback Machine](https://web.archive.org/web/*/http://gartic.uol.com.br/): the 2010 capture exposed room setup fields. The current site has no drawing-room API, so this skin does not invent a playable room or nonfunctional room controls.
- [Tumblr](https://web.archive.org/web/*/http://www.tumblr.com/), [Facebook](https://web.archive.org/web/*/https://www.facebook.com/), [Skype](https://web.archive.org/web/*/http://www.skype.com/), and [Google+](https://web.archive.org/web/*/https://plus.google.com/): archived pages redirected to authentication or were blocked by a CAPTCHA during review. Their themes are period-inspired approximations, not verified pixel-perfect copies.

All visible site navigation continues to route to the existing home, ranking, store, and profile views; cosmetic platform labels do not imply features the bot does not provide.