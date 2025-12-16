# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1] - 2025-12-16

### Added
- Initial release of Neotypa Booktabs (early alpha)
- Multi-user bookmark manager with authentication
- Two view modes: Tabbed (folders with grouped cards) and Hierarchical (nested folder navigation)
- SQLite file-based database (no database service required)
- Drag and drop support for organizing bookmarks, groups, and folders
- Tagging system for bookmarks
- All 32 daisyUI themes with user preference persistence
- Bcrypt password hashing for secure authentication (10 salt rounds)
- Session-based authentication with 30-day expiration
- Automatic session cleanup
- RESTful API with proper validation (Zod)
- TypeScript throughout (client, server, shared types)
- Basic test suite (database queries)
- Hot reload development mode
- Production-ready deployment guides for PM2 with Plesk/cPanel/Apache/Nginx

### Security
- Passwords hashed with bcrypt (10 salt rounds)
- HTTP-only cookies
- Secure cookies in production mode
- SameSite cookie protection
- Session expiration and cleanup
- Input validation on all endpoints

### Documentation
- Getting Started guide
- Quick Deployment guide
- Full Deployment guide with reverse proxy configurations
- Migration guide for database updates
- Architecture documentation
- Database schema and ERD
- Object model documentation
- CODEOWNERS file for PR approval requirements
- Contributing guide with AI development recommendations

### Technical Details
- Pure Node.js backend (no Express/Koa)
- Custom lightweight HTTP router
- sql.js for SQLite with file locking
- Tailwind CSS + daisyUI for styling
- esbuild for client bundling
- TypeScript compilation for server
- Vitest for testing
- Concurrent development mode (client + server hot reload)

### AI Development
- Partially developed with AI assistance (GitHub Copilot, Claude Sonnet 4.5, GPT 5.2)

## Future Enhancements

Potential improvements for future versions:
- Rate limiting for API endpoints
- Email verification
- Password reset functionality
- API tokens for external integrations
- Scheduled database backups
- Export/import functionality
- Browser extension integration
- Mobile app
