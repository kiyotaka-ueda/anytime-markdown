/** Community ロール（Primary / Secondary / Dependency）の色・ラベル定義。
 *  FcMapCanvas の凡例・C4ViewerCore のバッジで共通利用する。 */

export const COMMUNITY_ROLE_SECONDARY_COLOR = '#66BB6A';

/** ロール略称ラベル（P / S / D） */
export const COMMUNITY_ROLE_LABELS: Readonly<Record<'primary' | 'secondary' | 'dependency', string>> = {
  primary: 'P',
  secondary: 'S',
  dependency: 'D',
};

/** 背景色マップを返す。`accent` は theme 由来で渡す。 */
export function getCommunityRoleBgColors(
  accent: string,
  isDark: boolean,
): Readonly<Record<'primary' | 'secondary' | 'dependency', string>> {
  return {
    primary: accent,
    secondary: COMMUNITY_ROLE_SECONDARY_COLOR,
    dependency: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.10)',
  };
}
