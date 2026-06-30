# Sakamura Design Guideline (DESIGN.md)

This document defines the core visual identity, design tokens, typography, and implementation guidelines for all websites created by **Kusuke SAKAMURA**. The styles and rules defined here are designed to maintain a consistent, premium, and unified aesthetic across all projects.

---

## 1. Design Premise

Every site created under this system must prioritize:
1. **Minimalism & Refined Textures**: Clean, lightweight interfaces with monospace details, paired with subtle organic gradients and smooth transitions.
2. **Algorithmic Harmony**: A balance of precise layouts and satisfying micro-interactions.
3. **Structured Restraint**: Restricting font sizes, utilizing padding/margins for hierarchy, and using accent colors selectively.

---

## 2. Color System & Tokens

### Design Tokens (CSS Variables)

Here is the complete palette and design tokens. These tokens form the basis of the stylesheet.

| Token | CSS Variable | Value | Purpose / Description |
| :--- | :--- | :--- | :--- |
| **Background Primary** | `--color-bg-primary` | `#ffffff` | Primary background color (clean, crisp white) |
| **Foreground Primary** | `--color-fg-primary` | `#252525` | Primary body text and headings (rich dark charcoal) |
| **Foreground Secondary** | `--color-fg-secondary` | `#999999` | Secondary text, captions, and muted labels |
| **Border** | `--color-border` | `rgba(0, 0, 0, 0.08)` | Default border color (soft, subtle gray line) |
| **Border Light** | `--color-border-light` | `rgba(255, 255, 255, 0.25)` | Light overlay border for dark/WebGL backgrounds |
| **Accent** | `--color-accent` | `#f5b111` | Primary accent color (gold / warm amber) |
| **Accent Light** | `--color-accent-light` | `#fff4d9` | Highlight background color for text selections or badges |

### Gradient Palette

For pages requiring generative shaders, haze gradients, or hero backgrounds:

- `--color-haze-1`: `#BFBDB8` (Muted Grey / Haze)
- `--color-haze-2`: `#D99A25` (Golden / Amber)
- `--color-haze-3`: `#D9AC59` (Muted Gold / Ochre)
- `--color-haze-4`: `#BFA77A` (Tan / Sand)
- `--color-haze-5`: `#F29C6B` (Orange-Salmon / Dusk)

---

## 3. Typography

Hierarchy is established through typographic contrast and spacing rather than large font sizes.

### Fonts
1. **Sans-serif (`var(--font-sans)`)**: `Inter` (or system sans-serif fallback)
   - Used for primary UI elements and body copy.
2. **Monospace (`var(--font-mono)`)**: `IBM Plex Mono` (proportional Japanese fonts like Hiragino Kaku Gothic ProN / Meiryo are used as fallbacks for Japanese characters to avoid blocky monospace Japanese rendering).
   - Used for technical labels, buttons, dates, code blocks, and minor headers.

### Scale & Rules
- **Maximum Heading Size**: Heading sizes are strictly bounded. Headers should generally default to `1rem` with a semi-bold weight to keep the interface clean and unified.
- **Monospace Headers**: `h2` headings should leverage the monospace font to emphasize structure.
- **Body & Secondary Copy**: Compact sizing (`0.85rem` or ~13px to 14px) with high readability.

---

## 4. Complete Stylesheet (CSS)

The following CSS block defines the entire reset, design token configurations, and base utilities. You can copy this block directly to generate the main stylesheet of any project from scratch.

```css
/* ==========================================
   Sakamura Design System - Base Stylesheet
   ========================================== */

@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,600;1,400&family=Inter:wght@300;400;500;600;700&family=Noto+Serif+JP:wght@300;400;600&display=swap');

:root {
  /* Font Families */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
  --font-mono: 'IBM Plex Mono', SFMono-Regular, Consolas, "Liberation Mono", Menlo, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
  --font-serif: 'Noto Serif JP', Georgia, serif;

  /* Color System */
  --color-bg-primary: #ffffff;
  --color-fg-primary: #252525;
  --color-fg-secondary: #999999;
  --color-border: rgba(0, 0, 0, 0.08);
  --color-border-light: rgba(255, 255, 255, 0.25);
  --color-accent: #f5b111;
  --color-accent-light: #fff4d9;

  /* Gradient Palette */
  --color-haze-1: #BFBDB8;
  --color-haze-2: #D99A25;
  --color-haze-3: #D9AC59;
  --color-haze-4: #BFA77A;
  --color-haze-5: #F29C6B;

  /* Transition & Motion */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Base Reset & Defaults */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-sans);
  font-size: 0.85rem;
  line-height: 1.6;
  background-color: var(--color-bg-primary);
  color: var(--color-fg-primary);
}

/* Typography Defaults */
h1, h2, h3, h4, h5, h6 {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-fg-primary);
}

h2 {
  font-family: var(--font-mono);
  letter-spacing: 0.02em;
}

p {
  margin-bottom: 1em;
}

a {
  color: inherit;
  text-decoration: none;
  transition: color var(--transition-fast), opacity var(--transition-fast);
}

a:hover {
  color: var(--color-accent);
}

/* Core Layout Utilities */
.container {
  width: 100%;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

/* Interactive & State Classes */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-primary);
  color: var(--color-fg-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn:hover {
  background-color: rgba(0, 0, 0, 0.02);
  border-color: var(--color-accent);
}

.btn-primary {
  background-color: var(--color-accent);
  color: var(--color-bg-primary);
  border-color: var(--color-accent);
}

.btn-primary:hover {
  background-color: var(--color-fg-primary);
  border-color: var(--color-fg-primary);
  color: var(--color-bg-primary);
}

/* Selection */
::selection {
  background-color: var(--color-accent-light);
  color: var(--color-fg-primary);
}
```

---

## 5. Development & Implementation Guidelines

Use the following rules to maintain consistency across all sites:

1. **Strict Design Tokens Only**
   - **Do not hardcode raw hex, RGB, or HSL color codes** in individual page code or markup. Always map classes or styles back to the CSS variables in the stylesheet.
   - **Do not hardcode arbitrary font sizes or margins** inline. If a new configuration is needed, define it globally within the CSS custom properties first.
2. **Minimalist Aesthetic Bounds**
   - Headings must not exceed `1rem` unless explicitly required by an exceptional layout design.
   - Primary content size should target `0.85rem`.
   - Structural flow should rely on spatial margins, line-heights, and padding rather than size scaling of characters.
3. **Accent Control**
   - Use `var(--color-accent)` sparingly. It is meant to guide the user's eyes to core actions or structural indicators, not dominate the interface.
4. **Transition Norms**
   - Make hover states and page switches smooth by using `--transition-fast` or `--transition-normal`. Ensure interactive elements respond naturally.
5. **Borderless Component Architecture (Dividers Only)**
   - **Do not wrap components or sections in bounding card boxes or borders.**
   - Separate layout sections and content columns using clean single horizontal or vertical divider lines (`1px solid var(--color-border)`) rather than full bounding rectangles.
   - Component blocks should blend transparently into the dynamic haze background rather than being enclosed in solid panel boxes.
6. **Flat Graphic Aesthetic (Zero Shadows)**
   - **Do not use shadows (box-shadow, text-shadow, filter: drop-shadow) anywhere on the interface.**
   - Visual depth and state transitions (focus, active, selection) must rely strictly on flat fills, borders, or highlights rather than depth-inducing gradients or drop shadows.
