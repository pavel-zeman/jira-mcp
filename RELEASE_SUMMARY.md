# 🚀 MCP Jira Server v2.1.0 - Release Summary

## 📎 Attachment Management

**MCP Jira Server** brings Jira integration to AI assistants through the Model Context Protocol. Version 2.1.0 lets them upload, read, download, and delete issue attachments.

### 📦 Available Now on npm
```bash
npx mcp-jira-server
```

### ✨ What's New

**📎 Attachments**
- New `jira_add_attachment` tool: upload a local file, or content the assistant passes directly as text or base64
- New `jira_download_attachment` tool: save an attachment to a local file, or read it directly: text files as text, PNG/JPEG/GIF/WebP images as images the assistant can view
- New `jira_delete_attachment` tool: delete an attachment permanently
- Downloads never overwrite an existing file and always go through `JIRA_BASE_URL`

### ⚠️ Upgrade Note
None: existing tools and configuration are unchanged.

### 🛠️ Available Tools

| Category | Tools |
|----------|-------|
| **Issue Management** | `get_issue`, `create_issue`, `update_issue`, `transition_issue`, `delete_issue`, `search_issues` |
| **Comments** | `add_comment`, `get_comments`, `update_comment`, `delete_comment` |
| **Attachments** | `add_attachment` *(new)*, `download_attachment` *(new)*, `delete_attachment` *(new)* |
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
- **Size**: 25.5 kB compressed, 111.4 kB unpacked
- **Node.js**: 24+ required
- **License**: MIT
- **Dependencies**: none

### 🔗 Links
- **npm**: https://www.npmjs.com/package/mcp-jira-server
- **GitHub**: https://github.com/pavel-zeman/jira-mcp
- **Release Notes**: See RELEASE_NOTES.md
- **Documentation**: See README.md
