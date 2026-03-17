# Anytime Markdown Editor

**Manage AI-generated documents alongside your code — in a single VS Code window.**

Modern development workflows produce a growing volume of Markdown: specs written by AI assistants, design documents, meeting notes, and runbooks. Anytime Markdown lets you **open a separate documentation Git repository** right next to your source code, review AI-generated Markdown with a rich WYSIWYG editor, and track changes — all without leaving VS Code.

## Why Anytime Markdown?

| Pain point | How Anytime Markdown helps |
| --- | --- |
| AI outputs Markdown that's hard to review in plain text | WYSIWYG editor with live diagrams, tables, and math rendering |
| Docs live in a separate repo but you need them while coding | Open multiple Git repositories side-by-side in the Markdown Docs panel |
| Reviewing diffs of AI-generated docs is tedious | Built-in compare mode with block-level diff highlighting |
| Switching between editor and Git GUI breaks your flow | Git changes, graph, and timeline panels integrated in the sidebar |

## Key Features

### Markdown Docs Panel — Your Documentation Hub

Open one or more Git repositories dedicated to documentation. Each repository appears as a top-level node with full file tree, branch switching, and file operations (create, rename, delete, drag & drop). A Markdown-only filter keeps the view focused.

### Built-in Git Workflow

- **Changes panel**: staged / unstaged changes grouped by repository, with stage, unstage, discard, commit, and push
- **Git Graph**: visual commit history with colored icons (blue = local, red = pushed to remote)
- **Timeline**: per-file commit history — select any commit to load it into the compare panel

### Rich WYSIWYG Editing

Edit Markdown visually with real-time preview. Supports tables (paste from Excel / Google Sheets), Mermaid and PlantUML diagrams, KaTeX math, code blocks with syntax highlighting (37 languages), admonitions, task lists, footnotes, and more.

### Compare & Merge Mode

Side-by-side diff comparison with block-level highlighting. Load any file or past commit into the compare panel. Full-screen table comparison with cell-level diff highlighting.

### Three Editor Modes

| Mode | Description |
| --- | --- |
| **WYSIWYG** | Rich text editing with visual formatting and block insertion |
| **Source** | Edit raw Markdown text directly |
| **Review** | Read-only view for reviewing AI-generated content. Only comments and checkboxes are editable |

Switch modes via the pill-shaped toggles in the toolbar, or press `Ctrl+Alt+S`.

## Typical Workflow

1. AI assistant generates a spec or design document in Markdown
2. Clone or open the documentation repository in the **Markdown Docs** panel
3. Review the generated content in **Review** or **WYSIWYG** mode
4. Use **Compare mode** to diff against previous versions
5. Edit, commit, and push — all from the sidebar panels
6. Continue coding in VS Code with the documentation always accessible

## Slash Commands

Type `/` in the editor to insert elements:

`/heading1`..`/heading3`, `/bulletList`, `/orderedList`, `/taskList`, `/blockquote`, `/codeBlock`, `/table`, `/horizontalRule`, `/mermaid`, `/plantuml`, `/math`, `/html`, `/toc`, `/date`, `/footnote`, `/note`, `/tip`, `/important`, `/warning`, `/caution`, `/comment`

## Extension Settings

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `anytimeMarkdown.fontSize` | number | `0` | Font size (px). 0 uses VS Code default |
| `anytimeMarkdown.editorMaxWidth` | number | `0` | Editor max width (px). 0 for no limit |

## Usage

`.md` / `.markdown` files open automatically with Anytime Markdown editor.

To open with the standard VS Code text editor, right-click the file and select **"Open With..."** then choose **"Text Editor"**.

## Requirements

- VS Code 1.109.0 or later

## Known Issues

- Drag & drop images are embedded as base64. Large images will increase the Markdown file size.
- Markdown round-trip through TipTap may reformat content on load. A notification is shown on first load.

## License

MIT License
