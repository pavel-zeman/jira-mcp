import { parseActivityFeed, type ActivityEntry } from './activity-stream.ts';

export interface JiraConfig {
  baseUrl: string;
  personalAccessToken: string;
  userAgent?: string;
}

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      name: string;
    };
    issuetype: {
      name: string;
    };
    priority?: {
      name: string;
    };
    assignee?: {
      displayName: string;
      emailAddress: string;
    };
    reporter?: {
      displayName: string;
      emailAddress: string;
    };
    created: string;
    updated: string;
    [key: string]: any;
  };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrls?: {
    '48x48'?: string;
  };
}

export interface CreateIssueInput {
  projectKey: string;
  summary: string;
  description?: string;
  issueType: string;
  priority?: string;
  assignee?: string;
  labels?: string[];
  components?: string[];
  // Pass-through map for Jira custom fields (e.g., { customfield_10211: 10015 })
  customFields?: Record<string, any>;
}

export interface UpdateIssueInput {
  summary?: string;
  description?: string;
  assignee?: string;
  priority?: string;
  labels?: string[];
  status?: string;
  // Pass-through map for Jira custom fields to update
  customFields?: Record<string, any>;
}

export interface JiraComment {
  id: string;
  body: string;
  author: {
    displayName: string;
    emailAddress: string;
  };
  created: string;
  updated: string;
}

export interface ActivityStreamFilter {
  // Jira username (not display name); omit for the global activity stream
  username?: string;
  projectKey?: string;
  issueKey?: string;
  // ISO 8601 date or date-time
  after?: string;
  before?: string;
  maxResults?: number;
}

interface RequestOptions {
  // Defaults to the REST API; plugin servlets such as /activity live directly under the base URL
  root?: string;
  accept?: string;
}

function toEpochMillis(date: string): number {
  const millis = Date.parse(date);
  if (Number.isNaN(millis)) {
    throw new Error(`Invalid date "${date}": expected ISO 8601, e.g. 2026-10-01 or 2026-10-01T08:00:00Z`);
  }
  return millis;
}

export class JiraApiError extends Error {
  status: number;
  // Parsed response body (Jira usually returns { errorMessages, errors })
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'JiraApiError';
    this.status = status;
    this.data = data;
  }
}

export class JiraClient {
  private apiUrl: string;
  private headers: Record<string, string>;
  private baseUrl: string;

  constructor(config: JiraConfig) {
    this.baseUrl = config.baseUrl;
    this.apiUrl = `${config.baseUrl}/rest/api/2`;

    this.headers = {
      'Authorization': `Bearer ${config.personalAccessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (config.userAgent) {
      this.headers['User-Agent'] = config.userAgent;
    }
  }

  private async request<T = any>(method: string, path: string, body?: unknown, { root = this.apiUrl, accept }: RequestOptions = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${root}${path}`, {
        method,
        headers: accept ? { ...this.headers, 'Accept': accept } : this.headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (error: any) {
      // fetch() reports every network failure as "fetch failed"; the real reason (DNS, TLS, ECONNREFUSED) is in `cause`
      throw new Error(`${method} ${path} failed: ${error.cause?.message ?? error.message}`, { cause: error });
    }

    // Updates and deletes return 204 No Content, and error pages are not always JSON
    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }

    if (!response.ok) {
      throw new JiraApiError(`${method} ${path} failed with status code ${response.status}`, response.status, data);
    }

    return data;
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    return await this.request<JiraIssue>('GET', `/issue/${issueKey}`);
  }

  async searchIssues(jql: string, maxResults: number = 50): Promise<JiraIssue[]> {
    const result = await this.request<{ issues: JiraIssue[] }>('POST', '/search', {
      jql,
      maxResults,
      fields: ['summary', 'status', 'assignee', 'reporter', 'priority', 'issuetype', 'created', 'updated', 'description']
    });
    return result.issues;
  }

  async createIssue(input: CreateIssueInput): Promise<JiraIssue> {
    const issueData: any = {
      fields: {
        project: {
          key: input.projectKey
        },
        summary: input.summary,
        issuetype: {
          name: input.issueType
        }
      }
    };

    if (input.description) {
      issueData.fields.description = input.description;
    }

    if (input.priority) {
      issueData.fields.priority = { name: input.priority };
    }

    if (input.assignee) {
      issueData.fields.assignee = { name: input.assignee };
    }

    if (input.labels && input.labels.length > 0) {
      issueData.fields.labels = input.labels;
    }

    if (input.components && input.components.length > 0) {
      issueData.fields.components = input.components.map(c => ({ name: c }));
    }

    // Merge any provided custom fields directly into the fields payload
    if (input.customFields && typeof input.customFields === 'object') {
      Object.assign(issueData.fields, input.customFields);
    }

    const created = await this.request<{ key: string }>('POST', '/issue', issueData);
    return await this.getIssue(created.key);
  }

  async updateIssue(issueKey: string, input: UpdateIssueInput): Promise<JiraIssue> {
    const updateData: any = {
      fields: {}
    };

    if (input.summary) {
      updateData.fields.summary = input.summary;
    }

    if (input.description !== undefined) {
      updateData.fields.description = input.description;
    }

    if (input.assignee) {
      updateData.fields.assignee = { name: input.assignee };
    }

    if (input.priority) {
      updateData.fields.priority = { name: input.priority };
    }

    if (input.labels) {
      updateData.fields.labels = input.labels;
    }

    // Merge any provided custom fields directly into the fields payload
    if (input.customFields && typeof input.customFields === 'object') {
      Object.assign(updateData.fields, input.customFields);
    }

    await this.request('PUT', `/issue/${issueKey}`, updateData);

    // Handle status transition separately if provided
    if (input.status) {
      await this.transitionIssue(issueKey, input.status);
    }

    return await this.getIssue(issueKey);
  }

  async transitionIssue(issueKey: string, statusName: string): Promise<void> {
    // Get available transitions
    const transitionsResponse = await this.request<{ transitions: any[] }>('GET', `/issue/${issueKey}/transitions`);
    const transitions = transitionsResponse.transitions;

    // Find the transition that matches the desired status
    const transition = transitions.find((t: any) => 
      t.to.name.toLowerCase() === statusName.toLowerCase()
    );

    if (!transition) {
      throw new Error(`No transition found to status: ${statusName}`);
    }

    await this.request('POST', `/issue/${issueKey}/transitions`, {
      transition: {
        id: transition.id
      }
    });
  }

  async addComment(issueKey: string, comment: string): Promise<JiraComment> {
    return await this.request<JiraComment>('POST', `/issue/${issueKey}/comment`, {
      body: comment
    });
  }

  async getComments(issueKey: string): Promise<JiraComment[]> {
    const result = await this.request<{ comments: JiraComment[] }>('GET', `/issue/${issueKey}/comment`);
    return result.comments;
  }

  async getProjects(): Promise<JiraProject[]> {
    return await this.request<JiraProject[]>('GET', '/project');
  }

  async getProject(projectKey: string): Promise<JiraProject> {
    return await this.request<JiraProject>('GET', `/project/${projectKey}`);
  }

  async getIssueTypes(projectKey: string): Promise<any[]> {
    const project = await this.request<{ issueTypes?: any[] }>('GET', `/project/${projectKey}`);
    return project.issueTypes || [];
  }

  async assignIssue(issueKey: string, assignee: string): Promise<void> {
    await this.request('PUT', `/issue/${issueKey}/assignee`, {
      name: assignee
    });
  }

  async deleteIssue(issueKey: string): Promise<void> {
    await this.request('DELETE', `/issue/${issueKey}`);
  }

  async getCurrentUser(): Promise<any> {
    return await this.request('GET', '/myself');
  }

  async getActivityStream(filter: ActivityStreamFilter = {}): Promise<ActivityEntry[]> {
    // Each `streams` parameter is one filter; Jira combines them with AND
    const params = new URLSearchParams({ maxResults: String(filter.maxResults ?? 20) });

    if (filter.username) {
      params.append('streams', `user IS ${filter.username}`);
    }

    if (filter.projectKey) {
      params.append('streams', `key IS ${filter.projectKey}`);
    }

    if (filter.issueKey) {
      params.append('streams', `issue-key IS ${filter.issueKey}`);
    }

    const after = filter.after ? toEpochMillis(filter.after) : undefined;
    const before = filter.before ? toEpochMillis(filter.before) : undefined;
    // Separate AFTER and BEFORE filters drop entries inside the range, so a range is sent as BETWEEN
    if (after !== undefined && before !== undefined) {
      params.append('streams', `update-date BETWEEN ${after} ${before}`);
    } else if (after !== undefined) {
      params.append('streams', `update-date AFTER ${after}`);
    } else if (before !== undefined) {
      params.append('streams', `update-date BEFORE ${before}`);
    }

    const feed = await this.request<string>('GET', `/activity?${params}`, undefined, {
      root: this.baseUrl,
      accept: 'application/atom+xml'
    });
    return parseActivityFeed(feed);
  }
}
