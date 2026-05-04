/** vscode.Disposable の汎用代替 */
export interface Disposable {
  dispose(): void;
}

/** セッション内で編集されたファイルの記録 */
export interface SessionEdit {
  readonly file: string;
  /** UTC ISO 8601 (例: "2026-04-16T11:28:59.778Z") */
  readonly timestamp: string;
}

export interface ClaudeStatus {
  readonly editing: boolean;
  readonly file: string;
  /** UTC ISO 8601 (例: "2026-04-16T11:28:59.778Z") */
  readonly timestamp: string;
  /** Claude Code のセッション ID */
  readonly sessionId?: string;
  /** セッション内で編集したファイルの累積履歴 */
  readonly sessionEdits?: readonly SessionEdit[];
  /** プランファイルから抽出した計画対象ファイルの絶対パス配列 */
  readonly plannedEdits?: readonly string[];
  /** 現在の git ブランチ名 */
  readonly branch?: string;
}

/** マルチエージェント監視で使用するエージェント情報 */
export interface AgentInfo {
  readonly sessionId: string;
  readonly editing: boolean;
  readonly file: string;
  readonly timestamp: string;
  readonly branch: string;
  readonly sessionEdits: readonly SessionEdit[];
  readonly plannedEdits: readonly string[];
  /** JSONL の ai-title エントリから取得したセッションタイトル */
  readonly sessionTitle?: string;
}

export type StatusChangeCallback = (editing: boolean, filePath: string) => void;
export type MultiStatusChangeCallback = (agents: ReadonlyMap<string, AgentInfo>) => void;
