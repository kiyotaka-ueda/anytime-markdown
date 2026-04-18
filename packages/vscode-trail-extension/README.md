# Anytime Trail

![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/anytime-trial.anytime-trail?label=VS%20Marketplace&logo=visual-studio-code)![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=alert_status)![Bugs](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=bugs)![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=code_smells)![Coverage](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=coverage)![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=duplicated_lines_density)

**See your architecture while you code.**

Analyze TypeScript projects to auto-generate C4 architecture diagrams and DSM (Dependency Structure Matrix).\
Visualize Claude Code session logs to analyze your AI-assisted work history.\
Share screenshots and visual context with Claude Code via the built-in Note panel.


## Note — Share Screenshots with AI

The **Note** panel (top of the sidebar) lets you manage multi-page notes and share visual context with Claude Code.

**How to use:**

1. Click **Note** in the sidebar and press `+` to create a new page
2. Open the note in Anytime Markdown and paste screenshots or tables from your clipboard
3. Run `/anytime-note fix this bug` in Claude Code
4. AI reads the images in the note and performs the task

> When Claude Code is installed, the `/anytime-note` skill is auto-generated on first note creation.

**Toolbar actions**

| Icon | Action |
| --- | --- |
| `+` | Add a new note page |
| book | Open the `/anytime-note` skill file |
| trash | Clear all note pages and images |

> Note files are saved in this extension's VS Code global storage.\
> The skill file is generated at `~/.claude/skills/anytime-note/SKILL.md`.


## C4 Architecture Diagrams & DSM

One command visualizes your entire TypeScript project structure at four levels of detail.

| Level | What you see |
| --- | --- |
| L1 System Context | The system and its external relationships |
| L2 Container | Apps, APIs, databases, and other building blocks |
| L3 Component | Dependencies between packages and modules |
| L4 Code | Every file-level dependency |

![C4 Mermaid diagram example](images/c4-mermaid.png)

**Live Viewer** (`http://localhost:19841`)

- Three-pane layout: C4 graph, DSM matrix, and element tree
- Drill down with L1 through L4 level switching
- Cluster related modules in the DSM
- Circular dependencies highlighted in red
- Re-analysis and imports in VS Code are reflected instantly (WebSocket)
- **F-C Map**: Feature-Component matrix view (toggle inside the DSM pane)
- **Deleted elements**: Elements removed by re-analysis are flagged as deleted and shown with strikethrough
- **Document links**: Markdown files with `c4Scope` frontmatter are indexed and linked to C4 elements in the viewer
- **Claude activity overlay**: Files currently being edited by Claude Code are highlighted on the C4 graph

**Import / Export**

- Import Mermaid C4 diagrams (`.mmd`)
- Export as JSON or Mermaid format


## Trail Viewer — Claude Code Session Analysis

Opens a browser viewer at `http://localhost:19841` to analyze Claude Code session logs.

**Import**

JSONL logs written by Claude Code to `~/.claude/` are imported into a local SQLite database.\
Run the import manually via the inline button on the SQLite row in the **Database** panel.

**Viewer features**

- Session list with filtering by branch, model, and date
- Analytics tab: cost estimation by model and date, tool usage stats, commit statistics
- Prompts tab: Claude Code skills and `settings.json` content

**Remote sync**

Sync the local SQLite data to Supabase or PostgreSQL for multi-developer or cloud backup use.


## AI Memory

The **Memory** panel lists Claude Code memory files for the current project.\
Click any entry to open and edit it in Anytime Markdown.

> Reads from `~/.claude/projects/<project>/memory/`.\
> Hidden when Claude Code is not installed.


## Coverage Integration

Set `anytimeTrail.coverage.path` to point to a `coverage-final.json` file.\
Coverage data is automatically detected on file change and pushed into the C4 viewer.

- Coverage snapshots are stored per change (configurable limit via `coverage.historyLimit`)
- Run coverage tests directly from the L4 node in the C4 tree via the right-click menu


## Getting Started

### 1. Run C4 analysis

`Ctrl+Shift+P` → `C4: Analyze Code`

A browser tab opens automatically showing your project's architecture.\
Subsequent analyses update the existing tab in real time — no new tabs are opened.

> To import a Mermaid C4 file instead, use `Anytime Trail: Import C4`.

### 2. Open the Trail Viewer

Click **Open Trail Viewer** in the **Dashboard** sidebar panel, or run `Anytime Trail: Open Trail Viewer`.\
The browser opens at `http://localhost:19841`.

To import JSONL session logs, click the inline button on the SQLite row in the **Database** panel.

### 3. Claude Code hooks (auto-setup)

When the extension activates, it automatically registers Claude Code hooks in `~/.claude/settings.json`.\
This enables real-time file-editing status tracking without any manual configuration.


## Configuration

| Key | Default | Description |
| --- | --- | --- |
| `anytimeTrail.trailServer.port` | `19841` | Server port number |
| `anytimeTrail.c4.analyzeExcludePatterns` | `[".worktrees", ...]` | Directory patterns to exclude from C4 analysis |
| `anytimeTrail.docsPath` | `""` | Absolute path to the documentation directory for C4 document links |
| `anytimeTrail.coverage.path` | `""` | Path to `coverage-final.json` (relative to workspace root) |
| `anytimeTrail.coverage.historyLimit` | `50` | Maximum number of coverage history snapshots to keep |
| `anytimeTrail.test.e2eCommand` | `cd packages/web-app && npm run e2e` | Command to run E2E tests (executed in terminal) |
| `anytimeTrail.test.coverageCommand` | `npx jest --coverage --maxWorkers=1` | Command to run tests with coverage (executed in terminal) |
| `anytimeTrail.database.storagePath` | `""` | Directory for `trail.db`. Absolute or relative to workspace root. Defaults to `.vscode/` |
| `anytimeTrail.claudeStatus.directory` | `""` | Directory for `claude-code-status.json`. Defaults to `.vscode/` |
| `anytimeTrail.remote.provider` | `none` | Remote DB provider (`none` / `supabase` / `postgres`) |
| `anytimeTrail.remote.supabaseUrl` | `""` | Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `anytimeTrail.remote.supabaseAnonKey` | `""` | Supabase anon key |
| `anytimeTrail.remote.postgresUrl` | `""` | PostgreSQL connection string (e.g. `postgres://user:pass@host:5432/db`) |


## License

[MIT](https://github.com/anytime-trial/anytime-markdown/blob/master/LICENSE)
