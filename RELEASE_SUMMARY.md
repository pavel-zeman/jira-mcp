# 🚀 MCP Jira Server v1.2.0 - Release Summary

## 💬 Edit and Delete Comments

**MCP Jira Server** brings Jira integration to AI assistants through the Model Context Protocol. Version 1.2.0 lets them edit and delete issue comments, not just add and read them.

### 📦 Available Now on npm
```bash
npx mcp-jira-server
```

### ✨ What's New

**💬 Comment Editing and Deletion**
- New `jira_update_comment` tool: replace the text of an existing comment
- New `jira_delete_comment` tool: delete a comment permanently
- Comments are identified by the `id` returned by `jira_get_comments`
- Editing keeps the comment's visibility restriction, so an internal comment stays internal

### ⚠️ Upgrade Note
None: existing tools and configuration are unchanged.

### 🛠️ Available Tools

| Category | Tools |
|----------|-------|
| **Issue Management** | `get_issue`, `create_issue`, `update_issue`, `delete_issue`, `search_issues` |
| **Comments** | `add_comment`, `get_comments`, `update_comment` *(new)*, `delete_comment` *(new)* |
| **Projects** | `get_projects`, `get_project`, `get_issue_types` |
| **Users** | `assign_issue`, `get_current_user` |
| **Activity** | `get_activity_stream` |

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
- **Size**: 21.0 kB compressed, 90.1 kB unpacked
- **Node.js**: 18+ required
- **License**: MIT
- **Dependencies**: none

### 🔗 Links
- **npm**: https://www.npmjs.com/package/mcp-jira-server
- **GitHub**: https://github.com/pavel-zeman/jira-mcp
- **Release Notes**: See RELEASE_NOTES.md
- **Documentation**: See README.md
