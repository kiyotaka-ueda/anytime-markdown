import * as fs from 'node:fs';
import * as path from 'node:path';

export interface InstallSkillLogger {
  readonly info: (message: string) => void;
  readonly warn: (message: string) => void;
  readonly error: (message: string) => void;
}

export interface InstallBundledSkillsOptions {
  /** `~/.claude` 相当のディレクトリ。テストでは tmp dir を渡す。本番では os.homedir() 経由で組み立てる。 */
  readonly claudeDir: string;
  /** 拡張機能のインストール先（context.extensionPath）。同梱 `skills/trail-design/SKILL.md` の探索ベース。 */
  readonly extensionPath: string;
  /** true 指定時は既存ファイルが bundle と異なっていても上書きする。 */
  readonly force?: boolean;
  /** ログ出力。テストでは jest.fn() でキャプチャする。 */
  readonly logger?: InstallSkillLogger;
}

export interface InstallBundledSkillsResult {
  /** SKILL.md を新規 / force で書き出したか */
  readonly installed: boolean;
  /** 既存と一致 or claudeDir 不在で何もしなかったか */
  readonly skipped: boolean;
  /** 既存ファイルがあり差分のため上書きを保留したか */
  readonly preserved: boolean;
  /** 旧 build-code-graph ディレクトリを削除したか */
  readonly removedOld: boolean;
}

const SKILL_NAME = 'anytime-reverse-engineer';
const OLD_SKILL_NAMES: readonly string[] = ['build-code-graph', 'trail-design'];
const SKILL_FILE = 'SKILL.md';

const NOOP_LOGGER: InstallSkillLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export function installBundledSkills(opts: InstallBundledSkillsOptions): InstallBundledSkillsResult {
  const logger = opts.logger ?? NOOP_LOGGER;
  const force = opts.force === true;

  if (!fs.existsSync(opts.claudeDir)) {
    return { installed: false, skipped: true, preserved: false, removedOld: false };
  }

  const skillsRoot = path.join(opts.claudeDir, 'skills');

  // 1. 旧ディレクトリ cleanup（リテラル名のホワイトリストで限定）
  let removedOld = false;
  for (const oldName of OLD_SKILL_NAMES) {
    const oldDir = path.join(skillsRoot, oldName);
    if (!fs.existsSync(oldDir)) continue;
    try {
      fs.rmSync(oldDir, { recursive: true, force: true });
      logger.info(`[install-skills] removed old skill dir: ${oldDir}`);
      removedOld = true;
    } catch (err) {
      logger.warn(`[install-skills] failed to remove ${oldDir}: ${String(err)}`);
    }
  }

  // 2. 同梱 SKILL.md 確認
  const bundledPath = path.join(opts.extensionPath, 'skills', SKILL_NAME, SKILL_FILE);
  if (!fs.existsSync(bundledPath)) {
    logger.warn(`[install-skills] bundled skill not found: ${bundledPath}`);
    return { installed: false, skipped: true, preserved: false, removedOld };
  }

  const targetDir = path.join(skillsRoot, SKILL_NAME);
  const targetPath = path.join(targetDir, SKILL_FILE);

  // 3. 既存ファイル評価
  if (fs.existsSync(targetPath) && !force) {
    const targetContent = fs.readFileSync(targetPath, 'utf-8');
    const bundledContent = fs.readFileSync(bundledPath, 'utf-8');
    if (targetContent === bundledContent) {
      logger.info(`[install-skills] ${SKILL_NAME} SKILL.md up-to-date`);
      return { installed: false, skipped: true, preserved: false, removedOld };
    }
    logger.info(
      `[install-skills] ${SKILL_NAME} SKILL.md exists with local edits, preserving (run "Anytime Trail: スキル再インストール" to overwrite)`,
    );
    return { installed: false, skipped: false, preserved: true, removedOld };
  }

  // 4. 書き出し（新規 or force）
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(bundledPath, targetPath);
    logger.info(`[install-skills] installed ${SKILL_NAME} SKILL.md → ${targetPath}`);
    return { installed: true, skipped: false, preserved: false, removedOld };
  } catch (err) {
    logger.error(
      `[install-skills] failed to install ${SKILL_NAME}: ${String(err)}\n${err instanceof Error ? err.stack ?? '' : ''}`,
    );
    return { installed: false, skipped: true, preserved: false, removedOld };
  }
}
