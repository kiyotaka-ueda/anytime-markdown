# Anytime Markdown Editor

**Review AI-generated docs while you code — all inside VS Code.**

AI assistants are great at writing specs, designs, and notes in Markdown. But reviewing them in plain text is painful, and switching between your editor and a Git GUI breaks your flow.

Anytime Markdown gives you a rich WYSIWYG editor with built-in Git support, so you can **open a docs repository right next to your code** and keep everything in one window.

## What You Can Do

- **Open multiple doc repos** in the sidebar alongside your source code
- **Review AI output** with live-rendered tables, diagrams (Mermaid / PlantUML), and math
- **Compare versions** side-by-side with diff highlighting
- **Commit and push** docs without leaving VS Code
- **Track history** with a visual Git graph and per-file timeline

## How It Works

1. AI generates a Markdown document
2. Open the docs repo in the **Markdown Docs** panel
3. Review in **WYSIWYG** or **Review** mode
4. Compare with previous versions
5. Edit, commit, push — done

## Editor Modes

| Mode | What it does |
| --- | --- |
| **WYSIWYG** | Visual editing with formatting, diagrams, and tables |
| **Source** | Edit raw Markdown directly |
| **Review** | Read-only. Great for reviewing AI output |

Switch with the toolbar toggles or `Ctrl+Alt+S` (`Cmd+Alt+S` on Mac).

## Sidebar Panels

- **Markdown Docs** — file tree with multi-repo support, branch switching, Markdown filter
- **Changes** — stage, unstage, discard, commit, push (per repo)
- **Graph** — visual commit log (blue = local, red = remote)
- **Timeline** — file history, click to compare

## Slash Commands

Type `/` to insert: headings, lists, tables, code blocks, Mermaid / PlantUML diagrams, math (KaTeX), HTML, TOC, footnotes, admonitions, comments, and more.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `anytimeMarkdown.fontSize` | `0` | Font size (px). 0 = VS Code default |
| `anytimeMarkdown.editorMaxWidth` | `0` | Max editor width (px). 0 = no limit |

## Getting Started

`.md` / `.markdown` files open with Anytime Markdown automatically. To use the standard text editor instead, right-click a file and choose **"Open With..."** > **"Text Editor"**.

Requires VS Code 1.109.0 or later.

## License

MIT
