#!/usr/bin/env node

import { serveStdio, type CallToolResult, type Tool } from './mcp-server.ts';
import { JiraApiError, JiraClient, type CreateIssueInput, type UpdateIssueInput } from './jira-client.ts';

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
        status: {
          type: 'string',
          description: 'New status/workflow state (e.g., "In Progress", "Done")',
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
          status: args.status as string,
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
    version: '1.0.0',
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
