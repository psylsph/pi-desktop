# Contributing to Pi Desktop

Thank you for your interest in contributing! This is a guide for contributors.

## Development Setup

```bash
git clone https://github.com/psylsph/pi-desktop.git
cd pi-desktop
npm install
npm run dev
```

## Running Tests

```bash
npm test              # Run tests once
npm run test:watch    # Watch mode
```

## Code Style

- Use TypeScript for main process code
- Follow existing code formatting
- Add tests for new features
- Update documentation as needed

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Reporting Issues

When reporting bugs, please include:
- OS and version
- Node.js version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
