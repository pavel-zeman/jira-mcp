# Changelog

All notable changes to the MCP Jira Server project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-10-17

### Added
- `jira_get_activity_stream` tool for reading the global activity stream or a user's activity stream, optionally narrowed by project, issue and date range
- `npm start` / `npm run dev` run the TypeScript source directly on Node.js 22.18+ (no build step), and `npm run typecheck` type-checks it
- `prepublishOnly` script so `npm publish` always ships a fresh build

### Changed
- Replaced `@modelcontextprotocol/sdk` with a built-in minimal MCP server over stdio (`src/mcp-server.ts`), supporting MCP protocol versions 2024-10-07 to 2025-11-25
- Replaced `axios` with Node's built-in `fetch`; the package now has no runtime dependencies
- `HTTP_PROXY`/`HTTPS_PROXY` are no longer honored automatically (axios did); set `NODE_USE_ENV_PROXY=1` (Node.js 24+) in the server's environment to route Jira requests through them
- Error messages now name the failing request (e.g. `GET /issue/PROJ-1 failed with status code 404`), and network failures report the underlying cause (DNS, TLS, connection refused) instead of a generic message
- Development toolchain upgraded to TypeScript 6 and `@types/node` 24; `tsx` and the `watch` and `prepare` scripts were removed

### Fixed
- The server now reports its real version in the MCP `initialize` response (it always reported `1.0.0`)

## [1.0.3] - 2026-01-27

### Added
- Custom fields support in `jira_create_issue` and `jira_update_issue` tools
- Optional User-Agent header support for Jira instances behind reverse proxies
- New environment variable `JIRA_USER_AGENT` for custom User-Agent configuration
- Enhanced compatibility with reverse proxies (oauth2-proxy, nginx, etc.)

### Changed
- Updated dependencies to address security vulnerabilities
- Improved error handling for custom field operations

### Fixed
- Security vulnerabilities in dependencies (axios, follow-redirects)
- Custom field handling in issue creation and updates

## [1.0.2] - 2025-10-08

### Added
- Initial public release to npm registry
- Complete Jira issue management through MCP
- Personal Access Token authentication for self-hosted Jira instances
- 12 comprehensive Jira tools for issue, project, and user management
- JQL (Jira Query Language) search capabilities
- Comment system for issue collaboration
- Graceful startup without requiring immediate configuration
- CLI binary support via `npx mcp-jira-server`
- Claude Desktop and VS Code integration support
- Comprehensive documentation and setup guides

### Features
- **Issue Management**: Create, read, update, delete, and search Jira issues
- **Project Management**: List projects, get project details, and issue types
- **Comment System**: Add and retrieve issue comments
- **User Management**: Assign issues and get current user information
- **Advanced Search**: Full JQL support with configurable result limits
- **Error Handling**: Robust error handling with clear error messages
- **Security**: Environment variable-based configuration

### Tools Available
- `jira_get_issue` - Retrieve issue details by key
- `jira_search_issues` - Search issues using JQL
- `jira_create_issue` - Create new issues
- `jira_update_issue` - Update existing issues  
- `jira_add_comment` - Add comments to issues
- `jira_get_comments` - Get all issue comments
- `jira_get_projects` - List all projects
- `jira_get_project` - Get project details
- `jira_get_issue_types` - Get available issue types
- `jira_assign_issue` - Assign issues to users
- `jira_delete_issue` - Delete issues
- `jira_get_current_user` - Get current user info

### Technical Details
- Built with TypeScript and Model Context Protocol SDK
- Package size: 11.4 kB compressed, 51.8 kB unpacked
- Node.js 18+ required
- MIT License

## [Unreleased]

### Planned Features
- Support for Jira Cloud instances
- Webhook integration
- Batch operations
- Attachment management
- Advanced reporting features
- QMetry test management integration

---

## Release History

- **1.1.0** (2026-10-17) - Activity streams & zero runtime dependencies
- **1.0.3** (2026-01-27) - Custom fields & security updates
- **1.0.2** (2025-10-08) - Initial public release
- **1.0.1** (2025-10-08) - Pre-release version
- **1.0.0** (2025-10-08) - Development version