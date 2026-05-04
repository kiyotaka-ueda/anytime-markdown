# Anytime Graph


![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=bugs)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=coverage)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=anytime-trial_anytime-markdown&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=anytime-trial_anytime-markdown)

**Graph whiteboard editor for VS Code.**

Create and edit node-graph diagrams directly inside VS Code. Open any `*.graph` file to launch the visual editor.

## Features

- Visual node-graph editor with drag-and-drop
- Create nodes, edges, and labels on a canvas
- Physics-based layout with force-directed and Fruchterman-Reingold algorithms
- Constraint-based overlap removal (VPSC)
- Auto-spread connected nodes for readable layouts
- Custom editor for `*.graph` files

## Getting Started

1. Install the extension
2. Create a new graph: **Command Palette** > `Anytime Graph: New Graph`
3. Or open any `*.graph` file

## File Format

Graphs are stored as `*.graph` files, which are plain JSON and version-control friendly.

## License

[MIT](https://github.com/anytime-trial/anytime-markdown/blob/master/LICENSE)
