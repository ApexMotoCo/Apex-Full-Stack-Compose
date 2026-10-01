# ⚡ APEX BRANDING GUIDE

All Apex projects must follow this branding standard. Every deliverable needs Apex branding embedded by default.

## Colors

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| **Primary** | Vibrant Orange | `#ff6b35` | Main CTA, logos, accents |
| **Secondary** | Deep Blue | `#004e89` | Headers, sections |
| **Accent** | Golden | `#f7931e` | Highlights, hover states |
| **Dark** | Dark Navy | `#0a0e27` | Backgrounds, text |
| **Light** | Light Gray | `#f5f7fa` | Card backgrounds |
| **Border** | Soft Gray | `#e0e6ed` | Dividers, borders |

## Status Colors

| Status | Color | Hex | Purpose |
|--------|-------|-----|---------|
| **Online** | Green | `#10b981` | Service healthy |
| **Offline** | Red | `#ef4444` | Service down |
| **Degraded** | Amber | `#f59e0b` | Service issues |

## Logo & Typography

- **Logo**: ⚡ APEX
- **Tagline**: "In Good Company"
- **Font Family**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Logo Size**: Minimum 32px, display at 2.5em+ on headers

## Gradients

### Primary Gradient
```
linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)
```
Used for: Buttons, headers, logos, CTAs

### Secondary Gradient
```
linear-gradient(135deg, #0a0e27 0%, #1a2a4e 100%)
```
Used for: Page backgrounds, dark sections

### Overlay Gradient
```
linear-gradient(135deg, #ffffff 0%, #e0e6ed 100%)
```
Used for: Text overlays, subtle effects

## Components

### Buttons
- Background: Primary gradient
- Color: White
- Padding: 0.75rem 1.5rem
- Border Radius: 8px
- Font Weight: 600
- Hover: translateY(-2px) + shadow

### Cards
- Background: White
- Border: 5px left solid primary color
- Border Radius: 12px
- Padding: 1.5rem
- Shadow: 0 4px 12px rgba(0, 0, 0, 0.1)
- Hover: Translate up + enhanced shadow

### Badges
- Border Radius: 20px
- Font Weight: 700
- Font Size: 0.9em
- Text Transform: UPPERCASE
- Letter Spacing: 0.5px

### Headers
- Background: Secondary gradient
- Color: White
- Border Bottom: 3px solid primary
- Padding: 2rem

## CSS Classes

Include `public/apex-branding.css` in all HTML projects:

```html
<link rel="stylesheet" href="apex-branding.css">
```

Available classes:
- `.apex-logo` - Branded logo
- `.apex-header` - Page header
- `.apex-badge` - Info badge
- `.apex-badge-primary` - Primary badge
- `.apex-badge-secondary` - Secondary badge
- `.apex-button` - CTA button
- `.apex-card` - Content card
- `.apex-input` - Form input
- `.apex-footer` - Page footer
- `.apex-status-online` - Online indicator
- `.apex-status-offline` - Offline indicator
- `.apex-status-degraded` - Degraded indicator
- `.apex-animate-pulse` - Pulsing animation
- `.apex-animate-slide` - Slide-in animation

## HTML Header Template

Every new HTML project should include:

```html
<link rel="stylesheet" href="apex-branding.css">

<header class="apex-header">
  <div class="apex-logo">⚡ APEX</div>
  <h1>Project Name</h1>
  <p class="tagline">In Good Company</p>
</header>

<main>
  <!-- Your content -->
</main>

<footer class="apex-footer">
  <p>⚡ Apex In Good Company - Project v1.0</p>
</footer>
```

## Node.js/JavaScript

Import branding constants:

```javascript
const APEX_BRAND = require('./apex-branding.js');

// Use colors
const primaryColor = APEX_BRAND.colors.primary;  // #ff6b35

// Use gradients
const gradient = APEX_BRAND.gradients.primary;   // linear-gradient(...)

// Use logo
const logo = APEX_BRAND.logo;                    // ⚡ APEX
```

## Emails

All emails should include:
- Header with Apex gradient background
- Primary color for links/CTAs
- Footer with "⚡ Apex In Good Company" branding
- Orange accent colors for important information

## Documentation

All documentation headers should include:
```markdown
# ⚡ [Project Name]

**Apex In Good Company**

---
```

## Dashboard/UI Standards

✅ **Must Have:**
- Apex color scheme applied throughout
- Primary orange for all CTAs and buttons
- Golden accents for hover states
- Blue for secondary actions
- Pulsing status indicators
- Smooth animations and transitions
- Professional gradient backgrounds
- "In Good Company" tagline visible

❌ **Must NOT Have:**
- Generic/default colors
- Plain grey/blue schemes
- No branding visible
- Poor contrast on text
- Harsh, sudden transitions

## Checklist for Every Build

- [ ] Apex colors embedded in design
- [ ] Logo/⚡ symbol visible
- [ ] "In Good Company" tagline included
- [ ] Gradient backgrounds applied
- [ ] Professional animations
- [ ] Brand-consistent typography
- [ ] Proper status color scheme
- [ ] Mobile responsive
- [ ] Accessible contrast ratios
- [ ] Footer with Apex branding

---

**Version**: 1.0  
**Last Updated**: 2024-01-15  
**Standard**: Required for all Apex deliverables
