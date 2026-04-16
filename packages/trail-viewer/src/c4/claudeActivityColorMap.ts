// Claude Code 活動オーバーレイ用の色マップを生成する
// active（現在編集中）・touched（セッション累積）・planned（計画対象）で異なる色を使用する

const COLOR_ACTIVE_DARK    = 'rgba(255, 152, 0, 0.5)';    // オレンジ（ダーク）
const COLOR_ACTIVE_LIGHT   = 'rgba(230, 120, 0, 0.4)';    // オレンジ（ライト）
const COLOR_TOUCHED_DARK   = 'rgba(100, 181, 246, 0.35)'; // 水色（ダーク）
const COLOR_TOUCHED_LIGHT  = 'rgba(30, 120, 200, 0.25)';  // 水色（ライト）
const COLOR_PLANNED_DARK   = 'rgba(171, 71, 188, 0.35)';  // 紫（ダーク）
const COLOR_PLANNED_LIGHT  = 'rgba(140, 40, 160, 0.25)';  // 紫（ライト）

export function computeClaudeActivityColorMap(
  activeElementIds: readonly string[],
  touchedElementIds: readonly string[],
  plannedElementIds: readonly string[],
  isDark: boolean,
): Map<string, string> {
  const map = new Map<string, string>();

  // planned を最初に設定（優先度最低）
  const plannedColor = isDark ? COLOR_PLANNED_DARK : COLOR_PLANNED_LIGHT;
  for (const id of plannedElementIds) {
    map.set(id, plannedColor);
  }

  // touched は planned より後に設定することで上書き（優先）される
  const touchedColor = isDark ? COLOR_TOUCHED_DARK : COLOR_TOUCHED_LIGHT;
  for (const id of touchedElementIds) {
    map.set(id, touchedColor);
  }

  // active は touched より後に設定することで上書き（優先）される
  const activeColor = isDark ? COLOR_ACTIVE_DARK : COLOR_ACTIVE_LIGHT;
  for (const id of activeElementIds) {
    map.set(id, activeColor);
  }

  return map;
}
