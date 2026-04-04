# Changelog

All notable changes to the "trail-core" package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.0.1] - 2026-04-04

Initial release. Static analysis engine for TypeScript project architecture visualization.

### Added

- ProjectAnalyzer for TypeScript project scanning with configurable filters
- SymbolExtractor for extracting classes, functions, interfaces, and type aliases
- EdgeExtractor for detecting import dependencies between symbols
- FilterConfig for include/exclude path patterns and symbol type filtering
- Mermaid diagram output (toMermaid transform)
- C4 model output (toC4 transform)
- Cytoscape.js graph output (toCytoscape transform)
- Trail stylesheet for consistent graph styling
- Custom trail definitions for user-defined analysis scopes
- C4 model types (Person, System, Container, Component, Relationship)
- CLI tool (`trail`) for command-line analysis
