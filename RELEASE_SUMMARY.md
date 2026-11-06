# 🚀 MCP Jira Server v2.0.0 - Release Summary

## 🔀 Separate Tool for Status Transitions

**MCP Jira Server** brings Jira integration to AI assistants through the Model Context Protocol. Version 2.0.0 moves status changes into a tool of their own, which works wherever the workflow allows the transition.

### 📦 Available Now on npm
```bash
npx mcp-jira-server
```

### ✨ What's New

**🔀 Status Transitions**
- New `jira_transition_issue` tool: move an issue to another status
- Status names are case-insensitive
- If the target status can't be reached in one step, the error lists the statuses that can
- No longer needs the "Edit Issues" permission, so issues in non-editable statuses such as Closed can be transitioned too

### ⚠️ Upgrade Note
**Breaking:** `jira_update_issue` no longer accepts `status`; use `jira_transition_issue` instead. AI assistants adapt automatically from the tool list. Configuration is unchanged.

### 🛠️ Available Tools

| Category | Tools |
|----------|-------|
| **Issue Management** | `get_issue`, `create_issue`, `update_issue`, `transition_issue` *(new)*, `delete_issue`, `search_issues` |
| **Comments** | `add_comment`, `get_comments`, `update_comment`, `delete_comment` |
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
- **Size**: 21.4 kB compressed, 92.3 kB unpacked
- **Node.js**: 24+ required
- **License**: MIT
- **Dependencies**: none

### 🔗 Links
- **npm**: https://www.npmjs.com/package/mcp-jira-server
- **GitHub**: https://github.com/pavel-zeman/jira-mcp
- **Release Notes**: See RELEASE_NOTES.md
- **Documentation**: See README.md
