# Change Log

All notable changes to the "Anytime Graph" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [0.0.2] - 2026-03-29

### Changed
- Updated Marketplace images

### Graph Core (graph-core)
- Fixed SonarCloud minor and major issues

## [0.0.1] - 2026-03-27

Initial release. Graph editor extracted from Anytime Markdown extension.

### Added

**Editor**
- Visual node-graph editor with custom editor for `*.graph` files
- Create nodes, edges, and labels on a canvas
- Start text editing by typing when a node is selected
- Dark/light theme support with theme-aware colors
- Settings panel with theme and language switching

**Layout**
- Physics-based layout (force-directed, Fruchterman-Reingold)
- VPSC constraint-based overlap removal
- Auto-spread connected nodes for readable layouts

**Shapes**
- Shape tool with rectangle, ellipse, diamond, and more
- Shape hover bar for quick actions (hidden for non-basic shapes)
- Drag-time collision detection

**Commands**
- `Anytime Graph: New Graph` to create a new graph file

### Graph Core (graph-core)
- 10 node types (rect, ellipse, diamond, parallelogram, cylinder, sticky, text, doc, frame, image)
- 3 edge types (line, arrow, connector) + orthogonal connectors (A* obstacle avoidance) + Bezier curves
- Smart guides, grid snap, node alignment and distribution
- Viewport (pan, zoom 0.1-10x, fit-to-content)
- Undo/Redo (selection state preservation, max 50 history entries)
- SVG export, draw.io XML export/import
- Accessibility (ARIA roles, keyboard navigation, prefers-reduced-motion)
