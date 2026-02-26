## Basic Operations

The editor supports two modes and various file operations.

![Basic Operations](/help/basic-ops.png)

Switch modes using the toggle button group on the right side of the toolbar.

| Icon | Mode | Description |
| :--: | ---- | ----------- |
| ![WYSIWYG](/help/icons/wysiwyg.png) | WYSIWYG mode | Edit with rich-text formatting and real-time preview. |
| ![Source](/help/icons/source.png) | Source mode | Edit raw Markdown directly. The Image, Horizontal Rule, Table, Code Block, and Diagram insert buttons are also available, inserting the corresponding Markdown syntax at the end of the text. |

Switch between Normal Mode and Compare Mode using the toggle button group on the right side of the toolbar.

| Icon | Mode | Description |
| :--: | ---- | ----------- |
| ![Normal](/help/icons/normal-mode.png) | Normal Mode | Standard editing mode. |
| ![Compare](/help/icons/compare-mode.png) | Compare Mode | The editor splits into two panes with differences highlighted. The secondary (right) pane accepts direct text input or Markdown file upload. |

### File Operations

File operations are available from the toolbar.

| Icon | Action | Description |
| :--: | ------ | ----------- |
| ![New](/help/icons/create-new.png) | New | Clear the current content and create a new document. |
| ![Copy](/help/icons/copy.png) | Copy | Copy the entire document to the clipboard. |
| ![Import](/help/icons/upload.png) | Import | Load a Markdown file (.md). |
| ![Download](/help/icons/download.png) | Download | Download the document as a Markdown file (.md). |

| Icon | Action | Description |
| :--: | ------ | ----------- |
| ![Outline](/help/icons/outline.png) | Outline Toggle | Toggle the outline panel visibility from the toolbar. |

### Other

- More menu: Access Help Page, Editor Settings, and Version Info from the "⋮" button at the right end of the toolbar.
- Auto-save: Content is automatically saved to your browser's local storage.

## Text Decoration

Select text to show the bubble menu for applying formatting. Keyboard shortcuts are also available.

| Icon | Decoration | Shortcut | Description |
| :--: | ---------- | -------- | ----------- |
| ![Bold](/help/icons/bold.png) | Bold | Ctrl+B | Make selected text **bold**. |
| ![Italic](/help/icons/italic.png) | Italic | Ctrl+I | Make selected text *italic*. |
| ![Underline](/help/icons/underline.png) | Underline | Ctrl+U | Add underline to selected text. |
| ![Strikethrough](/help/icons/strikethrough.png) | Strikethrough | Ctrl+Shift+X | Add ~~strikethrough~~ to selected text. |
| ![Highlight](/help/icons/highlight.png) | Highlight | Ctrl+Shift+H | Highlight selected text. |
| ![Inline Code](/help/icons/inline-code.png) | Inline Code | Ctrl+E | Display selected text as `code`. |
| ![Link](/help/icons/link.png) | Link | Ctrl+K | Add a link to selected text. |

## Block Elements

Insert block-level elements via the toolbar or keyboard shortcuts.

| Icon | Element | Shortcut | Description |
| :--: | ------- | -------- | ----------- |
| ![Image](/help/icons/image.png) | Image | Ctrl+Alt+I | Insert an image by specifying a URL. |
| ![Horizontal Rule](/help/icons/horizontal-rule.png) | Horizontal Rule | Ctrl+Alt+R | Insert a divider line. |
| ![Table](/help/icons/table.png) | Table | Ctrl+Alt+T | Insert a 3×3 table. |
| ![Code Block](/help/icons/code-block.png) | Code Block | Ctrl+Alt+C | Insert a fenced code block with syntax highlighting. |
| ![Diagram](/help/icons/diagram.png) | Diagram | Ctrl+Alt+D | Insert a Mermaid or PlantUML diagram. |
| ![Template](/help/icons/template.png) | Template | Ctrl+Alt+P | Insert a predefined template. |

### Table

Insert and edit tables using the toolbar and in-table controls.

![Table](/help/table.png)

Floating table toolbar:

| Icon | Action | Description |
| :--: | ------ | ----------- |
| ![Add Column](/help/icons/add-column.png) | Add Column | Add a new column to the right of the current column. |
| ![Remove Column](/help/icons/remove-column.png) | Remove Column | Delete the current column. |
| ![Add Row](/help/icons/add-row.png) | Add Row | Add a new row below the current row. |
| ![Remove Row](/help/icons/remove-row.png) | Remove Row | Delete the current row. |
| ![Align Left](/help/icons/align-left.png) | Align Left | Align cell text to the left. |
| ![Align Center](/help/icons/align-center.png) | Align Center | Center cell text. |
| ![Align Right](/help/icons/align-right.png) | Align Right | Align cell text to the right. |
| ![Move Row Up](/help/icons/move-row-up.png) | Move Row Up | Move the current row up. |
| ![Move Row Down](/help/icons/move-row-down.png) | Move Row Down | Move the current row down. |
| ![Move Col Left](/help/icons/move-col-left.png) | Move Col Left | Move the current column to the left. |
| ![Move Col Right](/help/icons/move-col-right.png) | Move Col Right | Move the current column to the right. |
| ![Fullscreen](/help/icons/fullscreen.png) | Fullscreen | Edit the table in fullscreen mode. |

- Navigate cells with Tab (next cell) and Shift+Tab (previous cell).

### Diagrams (Mermaid)

Create diagrams using Mermaid syntax in a code block.

![Diagrams - Mermaid](/help/mermaid.png)

- Supported diagram types: Flowchart, Sequence, Class, ER, State Machine, Gantt, Mindmap, Git Graph, and more.

Floating toolbar:

| Icon | Action | Description |
| :--: | ------ | ----------- |
| ![Fold](/help/icons/fold.png) | Fold/Unfold | Collapse or expand the diagram view. |
| ![Fullscreen](/help/icons/fullscreen.png) | Fullscreen | View and edit the diagram in fullscreen mode. |
| ![Code Toggle](/help/icons/code-toggle.png) | Code Show/Hide | Toggle the code editor pane visibility. |
| ![Zoom Out](/help/icons/zoom-out.png) | Zoom Out | Zoom out the diagram. |
| ![Zoom In](/help/icons/zoom-in.png) | Zoom In | Zoom in the diagram. |
| ![Zoom Reset](/help/icons/zoom-reset.png) | Zoom Reset | Reset zoom and pan to the initial state. |

### Diagrams (PlantUML)

Create diagrams using PlantUML syntax in a code block.

![Diagrams - PlantUML](/help/plantuml.png)

- Supported diagram types: Sequence, Class, Use Case, Activity, State, Component, Deployment, ER, and more.
- PlantUML diagrams are rendered via an external server (plantuml.com). You will be asked for consent before sending diagram code.

The floating toolbar provides the same icons and actions as Mermaid, plus predefined sample insertion and element helpers for arrows, participants, classes, etc.

### Images

Insert images and import Markdown files by various methods.

- Insert an image by specifying a URL via the toolbar button.
- Drag and drop image files directly into the editor.
- Paste images from the clipboard (Ctrl+V / Cmd+V).
- Drag and drop a .md file into the editor to import its content.

## Search & Replace

Find and replace text within the editor.

![Search & Replace](/help/search-replace.png)

- Open the search bar from the toolbar or with the keyboard shortcut (Ctrl+F).
- Open the replace bar with Ctrl+H.

| Icon | Option | Description |
| :--: | ------ | ----------- |
| ![Match Case](/help/icons/match-case.png) | Match Case | Search with case sensitivity. |
| ![Match Word](/help/icons/match-word.png) | Match Whole Word | Search for exact word matches only. |
| ![Regex](/help/icons/regex.png) | Regular Expression | Search using a regex pattern. |

- Search also works within fullscreen code editor and table views.

## Compare & Merge

Compare and merge two documents side by side.

- Switch between Normal Mode and Compare Mode using the toggle button group on the right side of the toolbar.
- In Compare Mode, the editor splits into two panes with differences highlighted.
- The secondary (right) pane accepts direct text input or Markdown file upload.
- You can merge differences from one side to the other.

## Outline

View the document structure and navigate between sections.

![Outline Panel](/help/outline.png)

| Icon | Action | Description |
| :--: | ------ | ----------- |
| ![Outline](/help/icons/outline.png) | Outline Toggle | Toggle the outline panel visibility from the toolbar. |

- Click a heading in the outline to jump to that position in the editor.
- Fold/unfold sections to collapse or expand content under headings.
- Reorder sections by drag-and-drop or up/down move buttons.
- Drag the panel border to resize the outline panel width.

## Editor Settings

Customize the editor appearance and behavior.

![Editor Settings](/help/settings.png)

- Adjustable settings: Line Height, Font Size, Table Width, Editor Min Width, Editor Background Color.

