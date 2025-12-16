# Getting Started

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Development)](#quick-start-development)
- [Project Commands](#project-commands)
- [Development Workflow](#development-workflow)
- [Environment Configuration](#environment-configuration)
- [First Time Setup](#first-time-setup)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

---

## Prerequisites

- **Node.js 20.19.0 or later** - [Download](https://nodejs.org/) (required for Vite 7)
  - Check your version: `node -v`
- **Git** - For cloning the repository

[↑ Back to Table of Contents](#table-of-contents)

## Quick Start (Development)

```bash
# Clone the repository
git clone https://github.com/VArterJr/neotypa-booktabs.git
cd neotypa-booktabs

# Install dependencies (this will take a minute)
npm install

# Optional: Copy environment template (uses defaults if skipped)
cp .env.example .env

# Run in development mode (hot reload for both client and server)
npm run dev
```

Open [http://localhost:8787](http://localhost:8787) in your browser.

The database file (`data/app.sqlite`) will be created automatically on first run.

**That's it!** You're ready to develop.

The database file (`data/app.sqlite`) will be created automatically on first run.

[↑ Back to Table of Contents](#table-of-contents)

## Project Commands

```bash
npm run dev           # Start dev server (client + server with hot reload)
npm run build         # Build for production
npm run start         # Run production build
npm run test          # Run tests
npm run clean         # Clean build artifacts
npm run migrate:passwords  # Migrate existing passwords to bcrypt
```

[↑ Back to Table of Contents](#table-of-contents)

## Development Workflow

1. **Make changes** to source files in `src/client/` or `src/server/`
2. **Auto-reload** - Changes are automatically detected and rebuilt
3. **Test** - Run `npm test` to verify functionality
4. **Build** - Run `npm run build` before deployment

[↑ Back to Table of Contents](#table-of-contents)

## Environment Configuration

Create a `.env` file in the root directory (optional for development):

```env
PORT=8787
DB_PATH=./data/app.sqlite
PUBLIC_DIR=./dist/client
NODE_ENV=development
```

**Note:** These have sensible defaults. You only need a `.env` file if you want to change:
- The port (default 8787)
- Database location (default `./data/app.sqlite`)
- Client build directory (default `./dist/client`)

The `.env.example` file has these defaults already documented.

[↑ Back to Table of Contents](#table-of-contents)

## First Time Setup

On first run, you'll need to:

1. **Register a user** - Use the registration form in the UI
2. **Create folders and groups** - Start organizing your bookmarks
3. **Choose a theme** - Select from any of the 32 daisyUI themes

[↑ Back to Table of Contents](#table-of-contents)

## Project Structure

```
neotypa-booktabs/
├── src/                 # All source code and configs
│   ├── client/          # Frontend TypeScript
│   ├── server/          # Backend Node.js server
│   │   └── test/        # Server tests
│   └── shared/          # Shared types
├── scripts/             # Build and utility scripts
├── doc/                 # Documentation
├── data/                # SQLite database (created on first run)
└── dist/                # Build output (generated)
```

[↑ Back to Table of Contents](#table-of-contents)

## Testing

```bash
# Run all tests
npm test

# Tests are located in src/server/test/
```

Current test coverage:
- Database queries
- User creation
- Folder/group/bookmark operations
- Reordering and moving items
- Tag management

[↑ Back to Table of Contents](#table-of-contents)

## Troubleshooting

### Port Already in Use

Change the `PORT` in your `.env` file or environment:
```bash
PORT=3000 npm run dev
```

### Database Locked

If you see database lock errors:
1. Ensure only one instance is running
2. Check for stale `.lock` files in `data/`
3. Restart the server

### Build Errors

```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### Module Not Found

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- **Deploy to production** - See [deployment.md](deployment.md)
- **Migrate existing database** - See [migration.md](migration.md)
- **Understand the architecture** - See [architecture.md](architecture.md)
- **Review database schema** - See [database.md](database.md)

[↑ Back to Table of Contents](#table-of-contents)
