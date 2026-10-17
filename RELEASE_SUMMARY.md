# 🚀 MCP Jira Server v1.1.0 - Release Summary

## 📰 Activity Streams & Zero Runtime Dependencies

**MCP Jira Server** brings Jira integration to AI assistants through the Model Context Protocol. Version 1.1.0 adds activity streams and drops every runtime dependency.

### 📦 Available Now on npm
```bash
npx mcp-jira-server
```

### ✨ What's New

**📰 Activity Streams**
- New `jira_get_activity_stream` tool: issues created, fields updated, status transitions and comments, newest first
- Global stream or a single user's stream
- Filter by project, issue and date range

**📦 No Runtime Dependencies**
- Built-in MCP server replaces `@modelcontextprotocol/sdk`
- Node's built-in `fetch` replaces `axios`

**🩺 Clearer Errors**
- Errors name the failing request and the real cause of network failures

**🛠️ Developer Experience**
- Run the TypeScript source directly on Node.js 22.18+ (`npm start`, `npm run dev`)
- TypeScript 6 toolchain

### ⚠️ Upgrade Note
Node's `fetch` ignores `HTTP_PROXY`/`HTTPS_PROXY`. If Jira is only reachable through a proxy, set `NODE_USE_ENV_PROXY=1` (Node.js 24+) in the server's environment.

### 🛠️ Available Tools

| Category | Tools |
|----------|-------|
| **Issue Management** | `get_issue`, `create_issue`, `update_issue`, `delete_issue`, `search_issues` |
| **Comments** | `add_comment`, `get_comments` |
| **Projects** | `get_projects`, `get_project`, `get_issue_types` |
| **Users** | `assign_issue`, `get_current_user` |
| **Activity** | `get_activity_stream` *(new)* |

### 🚀 Quick Start

1. **Install & Run**
   ```bash
   npx mcp-jira-server
   ```

2. **Configure Environment**
   ```bash
   export JIRA_BASE_URL="https://your-jira.com"
   export JIRA_PAT="your-token"
   ```

3. **Integrate with Claude**
   ```json
   {
     "mcpServers": {
       "jira": {
         "command": "npx",
         "args": ["-y", "mcp-jira-server"],
         "env": {
           "JIRA_BASE_URL": "https://your-jira.com",
           "JIRA_PAT": "your-token"
         }
       }
     }
   }
   ```

### 📊 Package Stats
- **Size**: 20.4 kB compressed, 84.9 kB unpacked
- **Node.js**: 18+ required
- **License**: MIT
- **Dependencies**: none

### 🔗 Links
- **npm**: https://www.npmjs.com/package/mcp-jira-server
- **GitHub**: https://github.com/pavel-zeman/jira-mcp
- **Release Notes**: See RELEASE_NOTES.md
- **Documentation**: See README.md
