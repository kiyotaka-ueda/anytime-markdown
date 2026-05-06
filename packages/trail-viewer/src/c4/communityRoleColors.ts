/** Community ロール（Primary / Secondary / Dependency）の色・ラベル定義。
 *  OverlayLegend の fcmap 凡例・FcMapCanvas・C4ViewerCore のバッジで共通利用する。 */

/** ロール別の固定背景色（OverlayLegend の fcmap 凡例と一致させる） */
export const COMMUNITY_ROLE_COLORS: Readonly<Record<'primary' | 'secondary' | 'dependency', string>> = {
  primary: '#e53935',
  secondary: '#1e88e5',
  dependency: '#fb8c00',
};

/** ロール略称ラベル（P / S / D） */
export const COMMUNITY_ROLE_LABELS: Readonly<Record<'primary' | 'secondary' | 'dependency', string>> = {
  primary: 'P',
  secondary: 'S',
  dependency: 'D',
};

/** ロール別の背景色マップを返す（後方互換エイリアス）。 */
export function getCommunityRoleBgColors(): Readonly<Record<'primary' | 'secondary' | 'dependency', string>> {
  return COMMUNITY_ROLE_COLORS;
}
