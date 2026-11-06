# MCP Jira Server - Release Notes

## 🚀 Version 2.1.0 - November 7, 2026

### 🎯 Attachment Management

AI assistants can now work with issue attachments: upload files to an issue, read or download existing attachments, and delete them.

### ✨ What's New

#### 📎 **Attachments**
- **New tool `jira_add_attachment`**: Upload a file to an issue, either a local file (`filePath`) or content the assistant passes directly (`content`, as text or base64 for binary data). The attachment is named after the file unless `fileName` says otherwise
- **New tool `jira_download_attachment`**: Download an attachment, either saved to a local file (`filePath`) or returned straight into the conversation:
  - UTF-8 text files up to 1 MB come back as text, so the assistant can read logs, CSVs, or configs attached to an issue
  - PNG, JPEG, GIF and WebP images up to 5 MB come back as images, so the assistant can look at screenshots
  - Other binary files (zip, PDF, Office documents) and larger files need `filePath`
  - An existing file is never overwritten. If `filePath` is a directory, the file is saved there under its attachment name
- **New tool `jira_delete_attachment`**: Delete an attachment permanently
- Attachments are identified by the `id` returned by `jira_add_attachment`, or listed in `fields.attachment` of `jira_get_issue`
- `filePath` refers to the machine the MCP server runs on
- Jira's limits and permissions apply: the maximum attachment size (10 MB by default), the "Create Attachments" permission for uploads, and "Delete Own Attachments" / "Delete All Attachments" for deletion
- Downloads are always requested from `JIRA_BASE_URL`, even if Jira's own base URL setting differs (e.g. behind a reverse proxy), so the token is never sent anywhere else and `JIRA_USER_AGENT` applies

### 📦 Package Information
- **npm Package**: `mcp-jira-server`
- **Version**: 2.1.0
- **Runtime Dependencies**: none
- **License**: MIT

### 📋 **New Tools**

| Tool | Description | Parameters |
|------|-------------|-------------------|
| `jira_add_attachment` | Upload a file to an issue | `issueKey`, `filePath` or `content` (+ `contentEncoding`), `fileName` |
| `jira_download_attachment` | Download an attachment to a file or read it directly | `attachmentId`, `filePath` |
| `jira_delete_attachment` | Delete an attachment permanently | `attachmentId` |

#### Example Prompts
```
Attach C:\logs\error.log to PROJ-123
Attach the test results above to PROJ-123 as results.csv
Show me the log attached to PROJ-123
What does the screenshot in PROJ-123 show?
Download all attachments of PROJ-123 to C:\Downloads
Delete the outdated screenshot from PROJ-123
```

### 🔄 **Migration from 2.0.0**

No changes to existing tools or configuration. Update as usual:
```bash
npm update mcp-jira-server
```

Or for npx users, it will automatically use the latest version:
```bash
npx mcp-jira-server
```


---

## 🚀 Version 2.0.0 - November 6, 2026

### 🎯 Separate Tool for Status Transitions

Changing an issue's status now has its own tool, `jira_transition_issue`, instead of the `status` parameter of `jira_update_issue`. A status change no longer edits the issue first, so it works wherever the workflow allows the transition.

### ✨ What's New

#### 🔀 **Status Transitions**
- **New tool `jira_transition_issue`**: Move an issue to another status by running a workflow transition
- The target status name is case-insensitive, e.g. `"in progress"` matches `In Progress`
- If the target status can't be reached from the current one in a single step, the error lists the statuses that can, e.g. `Available target statuses: Waiting, Ready for Development`
- Only the "Transition Issues" permission is needed. Previously, a status change edited the issue first, so it also needed the "Edit Issues" permission and failed on issues in non-editable statuses such as Closed
- Fields required on a transition screen (such as a resolution) are not supported yet

### 💥 **Breaking Change**
- **`jira_update_issue` no longer accepts `status`**. Use `jira_transition_issue` instead. AI assistants pick this up from the tool list automatically; only scripts that call the tool with a hard-coded `status` argument need changing

### 📦 Package Information
- **npm Package**: `mcp-jira-server`
- **Version**: 2.0.0
- **Runtime Dependencies**: none
- **License**: MIT

### 📋 **New Tool**

| Tool | Description | Parameters |
|------|-------------|-------------------|
| `jira_transition_issue` | Change the status of an issue | `issueKey`, `status` |

#### Example Prompts
```
Move PROJ-123 to "In Progress"
Mark PROJ-123 as Done
```

### 🔄 **Migration from 1.2.0**

No configuration changes. Update as usual:
```bash
npm update mcp-jira-server
```

Or for npx users, it will automatically use the latest version:
```bash
npx mcp-jira-server
```

Things to check:
- **Direct callers of `jira_update_issue`**: If you pass `status`, it is now ignored. Call `jira_transition_issue` with the same `issueKey` and `status` instead.


---

## 🚀 Version 1.2.0 - November 6, 2026

### 🎯 Edit and Delete Comments

This release completes comment management: besides adding and reading comments, the server can now edit and delete them.

### ✨ What's New

#### 💬 **Comment Editing and Deletion**
- **New tool `jira_update_comment`**: Replace the text of an existing comment
- **New tool `jira_delete_comment`**: Delete a comment permanently
- Both tools identify the comment by the `id` returned by `jira_get_comments`
- Editing keeps the comment's visibility restriction (group or project role), so an internal comment stays internal
- Jira's permission scheme applies: your own comments need the "Edit Own Comments" / "Delete Own Comments" permissions, other people's comments need "Edit All Comments" / "Delete All Comments"

### 📦 Package Information
- **npm Package**: `mcp-jira-server`
- **Version**: 1.2.0
- **Runtime Dependencies**: none
- **License**: MIT

### 📋 **New Tools**

| Tool | Description | Parameters |
|------|-------------|-------------------|
| `jira_update_comment` | Replace the text of a comment | `issueKey`, `commentId`, `comment` |
| `jira_delete_comment` | Delete a comment permanently | `issueKey`, `commentId` |

#### Example Prompts
```
In PROJ-123, change my last comment to "Fixed in release 2.4"
Delete my duplicate comment on PROJ-123
```


---

## 🚀 Version 1.1.0 - October 17, 2026

### 🎯 Activity Streams & Zero Runtime Dependencies

This release adds a tool for reading Jira activity streams and removes all runtime dependencies: the MCP SDK is replaced by a small built-in MCP server and axios by Node's built-in `fetch`.

### ✨ What's New

#### 📰 **Activity Streams**
- **New tool `jira_get_activity_stream`**: Read what happened in Jira (issues created, fields updated, status transitions, comments), newest first
- **Global or per user**: Omit `username` for the global activity stream, or pass a username for that user's stream
- **Filters**: Narrow by project, issue and date range (`after` / `before` as ISO 8601 dates or date-times)
- **Plain-text output**: Each entry has the time, author, title, details (e.g. comment text or changed fields), link and issue key
- Uses the Atlassian Activity Streams feed (`/activity`) that ships with Jira Server/Data Center

#### 📦 **No Runtime Dependencies**
- **Built-in MCP server**: `@modelcontextprotocol/sdk` replaced by a minimal JSON-RPC 2.0 server over stdio (`src/mcp-server.ts`), supporting MCP protocol versions 2024-10-07 to 2025-11-25
- **Native HTTP**: `axios` replaced by Node's built-in `fetch`
- `npm install mcp-jira-server` now installs nothing but the server itself

#### 🩺 **Clearer Errors**
- Error messages name the failing request, e.g. `GET /issue/PROJ-1 failed with status code 404`
- Network failures report the real cause (DNS, TLS, connection refused) instead of a generic message

#### 🛠️ **Developer Experience**
- Run the TypeScript source directly on Node.js 22.18+, with no build step: `npm start`, or `npm run dev` to restart on changes
- `npm run typecheck` type-checks the source
- Toolchain upgraded to TypeScript 6 and `@types/node` 24
- `npm publish` now builds the package first (`prepublishOnly`)

### 🐛 **Fixes**
- The server reports its real version in the MCP `initialize` response (previously always `1.0.0`)

### 📦 Package Information
- **npm Package**: `mcp-jira-server`
- **Version**: 1.1.0
- **Runtime Dependencies**: none
- **License**: MIT

### 📋 **New Tool**

| Tool | Description | Parameters (all optional) |
|------|-------------|-------------------|
| `jira_get_activity_stream` | Read the global or a user's activity stream | `username`, `projectKey`, `issueKey`, `after`, `before`, `maxResults` (default: 20) |

#### Example Prompts
```
What happened in Jira today?
What did I do in project PROJ last week?
Show the recent activity of user jdoe
```

### 🔄 **Migration from 1.0.3**

No changes to existing tools or configuration. Simply update:
```bash
npm update mcp-jira-server
```

Or for npx users, it will automatically use the latest version:
```bash
npx mcp-jira-server
```

Things to check:
- **HTTP proxy users**: Node's `fetch` ignores `HTTP_PROXY`/`HTTPS_PROXY`, which axios honored. If Jira is only reachable through a proxy, add `NODE_USE_ENV_PROXY=1` (Node.js 24+) to the server's `env` in your MCP client configuration.
- **Error message format**: Error texts changed (see above). This only matters if you parse them.
- **Contributors**: `npm run watch` and the `tsx`-based `npm run dev` were removed. Use `npm run dev` (Node.js 22.18+) or `npm run build -- --watch`.

### 🙏 **Contributors**

Special thanks to:
- [@pavel-zeman](https://github.com/pavel-zeman) - Activity streams, built-in MCP server and dependency removal

---

## 🚀 Version 1.0.3 - January 27, 2026

### 🎯 Custom Fields & Security Updates

This release adds support for custom fields and addresses important security vulnerabilities.

### ✨ What's New

#### 🎨 **Custom Fields Support**
- **Create with Custom Fields**: Set custom field values when creating new issues
- **Update Custom Fields**: Modify custom field values in existing issues
- **Flexible Field Mapping**: Support for any custom field ID with proper value formatting
- **Type Safety**: Proper handling of different custom field types

#### 🔒 **Security Updates**
- **Updated axios** from 1.7.7 to 1.7.9 to address security vulnerabilities
- **Fixed follow-redirects** vulnerabilities in dependency tree
- All known security issues resolved

#### 🌐 **Reverse Proxy Support**
- **Custom User-Agent**: New `JIRA_USER_AGENT` environment variable
- **Proxy Compatibility**: Works with oauth2-proxy, nginx, and other reverse proxies
- **Header Whitelisting**: Support for API client filtering by User-Agent

### 📦 Package Information
- **npm Package**: `mcp-jira-server`
- **Version**: 1.0.3
- **License**: MIT

### 🔧 **Configuration**

#### New Environment Variable
```bash
JIRA_BASE_URL="https://your-jira-instance.com"
JIRA_PAT="your-personal-access-token"
JIRA_USER_AGENT="YourCustomUserAgent/1.0"  # Optional
```

### 📋 **Updated Tools**

#### Enhanced Tools
- `jira_create_issue` - Now supports custom fields via optional parameters
- `jira_update_issue` - Can update custom field values

#### Example: Using Custom Fields
```typescript
// Create issue with custom fields
{
  "projectKey": "PROJ",
  "summary": "New feature",
  "issueType": "Story",
  "customfield_10001": "Custom value",
  "customfield_10002": {"value": "Option 1"}
}
```

### 🔄 **Migration from 1.0.2**

No breaking changes! Simply update:
```bash
npm update mcp-jira-server
```

Or for npx users, it will automatically use the latest version:
```bash
npx mcp-jira-server
```

### 🙏 **Contributors**

Special thanks to:
- [@masoudsharifipour](https://github.com/masoudsharifipour) - Custom fields support
- [@eliasadvansys](https://github.com/eliasadvansys) - User-Agent header support

---

## 🚀 Version 1.0.2 - October 8, 2025

### 🎉 Initial Public Release

We're excited to announce the first public release of **MCP Jira Server** - A Model Context Protocol (MCP) server that brings powerful Jira integration to AI assistants like Claude Desktop and VS Code with GitHub Copilot.

### 📦 Package Information
- **npm Package**: `mcp-jira-server`
- **Version**: 1.0.2
- **License**: MIT
- **Bundle Size**: 11.4 kB compressed, 51.8 kB unpacked

### ✨ Key Features

#### 🔐 **Secure Authentication**
- **Personal Access Token (PAT)** authentication for self-hosted Jira instances
- Secure environment variable configuration
- No hardcoded credentials

#### 🛠️ **Complete Issue Management**
- **Create Issues**: Create new Jira issues with full metadata support
- **Read Issues**: Retrieve detailed issue information by key
- **Update Issues**: Modify existing issues (summary, description, assignee, priority, labels, status)
- **Delete Issues**: Permanently remove issues with proper permissions
- **Search Issues**: Powerful JQL (Jira Query Language) search capabilities

#### 💬 **Comment System**
- **Add Comments**: Post comments to any issue
- **Retrieve Comments**: Get all comments from an issue with full metadata

#### 👥 **User & Project Management**
- **Project Discovery**: List all available Jira projects
- **Project Details**: Get detailed information about specific projects
- **Issue Type Management**: Retrieve available issue types per project
- **User Assignment**: Assign issues to team members
- **Current User Info**: Get authenticated user details

#### 🔍 **Advanced Search**
- **JQL Support**: Full Jira Query Language support for complex searches
- **Flexible Results**: Configurable maximum results (default: 50)
- **Rich Metadata**: Complete issue data in search results

### 🚀 **Installation & Usage**

#### Quick Start
```bash
# Install and run immediately
npx mcp-jira-server

# Or install globally
npm install -g mcp-jira-server
mcp-jira-server
```

#### Integration Options
- **Claude Desktop**: Complete MCP server integration
- **VS Code**: GitHub Copilot extension support
- **Any MCP Client**: Standard Model Context Protocol compatibility

### 🔧 **Configuration**

#### Environment Variables
```bash
JIRA_BASE_URL="https://your-jira-instance.com"
JIRA_PAT="your-personal-access-token"
```

#### Claude Desktop Setup
```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["mcp-jira-server"],
      "env": {
        "JIRA_BASE_URL": "https://your-jira-instance.com",
        "JIRA_PAT": "your-personal-access-token"
      }
    }
  }
}
```

### 🛡️ **Robust Error Handling**
- **Graceful Startup**: Server starts even without configuration
- **Clear Error Messages**: Detailed feedback for missing credentials
- **API Error Handling**: Comprehensive Jira API error reporting
- **Configuration Validation**: Runtime validation of environment variables

### 📋 **Available Tools**

| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `jira_get_issue` | Get issue details by key | `issueKey` |
| `jira_search_issues` | Search issues using JQL | `jql`, `maxResults` (optional) |
| `jira_create_issue` | Create a new issue | `projectKey`, `summary`, `issueType` |
| `jira_update_issue` | Update existing issue | `issueKey` + update fields |
| `jira_add_comment` | Add comment to issue | `issueKey`, `comment` |
| `jira_get_comments` | Get all issue comments | `issueKey` |
| `jira_get_projects` | List all projects | None |
| `jira_get_project` | Get project details | `projectKey` |
| `jira_get_issue_types` | Get project issue types | `projectKey` |
| `jira_assign_issue` | Assign issue to user | `issueKey`, `assignee` |
| `jira_delete_issue` | Delete an issue | `issueKey` |
| `jira_get_current_user` | Get current user info | None |

### 🎯 **Use Cases**

#### For Development Teams
- **Sprint Planning**: Query backlog items and plan sprints with AI assistance
- **Bug Triaging**: Automatically categorize and assign bugs based on descriptions
- **Status Updates**: Get comprehensive project status reports
- **Documentation**: Generate reports from issue data

#### For Project Managers
- **Progress Tracking**: Monitor team progress across multiple projects
- **Resource Planning**: Analyze workload distribution
- **Reporting**: Create custom reports using JQL queries
- **Automation**: Automate routine issue management tasks

#### For QA Teams
- **Test Case Management**: Create and track test-related issues
- **Bug Reporting**: Streamlined bug creation with detailed information
- **Release Planning**: Track release-critical issues

### 🔄 **Integration Examples**

#### Natural Language Queries
```
"Show me all high-priority bugs assigned to John in the MOBILE project"
"Create a new story for user authentication in the WEB project"
"What are the current blockers for the next release?"
"Add a comment to PROJ-123 about the latest test results"
```

#### Automated Workflows
- **Daily Standups**: Get team's current work items
- **Release Planning**: Identify incomplete features
- **Bug Triage**: Categorize and prioritize new issues
- **Progress Reports**: Generate status summaries

### 🚦 **System Requirements**
- **Node.js**: 18.0.0 or higher
- **Jira**: Self-hosted instance with API access
- **Authentication**: Valid Personal Access Token
- **Network**: HTTPS access to Jira instance

### 🔗 **Links & Resources**
- **npm Package**: https://www.npmjs.com/package/mcp-jira-server
- **GitHub Repository**: https://github.com/edrich13/mcp-jira-server
- **Documentation**: See README.md for detailed setup instructions
- **Issue Tracker**: Report bugs and feature requests on GitHub

### 🙏 **Acknowledgments**
Built with the Model Context Protocol (MCP) SDK and designed for seamless integration with modern AI development workflows.

### 📝 **License**
MIT License - See LICENSE file for details

---

**Happy coding! 🎉**

*For support, questions, or feature requests, please visit our GitHub repository or contact the maintainer.*