#!/usr/bin/env node

import { serveStdio, type CallToolResult, type Tool } from './mcp-server.ts';
import { JiraApiError, JiraClient, type AddAttachmentInput, type CreateIssueInput, type JiraAttachment, type UpdateIssueInput } from './jira-client.ts';

// Environment variables
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_PAT = process.env.JIRA_PAT;
const JIRA_USER_AGENT = process.env.JIRA_USER_AGENT;

// Function to check if environment variables are configured
function checkEnvironmentConfig(): { isConfigured: boolean; error?: string } {
  const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
  const JIRA_PAT = process.env.JIRA_PAT;
  
  if (!JIRA_BASE_URL || !JIRA_PAT) {
    return {
      isConfigured: false,
      error: 'JIRA_BASE_URL and JIRA_PAT environment variables are required. Please configure them before using Jira functionality.'
    };
  }
  return { isConfigured: true };
}

// Initialize Jira client (will be created on demand)
let jiraClient: JiraClient | null = null;

function getJiraClient(): JiraClient {
  const config = checkEnvironmentConfig();
  if (!config.isConfigured) {
    throw new Error(config.error);
  }
  
  if (!jiraClient) {
    const JIRA_BASE_URL = process.env.JIRA_BASE_URL!;
    const JIRA_PAT = process.env.JIRA_PAT!;
    const JIRA_USER_AGENT = process.env.JIRA_USER_AGENT;
    
    jiraClient = new JiraClient({
      baseUrl: JIRA_BASE_URL,
      personalAccessToken: JIRA_PAT,
      userAgent: JIRA_USER_AGENT,
    });
  }
  
  return jiraClient;
}

// Image formats that models can view; other attachments are returned only if they are UTF-8 text
const INLINE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
// Larger attachments have to be saved to a file: bigger images are rejected by model APIs, and longer text would crowd out the conversation
const MAX_INLINE_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_INLINE_TEXT_SIZE = 1024 * 1024;

function attachmentContent(attachment: JiraAttachment, data: Buffer): CallToolResult['content'] {
  const summary = `${attachment.filename} (${attachment.mimeType}, ${data.length} bytes)`;
  const mimeType = attachment.mimeType.split(';')[0].trim();
  const isImage = INLINE_IMAGE_TYPES.includes(mimeType);

  if (data.length > (isImage ? MAX_INLINE_IMAGE_SIZE : MAX_INLINE_TEXT_SIZE)) {
    throw new Error(`${summary} is too large to return directly; pass filePath to save it to a file`);
  }

  if (isImage) {
    return [
      { type: 'text', text: `Attachment ${summary}` },
      { type: 'image', data: data.toString('base64'), mimeType },
    ];
  }

  let text: string | undefined;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    // Not valid UTF-8
  }
  // Binary formats are rarely valid UTF-8, and those that are still contain NUL bytes
  if (text === undefined || text.includes('\0')) {
    throw new Error(`${summary} is not a text file; pass filePath to save it to a file`);
  }
  return [{ type: 'text', text: `Attachment ${summary}:\n\n${text}` }];
}

// Define tools
const tools: Tool[] = [
  {
    name: 'jira_get_issue',
    description: 'Get details of a specific Jira issue by its key (e.g., PROJ-123)',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: {
          type: 'string',
          description: 'The Jira issue key (e.g., PROJ-123)',
        },
      },
      required: ['issueKey'],
    },
  },
  {
    name: 'jira_search_issues',
    description: 'Search for Jira issues using JQL (Jira Query Language). Examples: "project = PROJ AND status = Open", "assignee = currentUser() AND status != Done"',
    inputSchema: {
      type: 'object',
      properties: {
        jql: {
          type: 'string',
          description: 'JQL query string to search for issues',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50)',
          default: 50,
        },
      },
      required: ['jql'],
    },
  },
  {
    name: 'jira_create_issue',
    description: 'Create a new Jira issue in a specified project',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: {
          type: 'string',
          description: 'The project key where the issue will be created',
        },
        summary: {
          type: 'string',
          description: 'Brief summary/title of the issue',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the issue',
        },
        issueType: {
          type: 'string',
          description: 'Type of issue (e.g., Bug, Task, Story, Epic)',
        },
        priority: {
          type: 'string',
          description: 'Priority level (e.g., High, Medium, Low)',
        },
        assignee: {
          type: 'string',
          description: 'Username of the person to assign the issue to',
        },
        labels: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Array of labels to add to the issue',
        },
        components: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Array of component names',
        },
        customFields: {
          type: 'object',
          description: 'Map of additional Jira field IDs/keys (e.g., customfield_10211) to include in the fields payload',
          additionalProperties: true,
        },
      },
      required: ['projectKey', 'summary', 'issueType'],
    },
  },
  {
    name: 'jira_update_issue',
    description: 'Update an existing Jira issue',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: {
          type: 'string',
          description: 'The Jira issue key to update',
        },
        summary: {
          type: 'string',
          description: 'New summary/title for the issue',
        },
        description: {
          type: 'string',
          description: 'New description for the issue',
        },
        assignee: {
          type: 'string',
          description: 'Username to assign the issue to',
        },
        priority: {
          type: 'string',
          description: 'New priority level',
        },
        labels: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'New array of labels',
        },
        customFields: {
          type: 'object',
          description: 'Map of additional Jira field IDs/keys (e.g., customfield_10211) to include in the fields payload',
          additionalProperties: true,
        },
      },
      required: ['issueKey'],
    },
  },
  {
    name: 'jira_transition_issue',
    description: 'Change the status of a Jira issue by running a workflow transition. The target status must be reachable from the current status in one step; if it is not, the error lists the statuses that are',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: {
          type: 'string',
          description: 'The Jira issue key',
        },
        status: {
          type: 'string',
          description: 'Target status name (e.g., "In Progress", "Done"), case-insensitive',
        },
      },
      required: ['issueKey', 'status'],
    },
  },
  {
    name: 'jira_add_comment',
    description: 'Add a comment to a Jira issue',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: {
          type: 'string',
          description: 'The Jira issue key',
        },
        comment: {
          type: 'string',
          description: 'The comment text to add',
        },
      },
      required: ['issueKey', 'comment'],
    },
  },
  {
    name: 'jira_get_comments',
    description: 'Get all comments from a Jira issue',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: {
          type: 'string',
          description: 'The Jira issue key',
        },
      },
      required: ['issueKey'],
    },
  },
  {
    name: 'jira_update_comment',
    description: 'Replace the text of an existing comment on a Jira issue',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: {
          type: 'string',
          description: 'The Jira issue key',
        },
        commentId: {
          type: 'string',
          description: 'The comment ID (the "id" field returned by jira_get_comments)',
        },
        comment: {
          type: 'string',
          description: 'The new comment text, replacing the current text',
        },
      },
      required: ['issueKey', 'commentId', 'comment'],
    },
  },
  {
    name: 'jira_delete_comment',
    description: 'Delete a comment from a Jira issue permanently',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: {
          type: 'string',
          description: 'The Jira issue key',
        },
        commentId: {
          type: 'string',
          description: 'The comment ID (the "id" field returned by jira_get_comments)',
        },
      },
      required: ['issueKey', 'commentId'],
    },
  },
  {
    name: 'jira_add_attachment',
    description: 'Upload a file as an attachment to a Jira issue. Pass either filePath to upload a local file, or content and fileName to upload content directly',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: {
          type: 'string',
          description: 'The Jira issue key',
        },
        filePath: {
          type: 'string',
          description: 'Absolute path of a local file to upload (read by the MCP server, so it must be on the machine the server runs on)',
        },
        content: {
          type: 'string',
          description: 'File content to upload instead of a local file; requires fileName',
        },
        contentEncoding: {
          type: 'string',
          enum: ['utf8', 'base64'],
          description: 'Encoding of content: "utf8" for text, "base64" for binary data (default: utf8)',
          default: 'utf8',
        },
        fileName: {
          type: 'string',
          description: 'Attachment name shown in Jira (e.g., report.csv). Defaults to the file name of filePath',
        },
      },
      required: ['issueKey'],
    },
  },
  {
    name: 'jira_download_attachment',
    description: 'Download an attachment of a Jira issue. With filePath, the file is saved locally. Without it, the content is returned directly: text files as text, PNG, JPEG, GIF and WebP images as images; other binary files require filePath',
    inputSchema: {
      type: 'object',
      properties: {
        attachmentId: {
          type: 'string',
          description: 'The attachment ID (the "id" returned by jira_add_attachment, or of an entry in fields.attachment returned by jira_get_issue)',
        },
        filePath: {
          type: 'string',
          description: 'Absolute path to save the file to, on the machine the MCP server runs on. If it is an existing directory, the file is saved there under its attachment name. An existing file is never overwritten',
        },
      },
      required: ['attachmentId'],
    },
  },
  {
    name: 'jira_delete_attachment',
    description: 'Delete an attachment from a Jira issue permanently',
    inputSchema: {
      type: 'object',
      properties: {
        attachmentId: {
          type: 'string',
          description: 'The attachment ID (the "id" returned by jira_add_attachment, or of an entry in fields.attachment returned by jira_get_issue)',
        },
      },
      required: ['attachmentId'],
    },
  },
  {
    name: 'jira_get_projects',
    description: 'List all available Jira projects',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'jira_get_project',
    description: 'Get details of a specific Jira project',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: {
          type: 'string',
          description: 'The project key',
        },
      },
      required: ['projectKey'],
    },
  },
  {
    name: 'jira_get_issue_types',
    description: 'Get available issue types for a project',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: {
          type: 'string',
          description: 'The project key',
        },
      },
      required: ['projectKey'],
    },
  },
  {
    name: 'jira_assign_issue',
    description: 'Assign a Jira issue to a user',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: {
          type: 'string',
          description: 'The Jira issue key',
        },
        assignee: {
          type: 'string',
          description: 'Username to assign the issue to',
        },
      },
      required: ['issueKey', 'assignee'],
    },
  },
  {
    name: 'jira_delete_issue',
    description: 'Delete a Jira issue permanently',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: {
          type: 'string',
          description: 'The Jira issue key to delete',
        },
      },
      required: ['issueKey'],
    },
  },
  {
    name: 'jira_get_current_user',
    description: 'Get information about the currently authenticated user',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'jira_get_activity_stream',
    description: 'Read the Jira activity stream (issues created, fields updated, status transitions, comments), newest first. Omit username for the global activity stream, or pass one to get that user\'s activity stream. Can be narrowed by project, issue and date range.',
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'Jira username whose activity to return (the "name" field from jira_get_current_user, not the display name). Omit for the global activity stream',
        },
        projectKey: {
          type: 'string',
          description: 'Only include activity in this project',
        },
        issueKey: {
          type: 'string',
          description: 'Only include activity on this issue (e.g., PROJ-123)',
        },
        after: {
          type: 'string',
          description: 'Only include activity after this ISO 8601 date or date-time (e.g., 2026-10-01 or 2026-10-01T08:00:00Z)',
        },
        before: {
          type: 'string',
          description: 'Only include activity before this ISO 8601 date or date-time',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of entries to return (default: 20)',
          default: 20,
        },
      },
    },
  },
];

// Handle tool calls
async function callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    switch (name) {
      case 'jira_get_issue': {
        const issue = await getJiraClient().getIssue(args.issueKey as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(issue, null, 2),
            },
          ],
        };
      }

      case 'jira_search_issues': {
        const issues = await getJiraClient().searchIssues(
          args.jql as string,
          args.maxResults as number
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(issues, null, 2),
            },
          ],
        };
      }

      case 'jira_create_issue': {
        const input: CreateIssueInput = {
          projectKey: args.projectKey as string,
          summary: args.summary as string,
          description: args.description as string,
          issueType: args.issueType as string,
          priority: args.priority as string,
          assignee: args.assignee as string,
          labels: args.labels as string[],
          components: args.components as string[],
          customFields: args.customFields as Record<string, any>,
        };
        const issue = await getJiraClient().createIssue(input);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully created issue ${issue.key}\n\n${JSON.stringify(issue, null, 2)}`,
            },
          ],
        };
      }

      case 'jira_update_issue': {
        const input: UpdateIssueInput = {
          summary: args.summary as string,
          description: args.description as string,
          assignee: args.assignee as string,
          priority: args.priority as string,
          labels: args.labels as string[],
          customFields: args.customFields as Record<string, any>,
        };
        const issue = await getJiraClient().updateIssue(args.issueKey as string, input);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated issue ${issue.key}\n\n${JSON.stringify(issue, null, 2)}`,
            },
          ],
        };
      }

      case 'jira_transition_issue': {
        const issue = await getJiraClient().transitionIssue(
          args.issueKey as string,
          args.status as string
        );
        return {
          content: [
            {
              type: 'text',
              text: `Successfully transitioned ${issue.key} to ${issue.fields.status.name}\n\n${JSON.stringify(issue, null, 2)}`,
            },
          ],
        };
      }

      case 'jira_add_comment': {
        const comment = await getJiraClient().addComment(
          args.issueKey as string,
          args.comment as string
        );
        return {
          content: [
            {
              type: 'text',
              text: `Successfully added comment to ${args.issueKey}\n\n${JSON.stringify(comment, null, 2)}`,
            },
          ],
        };
      }

      case 'jira_get_comments': {
        const comments = await getJiraClient().getComments(args.issueKey as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(comments, null, 2),
            },
          ],
        };
      }

      case 'jira_update_comment': {
        const comment = await getJiraClient().updateComment(
          args.issueKey as string,
          args.commentId as string,
          args.comment as string
        );
        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated comment ${args.commentId} on ${args.issueKey}\n\n${JSON.stringify(comment, null, 2)}`,
            },
          ],
        };
      }

      case 'jira_delete_comment': {
        await getJiraClient().deleteComment(args.issueKey as string, args.commentId as string);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted comment ${args.commentId} from ${args.issueKey}`,
            },
          ],
        };
      }

      case 'jira_add_attachment': {
        const input: AddAttachmentInput = {
          filePath: args.filePath as string,
          content: args.content as string,
          contentEncoding: args.contentEncoding as AddAttachmentInput['contentEncoding'],
          fileName: args.fileName as string,
        };
        const attachment = await getJiraClient().addAttachment(args.issueKey as string, input);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully attached ${attachment.filename} to ${args.issueKey}\n\n${JSON.stringify(attachment, null, 2)}`,
            },
          ],
        };
      }

      case 'jira_download_attachment': {
        if (args.filePath) {
          const { attachment, filePath } = await getJiraClient().saveAttachment(args.attachmentId as string, args.filePath as string);
          return {
            content: [
              {
                type: 'text',
                text: `Successfully downloaded ${attachment.filename} to ${filePath}\n\n${JSON.stringify(attachment, null, 2)}`,
              },
            ],
          };
        }

        const { attachment, data } = await getJiraClient().downloadAttachment(args.attachmentId as string);
        return {
          content: attachmentContent(attachment, data),
        };
      }

      case 'jira_delete_attachment': {
        await getJiraClient().deleteAttachment(args.attachmentId as string);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted attachment ${args.attachmentId}`,
            },
          ],
        };
      }

      case 'jira_get_projects': {
        const projects = await getJiraClient().getProjects();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(projects, null, 2),
            },
          ],
        };
      }

      case 'jira_get_project': {
        const project = await getJiraClient().getProject(args.projectKey as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(project, null, 2),
            },
          ],
        };
      }

      case 'jira_get_issue_types': {
        const issueTypes = await getJiraClient().getIssueTypes(args.projectKey as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(issueTypes, null, 2),
            },
          ],
        };
      }

      case 'jira_assign_issue': {
        await getJiraClient().assignIssue(args.issueKey as string, args.assignee as string);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully assigned ${args.issueKey} to ${args.assignee}`,
            },
          ],
        };
      }

      case 'jira_delete_issue': {
        await getJiraClient().deleteIssue(args.issueKey as string);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted issue ${args.issueKey}`,
            },
          ],
        };
      }

      case 'jira_get_current_user': {
        const user = await getJiraClient().getCurrentUser();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(user, null, 2),
            },
          ],
        };
      }

      case 'jira_get_activity_stream': {
        const entries = await getJiraClient().getActivityStream({
          username: args.username as string,
          projectKey: args.projectKey as string,
          issueKey: args.issueKey as string,
          after: args.after as string,
          before: args.before as string,
          maxResults: args.maxResults as number,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(entries, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}\n\n${error instanceof JiraApiError && error.data ? JSON.stringify(error.data, null, 2) : ''}`,
        },
      ],
      isError: true,
    };
  }
}

// Start the server
function main() {
  serveStdio({
    name: 'mcp-jira-server',
    version: '2.0.0',
    tools,
    callTool,
  });

  const config = checkEnvironmentConfig();
  if (config.isConfigured) {
    console.error('Jira MCP Server running on stdio (configured)');
  } else {
    console.error('Jira MCP Server running on stdio (not configured - JIRA_BASE_URL and JIRA_PAT required)');
  }
}

main();
