# Contributing to Neotypa Booktabs

Thank you for your interest in contributing to Neotypa Booktabs!

## License

This project is licensed under the Elastic License 2.0. By contributing, you agree that your contributions will be licensed under the same license.

**Important:** The Elastic License 2.0 prohibits providing the software as a hosted service for profit. All contributors must understand and agree to these terms.

## AI-Assisted Development

This project was partially developed with AI assistance using:
- GitHub Copilot
- Claude Sonnet 4.5
- GPT 5.2

**If you choose to use AI tools for contributions**, we recommend using these models or their equivalent future versions. Quality AI assistance helps maintain code consistency and best practices. Please avoid using untested or lower-quality models that may introduce problematic code patterns.

## How to Contribute

### Reporting Issues

- Use the GitHub issue tracker to report bugs
- Search existing issues before creating a new one
- Include clear steps to reproduce the problem
- Provide version information and environment details

### Suggesting Features

- Open an issue describing the feature
- Explain the use case and benefits
- Be open to discussion and feedback

### Code Contributions

**All code contributions require review and approval by the project maintainer.**

1. **Fork the repository** and create a branch from `main`
2. **Make your changes** following the code style and conventions
3. **Test your changes** thoroughly
   - Run `npm test` to verify tests pass
   - Test manually in both development and production builds
4. **Commit your changes** with clear, descriptive commit messages
5. **Submit a Pull Request** to the `main` branch
   - Describe what changes you made and why
   - Reference any related issues
   - Be patient while your PR is reviewed

### Pull Request Requirements

- Code must pass all existing tests
- New features should include tests where applicable
- Follow the existing code style and conventions
- Update documentation if you're changing functionality
- Keep PRs focused on a single change

### Code Review Process

- All PRs require approval from the project maintainer (see CODEOWNERS)
- The maintainer may request changes or ask questions
- Be responsive to feedback and willing to make adjustments
- Once approved, the maintainer will merge your PR

## Development Setup

See [getting-started.md](doc/getting-started.md) for detailed development environment setup.

**Quick start:**
1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Start development: `npm run dev`
4. Run tests: `npm test`

## Code Standards

### TypeScript
- Use TypeScript for all new code
- Enable strict mode
- Add proper type annotations
- Use shared types from `@app/shared` when applicable

### Code Style
- Follow existing code patterns
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

### Commits

Write clear commit messages using conventional commit format:

```
feat: add new feature
fix: resolve bug in bookmark import
docs: update API documentation
chore: update dependencies
test: add tests for JSON export
refactor: simplify folder hierarchy logic
```

Use present tense and reference issues when applicable. For example: `fix: resolve #123 bookmark deletion issue`

**Do not bump version numbers in regular commits.** Versions are only updated when cutting releases.

### Testing
- Add tests for new features
- Ensure all tests pass before submitting PR
- Maintain or improve test coverage

```
src/
├── client/      # Frontend code
├── server/      # Backend code
│   └── test/    # Tests
└── shared/      # Shared types
```

## Development Workflow

```bash
# Start dev mode (hot reload)
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Clean build artifacts
npm run clean
```

## Versioning and Releases

We follow semantic versioning but only increment versions when cutting releases, not for individual commits.

### Version Numbers

- **Patch** (0.0.X): Bug fixes, small tweaks, dependency updates
- **Minor** (0.X.0): New features, API additions, significant enhancements  
- **Major** (X.0.0): Breaking changes, major rewrites, incompatible API changes

While in 0.x.x, we're still stabilizing the API. Once we reach 1.0.0, breaking changes will require a major version bump.

### Creating a Release

Only project maintainers create releases:

```bash
# For bug fixes
npm version patch    # 0.0.2 → 0.0.3

# For new features
npm version minor    # 0.0.2 → 0.1.0

# For breaking changes
npm version major    # 0.0.2 → 1.0.0

# Push with tags
git push --follow-tags
```

The `npm version` command updates package.json, creates a git tag, and commits the change automatically.

### For Contributors

Just focus on writing good code with clear commit messages. Don't worry about version numbers—the maintainer handles versioning when creating releases.

## Areas for Contribution

### High Priority
- Rate limiting implementation
- Password reset functionality
- Export/import features
- Performance optimizations

### Documentation
- Improve existing docs
- Add code examples
- Create tutorials

### Testing
- Increase test coverage
- Add integration tests
- Add E2E tests

### UI/UX
- Improve mobile responsiveness
- Add keyboard shortcuts
- Enhance accessibility

## Questions?

Open an issue for:
- Bug reports
- Feature requests
- Documentation improvements
- General questions

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what's best for the project
- Help others when possible
