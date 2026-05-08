# Changelog

All notable changes to Pi Desktop will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Plugin system

## [0.3.0] - 2025-05-08

### Added
- **Enhanced markdown rendering** — Headers (#, ##, ###, ####), links, unordered lists, blockquotes, horizontal rules
- **Conversation export** — Export chats as Markdown or JSON via sidebar buttons and File menu
- **Light theme** — Toggle between dark (Tokyo Night) and light theme, persisted in localStorage
- **Session history** — Browse and restore previous sessions from the sidebar
- **Auto-update check** — Checks GitHub for new versions on launch, shows notification banner
- **Drag-and-drop files** — Drop files onto the message area to include their paths in prompts
- **Code block improvements** — Line numbers and copy-to-clipboard button on all code blocks
- **Sound notifications** — Audio feedback when agent completes a task or encounters an error
- **Window state persistence** — Remembers window size, position, and maximized state across launches
- **About dialog reads actual version** — No longer hardcoded, uses Electron's app.getVersion()
- **Update notification banner** — Non-intrusive banner when a new version is available
- **CI workflow improvements** — Fixed package-lock.json sync, added Linux deps, fail-fast: false, contents: write permission

### Changed
- Input wrapper vertical alignment changed from `flex-end` to `center` for better visual balance
- About dialog copyright year is now dynamic

## [0.2.0] - 2025-05-08

### Added
- Native application menu (File, Edit, View, Help)
- Help menu with Documentation, Keyboard Shortcuts, Report Issue, Check for Updates, About
- Keyboard shortcuts dialog (Cmd/Ctrl+N, O, B)
- About dialog with version info and links
- Comparison table (Pi Desktop vs VS Code Extension vs CLI)
- GitHub Actions CI workflow (tests on Linux, macOS, Windows)
- GitHub Actions release workflow (auto-builds on tags)
- Issue templates (bug report, feature request)
- Pull request template with checklist
- Contributing guidelines
- Enhanced README with badges, better formatting, and quick start

### Changed
- Improved README with CI badge, comparison section, and feature list
- Updated Help menu with functional dialog boxes

## [0.1.0] - 2025-05-08

### Added
- Initial release of Pi Desktop
- Native desktop application for pi coding agent
- Chat interface with streaming responses
- Markdown rendering with syntax highlighting
- Thinking blocks visualization for reasoning models
- Real-time tool call execution display
- Model selector with provider grouping
- Thinking level controls (off, low, medium, high)
- Session management (new session, compact context)
- Project selector via native OS dialog
- Tokyo Night-inspired dark theme
- Keyboard shortcuts (Enter, Shift+Enter, Escape)
- Toast notifications for status updates
- Native application menu (File, Edit, View, Help)
- Keyboard shortcuts dialog
- About dialog with version info
- Cross-platform support (Windows, macOS, Linux)
- Electron-based packaging with electron-builder

### Documentation
- Comprehensive README with installation and usage
- Contributing guidelines
- GitHub issue templates (bug report, feature request)
- Pull request template
- MIT License

[Unreleased]: https://github.com/psylsph/pi-desktop/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/psylsph/pi-desktop/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/psylsph/pi-desktop/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/psylsph/pi-desktop/releases/tag/v0.1.0
