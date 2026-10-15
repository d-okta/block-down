---
name: Obsidian Kinetic
colors:
  surface: '#111319'
  surface-dim: '#111319'
  surface-bright: '#36393f'
  surface-container-lowest: '#0b0e13'
  surface-container-low: '#191c21'
  surface-container: '#1d2025'
  surface-container-high: '#272a30'
  surface-container-highest: '#32353a'
  on-surface: '#e1e2e9'
  on-surface-variant: '#c4c5d6'
  inverse-surface: '#e1e2e9'
  inverse-on-surface: '#2e3036'
  outline: '#8e90a0'
  outline-variant: '#444654'
  surface-tint: '#b7c4ff'
  primary: '#b7c4ff'
  on-primary: '#002584'
  primary-container: '#6b89ff'
  on-primary-container: '#002074'
  inverse-primary: '#2e53d0'
  secondary: '#6bd6e4'
  on-secondary: '#00363c'
  secondary-container: '#269fac'
  on-secondary-container: '#002f34'
  tertiary: '#e4c45b'
  on-tertiary: '#3c2f00'
  tertiary-container: '#c7a943'
  on-tertiary-container: '#4e3e00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001453'
  on-primary-fixed-variant: '#0038b8'
  secondary-fixed: '#90f1ff'
  secondary-fixed-dim: '#6bd6e4'
  on-secondary-fixed: '#001f23'
  on-secondary-fixed-variant: '#004f57'
  tertiary-fixed: '#ffe081'
  tertiary-fixed-dim: '#e4c45b'
  on-tertiary-fixed: '#231b00'
  on-tertiary-fixed-variant: '#564500'
  background: '#111319'
  on-background: '#e1e2e9'
  surface-variant: '#32353a'
typography:
  headline-xl:
    fontFamily: Sora
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Sora
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Sora
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Sora
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Sora
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Sora
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Sora
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Sora
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Sora
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Sora
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
  display-stat-lg:
    fontFamily: JetBrains Mono
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  display-stat-md:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: 0em
  stat-counter:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.5rem
  gutter-desktop: 1rem
  margin: 1rem
  margin-mobile: 0.75rem
  margin-safe-top: env(safe-area-inset-top, 1rem)
  margin-safe-bottom: env(safe-area-inset-bottom, 1rem)
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system delivers a focused, premium tactile experience built for an elite mobile falling-block puzzle. Rejecting the noisy hyper-casual tropes of aggressive neon glows, cartoonish explosions, and gambling-style micro-animations, the aesthetic leans into architectural restraint, physical poise, and absolute focus.

The emotional signature is cool, deliberate, and immersive: a meditative state of high-velocity spatial reasoning. Visual structures are precise and quiet, allowing vibrant falling polyominoes to serve as the singular focal center of the viewport. Surface elevations rely on strict geometric discipline, dark slate hues, fine 1px surface perimeter strokes, and physical micro-beveling rather than decorative noise. Every interaction respects professional mobile utility, strict safe-area boundaries, and uncompromising 44px ergonomic touch envelopes.

## Colors

The palette is engineered around deep architectural blacks, cool slate grays, and a high-contrast cobalt accent, anchored by distinct, accessible hues for polyomino identification.

### Primary UI Surfaces & Roles
- **Base Canvas (`#0F1217`)**: The deepest canvas floor; surrounds the game matrix and fills viewport margins.
- **Surface Level 1 (`#161B22`)**: Primary card backdrop for HUD panels (Hold, Next, Score, Level).
- **Surface Level 2 (`#1E2530`)**: Elevated sub-cards, segmented control tracks, and input backgrounds.
- **Surface Stroke Subtle (`#1E2530`)**: Inactive component outlines and baseline matrix grid divisions.
- **Surface Stroke Defined (`#262F3D`)**: Structural panel borders and static card perimeters.
- **Primary Accent (`#5B7CFA`)**: High-salience interactive state color, used for primary actions and active selections.
- **Primary Action Surface (`#5B7CFA`)**: Filled button state.
- **Primary Action Text (`#0F1217`)**: High-contrast, near-black ink strictly enforced atop the Primary Action surface. Never substitute with white text.
- **Text High-Emphasis (`#E6E9EF`)**: Headlines, critical metrics, and active states.
- **Text Muted / Low-Emphasis (`#8A93A3`)**: Category labels, passive metrics, and helper captions.

### Game Piece Palette
These solid shades maintain strict optical parity across luminance levels, resisting wash-out on dark slate surfaces:
- **Piece I**: `#5CC8D6` (Cyan)
- **Piece O**: `#E3C35A` (Amber)
- **Piece T**: `#A57BD8` (Amethyst)
- **Piece S**: `#6CC489` (Emerald)
- **Piece Z**: `#E06C75` (Crimson)
- **Piece J**: `#3F63C9` (Cobalt)
- **Piece L**: `#E39A55` (Tangerine)

## Typography

The typography couples the structural clarity of **Sora** with the telemetry-grade monospace precision of **JetBrains Mono**.

### Functional Hierarchy
- **Sora (Headings & Interface)**: Chosen for crisp geometric letterforms and robust horizontal stabilization. Weights 600 and 700 handle high-level modal titles, screen states, and game outcome announcements. Weights 400 and 500 operate in button labels, option text, settings rows, and structural category heads.
- **JetBrains Mono (Telemetry & Stats)**: Dedicated exclusively to dynamic numeric data: live match scores, line clear metrics, high score leaderboards, countdown clocks, drop-per-minute (DPM) pacing, and piece bag debug counters. The font features default tabular figures, ensuring value transitions never trigger micro-jitter or horizontal layout reflow.
- **Uppercase Application**: All `label-sm` tiers mandate strict full-caps casing with `0.08em` tracking for subheadings such as `NEXT`, `HOLD`, `LINES`, and `LEVEL`.

## Layout & Spacing

The layout is driven by an exact **8px spatial grid** (`0.5rem`), with a secondary **4px micro-grid** for micro-alignments, bevels, and border tolerances.

### Screen Architecture & Form Factors
- **Safe Area Anchoring**: The system requires hardware notch and gesture-bar isolation using CSS environment variables (`margin-safe-top` and `margin-safe-bottom`). Functional controls must never overlap OS-level interaction thresholds.
- **Mobile Matrix Architecture**: Standard portrait orientation reserves a central column (10x20 cell grid) with dynamic width bounded by height constraints. Flanking HUD slots (Hold queue on the left, Next queue and Level/Score on the right) align to vertical tracks using `space-sm` (8px) gutters.
- **Touch Targets**: All user-tappable elements (Pause, Instant Drop toggles, Settings buttons) enforce an untouchable minimum bounding box of 44×44 CSS points, regardless of visual asset scale.
- **Breakpoints**:
  - `compact` (< 600px): Mobile portrait. Single-column HUD orchestration; peripheral HUD modules stack or flank with reduced margins (`margin-mobile` = 12px).
  - `medium` (600px - 1024px): Mobile landscape and foldable devices. Matrix is vertically centered with symmetrical 2-column tactical panels flanking left and right.
  - `expanded` (> 1024px): Tablet / desktop preview. Centered 480px structural shell flanked by atmospheric negative space.

## Elevation & Depth

Depth in this system is mechanical and structural rather than soft and atmospheric. Flamboyant blur washes, colorful ambient halos, and skeuomorphic drop shadows are banned.

### Elevation Hierarchy
1. **Level 0 (Matrix & Canvas Ground - `#0F1217`)**: Base flat layer. Matrix field uses a background of `#0F1217` overlaid with a 1px `#161B22` or `#1E2530` grid line network.
2. **Level 1 (Card & HUD Shelves - `#161B22`)**: Structural cards enclosing Next, Hold, and Stats modules. Depth is generated purely via a uniform **1px solid border (`#262F3D`)**. Shadows are omitted entirely or restricted to an ambient occlusion spread: `0 4px 12px rgba(0, 0, 0, 0.4)`.
3. **Level 2 (Active Sub-Surfaces & Trays - `#1E2530`)**: Elevated internal bays, such as individual piece preview wells. Framed with 1px stroke `#262F3D`.
4. **Level 3 (Modals, Overlays & Dialogs)**: Overlaid with `#161B22`, framed by a distinct 1px `#5B7CFA` stroke at 30% alpha, with a high-density occlusion shadow: `0 16px 32px rgba(0, 0, 0, 0.7)`. Canvas behind the modal is covered with a 60% opacity `#0F1217` backdrop scrim without heavy blur.

### Polyomino Block Construction
Blocks do not use flat minimalism or heavy 90s bulbous beveling. They employ micro-machined physical depth:
- **Base**: Solid piece token color.
- **Top Bevel Highlight**: 1px inset top border line (`inset 0 1px 0 rgba(255, 255, 255, 0.28)`), communicating a crisp overhead light plane.
- **Bottom Recess Shadow**: 1px inset bottom edge (`inset 0 -1px 0 rgba(0, 0, 0, 0.35)`).
- **Core Rim**: 4px structural corner rounding (`border-radius: 4px`).

## Shapes

The geometry strikes a deliberate tension between rounded handheld mobile card containers and the clean modularity of square block primitives.

- **Panels & Cards**: Unified at **12px radius** (`rounded-lg` adaptation on a 16px scale). This keeps corner radii tight, functional, and aligned with ergonomic smartphone frames.
- **Interactive Controls (Buttons, Inputs)**: Unified at **8px to 10px radius**, maintaining a clear distinction from the 12px framing panels.
- **Polyomino Sub-Blocks**: Exactly **4px corner radius**. Any radius larger causes blocks to look like disconnected pills; any radius smaller breaks the sleek digital tone.
- **Ghost Reticle / Hard-Drop Indicators**: 4px radius dashed or 1px outline-only segments mirroring block architecture with 25% piece color opacity.

## Components

### Buttons
- **Primary Action (Call to Action / Play / Resume)**:
  - Background: Solid `#5B7CFA`.
  - Content Text: `#0F1217` with Sora 600 weight. White text is strictly forbidden.
  - Border: None.
  - Focus / Active Ring: 2px offset ring using `#5B7CFA` with 2px gap (`#0F1217`).
  - Active Press: Micro-scale scale compression to `0.98`, background shifts to `#4B6DEB`.
  - Height: Minimum 48px to satisfy the 44px ergonomics requirement.
- **Secondary Action (Settings, Restart)**:
  - Background: `#1E2530`.
  - Content Text: `#E6E9EF` with Sora 500 weight.
  - Border: 1px solid `#262F3D`.
  - Active Press: Background shifts to `#262F3D`.
- **Tertiary / Utility (Icon Buttons, Back Navigation)**:
  - Background: Transparent.
  - Content / Icon: `#8A93A3`.
  - Border: 1px solid transparent. Hover/Active brings a 1px border of `#1E2530` and icon color shifts to `#E6E9EF`. Target area is padded out to 44×44px minimum.

### HUD Panels & Cards (Next, Hold, Metrics)
- Container: Surface `#161B22`, 12px radius, 1px perimeter border in `#262F3D`.
- Header Segment: Label-sm in JetBrains Mono (`#8A93A3`, uppercase, tracked +0.08em).
- Payload Field: Surface `#1E2530` recessed sub-well with 8px radius. Blocks scale down inside using integer scaling (e.g., 16px or 20px minified block footprint).

### Score & Stat Counters
- Typography: JetBrains Mono. Primary score rendered in `display-stat-lg` with `#E6E9EF`.
- Alignment: Right-aligned numerical columns when in tabular lists; centered when inside standalone telemetry cards.
- Label: Top-stacked, muted `#8A93A3` Sora 10px bold uppercase.

### Segmented Controls & Toggles
- Track: `#0F1217` recessed gutter with 1px `#1E2530` stroke, 8px radius.
- Active Indicator: `#1E2530` pill with 1px `#262F3D` border, elevating the active choice without distracting vibrancy.
- Active Text: `#E6E9EF` (Sora 500). Inactive Text: `#8A93A3` (Sora 400).

### Inputs & Modals
- Input Track: Background `#161B22`, border 1px `#262F3D`, text `#E6E9EF` in JetBrains Mono.
- Focus State: Border color switches cleanly to `#5B7CFA` without exterior glow blooms.
- Modal Containers: Grounded in `#161B22`, 16px corner radius, 1px `#262F3D` border, centered on screen with padding `space-xl` (24px).