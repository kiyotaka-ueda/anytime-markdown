/**
 * Community feature-map (fcmap) role colors — mode-independent.
 * Used by C4ViewerCore fcmapColorMap to color nodes by P/S/D role.
 */

export const COMMUNITY_ROLE_COLORS: Readonly<Record<string, string>> = {
  primary:    '#e53935',
  secondary:  '#1e88e5',
  dependency: '#fb8c00',
} as const;
