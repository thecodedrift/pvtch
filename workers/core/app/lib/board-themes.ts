export interface BoardTheme {
  /** Outer container background. Use `transparent` for OBS overlays. */
  background: string;
  /** Default text color. */
  color: string;
  /** Font family (CSS font-family value). */
  fontFamily: string;
  /** Responsive font size. */
  fontSize: string;
  /** Default font weight (CSS font-weight value). */
  fontWeight: string;
  /** Container padding (inset from the edge of the browser source). */
  padding: string;
  /** Container border-radius (e.g. `'10%'`). */
  borderRadius: string;
}

const themes = {
  default: {
    background: 'transparent',
    color: 'white',
    fontFamily: 'inherit',
    fontSize: 'max(14px, min(2.5vh, 22px))',
    fontWeight: '400',
    padding: '0',
    borderRadius: '0',
  },
  sbg: {
    background: '#fffaed',
    color: '#423f3a',
    fontFamily: '"Quicksand", sans-serif',
    fontSize: 'max(14px, min(2.5vh, 22px))',
    fontWeight: '700',
    // Balanced rounded corners that scale with the smaller viewport
    // dimension (vmin), bounded so they don't blow up on huge sources.
    borderRadius: 'clamp(12px, 4vmin, 32px)',
    // Padding must be >= borderRadius or the rounded corners clip content.
    // Slightly larger than the radius leaves visual breathing room.
    padding: 'clamp(20px, 5.5vmin, 44px)',
  },
} as const satisfies Record<string, BoardTheme>;

export type BoardThemeName = keyof typeof themes;

export function isBoardThemeName(name: string): name is BoardThemeName {
  return name in themes;
}

export function resolveBoardTheme(name?: string | null): BoardTheme {
  if (name && isBoardThemeName(name)) return themes[name];
  return themes.default;
}
