/**
 * CodeGraph のコミュニティ番号 → 色の対応表。
 * `CodeGraphCanvas` と C4 モデルタブの Community オーバーレイで共有する。
 */
export const COMMUNITY_COLORS: readonly string[] = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ac',
];

export function communityColor(community: number): string {
  return COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
}
