import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
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

export interface JiraAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  // Download URL
  content: string;
  author: {
    displayName: string;
    emailAddress: string;
  };
  created: string;
}

export interface AddAttachmentInput {
  // Exactly one of filePath and content is required
  filePath?: string;
  content?: string;
  // Encoding of content: utf8 for text, base64 for binary data
  contentEncoding?: 'utf8' | 'base64';
  // Defaults to the base name of filePath; required with content
  fileName?: string;
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
  // Return the response body as a Buffer instead of parsing it
  binary?: boolean;
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

  private async request<T = any>(method: string, path: string, body?: unknown, { root = this.apiUrl, accept, binary }: RequestOptions = {}): Promise<T> {
    const headers = { ...this.headers };
    if (accept) {
      headers['Accept'] = accept;
    }
    if (body instanceof FormData) {
      // fetch() sets the multipart Content-Type itself, including the boundary
      delete headers['Content-Type'];
      // Jira's XSRF protection rejects multipart requests without this header
      headers['X-Atlassian-Token'] = 'no-check';
    }

    let response: Response;
    try {
      response = await fetch(`${root}${path}`, {
        method,
        headers,
        body: body === undefined || body instanceof FormData ? body : JSON.stringify(body)
      });
    } catch (error: any) {
      // fetch() reports every network failure as "fetch failed"; the real reason (DNS, TLS, ECONNREFUSED) is in `cause`
      throw new Error(`${method} ${path} failed: ${error.cause?.message ?? error.message}`, { cause: error });
    }

    if (binary && response.ok) {
      return Buffer.from(await response.arrayBuffer()) as T;
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

    return await this.getIssue(issueKey);
  }

  async transitionIssue(issueKey: string, statusName: string): Promise<JiraIssue> {
    // Only transitions available from the issue's current status are returned
    const transitionsResponse = await this.request<{ transitions: any[] }>('GET', `/issue/${issueKey}/transitions`);
    const transitions = transitionsResponse.transitions;

    // Find the transition that matches the desired status
    const transition = transitions.find((t: any) =>
      t.to.name.toLowerCase() === statusName.toLowerCase()
    );

    if (!transition) {
      const available = transitions.map((t: any) => t.to.name).join(', ') || 'none';
      throw new Error(`No transition found from the current status of ${issueKey} to status: ${statusName}. Available target statuses: ${available}`);
    }

    await this.request('POST', `/issue/${issueKey}/transitions`, {
      transition: {
        id: transition.id
      }
    });

    return await this.getIssue(issueKey);
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

  async updateComment(issueKey: string, commentId: string, comment: string): Promise<JiraComment> {
    return await this.request<JiraComment>('PUT', `/issue/${issueKey}/comment/${commentId}`, {
      body: comment
    });
  }

  async deleteComment(issueKey: string, commentId: string): Promise<void> {
    await this.request('DELETE', `/issue/${issueKey}/comment/${commentId}`);
  }

  async addAttachment(issueKey: string, input: AddAttachmentInput): Promise<JiraAttachment> {
    const { filePath, content, contentEncoding = 'utf8', fileName = filePath && basename(filePath) } = input;
    if (!filePath === !content) {
      throw new Error('Provide exactly one of filePath and content');
    }
    if (!fileName) {
      throw new Error('fileName is required when uploading content');
    }

    const data = filePath ? await readFile(filePath) : Buffer.from(content!, contentEncoding);
    const form = new FormData();
    // Jira picks the MIME type from the file name, so the part's generic application/octet-stream does no harm
    form.append('file', new Blob([data]), fileName);

    // Jira accepts several files per request and always returns an array
    const attachments = await this.request<JiraAttachment[]>('POST', `/issue/${issueKey}/attachments`, form);
    return attachments[0];
  }

  async downloadAttachment(attachmentId: string): Promise<{ attachment: JiraAttachment; data: Buffer }> {
    const attachment = await this.request<JiraAttachment>('GET', `/attachment/${attachmentId}`);
    // The content URL starts with Jira's own base URL setting, which can differ from JIRA_BASE_URL (e.g. behind a reverse proxy),
    // so only its /secure/attachment/... part is kept and requested from JIRA_BASE_URL like everything else
    const { pathname } = new URL(attachment.content);
    const start = pathname.indexOf('/secure/attachment/');
    if (start < 0) {
      throw new Error(`Unexpected content URL of attachment ${attachmentId}: ${attachment.content}`);
    }
    const data = await this.request<Buffer>('GET', pathname.slice(start), undefined, { root: this.baseUrl, accept: '*/*', binary: true });
    return { attachment, data };
  }

  // Saves into filePath under the attachment's name when filePath is a directory; never overwrites an existing file
  async saveAttachment(attachmentId: string, filePath: string): Promise<{ attachment: JiraAttachment; filePath: string }> {
    const { attachment, data } = await this.downloadAttachment(attachmentId);
    const isDirectory = (await stat(filePath).catch(() => undefined))?.isDirectory();
    const target = isDirectory ? join(filePath, basename(attachment.filename)) : filePath;
    await writeFile(target, data, { flag: 'wx' });
    return { attachment, filePath: target };
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    await this.request('DELETE', `/attachment/${attachmentId}`);
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
