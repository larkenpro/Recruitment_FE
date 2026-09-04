import { Grid } from 'antd'

/**
 * Design tokens for the app.
 *
 * Everything visual that repeats — type, spacing, ink colours — is defined once here
 * and consumed everywhere else. To restyle the app, change these values; do not add
 * new raw pixel numbers in pages.
 */

// ── Type ────────────────────────────────────────────────────────────────────

export const FONT_FAMILY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

/** The only font sizes the app uses. Anything not on this scale is a bug. */
export const FONT_SIZE = {
  caption: 11,
  small: 12,
  body: 13,
  base: 14,
  subtitle: 15,
  title: 16,
  heading: 18,
  metric: 22,
  display: 28,
  hero: 40,
}

export const FONT_WEIGHT = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800,
}

/** Text colours. Values, labels and captions wear these — never a series/brand colour. */
export const INK = {
  primary: '#1f2937',
  secondary: '#595959',
  muted: '#6b7280',
  faint: '#9ca3af',
  brand: '#4f46e5',
  onBrand: '#ffffff',
}

/**
 * Semantic text styles — spread onto a style prop so similar components stay identical:
 *   <span style={TEXT.cardTitle}>…</span>
 * Prefer these over naming a raw FONT_SIZE at the call site.
 */
export const TEXT = {
  hero: { fontSize: FONT_SIZE.hero, fontWeight: FONT_WEIGHT.bold, color: INK.primary, lineHeight: 1.1 },
  display: { fontSize: FONT_SIZE.display, fontWeight: FONT_WEIGHT.bold, color: INK.primary, lineHeight: 1.2 },
  metric: { fontSize: FONT_SIZE.metric, fontWeight: FONT_WEIGHT.semibold, color: INK.primary, lineHeight: 1.25 },
  pageTitle: { fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.semibold, color: INK.primary, lineHeight: 1.3 },
  cardTitle: { fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.semibold, color: INK.primary, lineHeight: 1.35 },
  sectionTitle: { fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, color: INK.primary, lineHeight: 1.4 },
  body: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.regular, color: INK.primary, lineHeight: 1.55 },
  bodyCompact: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.regular, color: INK.primary, lineHeight: 1.5 },
  label: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.medium, color: INK.muted, lineHeight: 1.4 },
  caption: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.regular, color: INK.faint, lineHeight: 1.4 },
}

// ── Spacing ─────────────────────────────────────────────────────────────────

/** 4px base scale. Every gap, margin and pad should come from here. */
export const SPACE = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
}

export const RADIUS = { control: 8, card: 12, pill: 999 }

/**
 * Standard <Row gutter={GUTTER}> spacing.
 *
 * Both axes are set on purpose: a bare `gutter={16}` is horizontal only, so columns
 * that stack on a phone end up flush against each other. antd resolves the
 * breakpoint objects itself, so this needs no hook.
 *
 * The vertical axis deliberately mirrors `sectionGap` below: once columns stack,
 * the gap between two cards in one Row and the gap between two Rows are the same
 * kind of gap, and they looked wrong at different sizes.
 */
export const GUTTER = [
  { xs: SPACE.sm, md: SPACE.md },
  { xs: SPACE.md, lg: SPACE.lg },
]

// ── Responsive rhythm ───────────────────────────────────────────────────────

/**
 * One place that decides how the layout breathes at each width, so mobile and
 * laptop stay internally consistent instead of each page inventing its own gaps.
 * `lg` is the same breakpoint Layout.jsx uses to swap the sidebar for a drawer.
 */
export function useLayoutMetrics() {
  const screens = Grid.useBreakpoint()
  // Undefined on first render, before media queries resolve — treat as desktop.
  const isMobile = screens.lg === false
  const isNarrow = screens.md === false

  return {
    isMobile,
    isNarrow,
    /** Padding inside the page content area. */
    pagePadding: isMobile ? SPACE.sm : SPACE.lg,
    /** Vertical gap between top-level sections/cards on a page. */
    sectionGap: isMobile ? SPACE.md : SPACE.lg,
    /** Gutter passed to <Row gutter={...}>. */
    gutter: isMobile ? SPACE.sm : SPACE.md,
    /** Gap between inline controls (filters, toolbars). */
    controlGap: isMobile ? SPACE.xs : SPACE.sm,
  }
}

// ── antd theme ──────────────────────────────────────────────────────────────

/**
 * Feeding the scale to ConfigProvider is what makes antd's own components —
 * Table, Form, Card, Button, Modal — share this typography without every page
 * restyling them by hand.
 */
export const antdTheme = {
  token: {
    colorPrimary: INK.brand,
    colorText: INK.primary,
    colorTextSecondary: INK.secondary,
    colorTextTertiary: INK.muted,
    colorTextDescription: INK.muted,
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.base,
    fontSizeSM: FONT_SIZE.small,
    fontSizeLG: FONT_SIZE.title,
    fontSizeHeading1: FONT_SIZE.display,
    fontSizeHeading2: FONT_SIZE.metric,
    fontSizeHeading3: FONT_SIZE.heading,
    fontSizeHeading4: FONT_SIZE.title,
    fontSizeHeading5: FONT_SIZE.subtitle,
    borderRadius: RADIUS.control,
    padding: SPACE.md,
    margin: SPACE.md,
  },
  components: {
    Card: { borderRadiusLG: RADIUS.card, fontWeightStrong: FONT_WEIGHT.semibold },
    Table: { fontSize: FONT_SIZE.body, headerBg: '#fafafa' },
    Statistic: { titleFontSize: FONT_SIZE.small, contentFontSize: FONT_SIZE.metric },
    Menu: { fontSize: FONT_SIZE.base },
    Form: { labelFontSize: FONT_SIZE.small },
    Tag: { fontSizeSM: FONT_SIZE.caption },
  },
}
