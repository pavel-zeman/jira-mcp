// Minimal Model Context Protocol server exposing tools over the stdio transport:
// JSON-RPC 2.0 messages, one per line, read from stdin and written to stdout (stderr stays free for logging)

import { createInterface } from 'node:readline';

export interface Tool {
  name: string;
  description?: string;
  // JSON Schema of the tool arguments
  inputSchema: {
    type: 'object';
    properties?: Record<string, object>;
    required?: string[];
  };
}

export interface CallToolResult {
  content: { type: 'text'; text: string }[];
  // Tool failures are reported in the result (not as JSON-RPC errors) so the model can see them
  isError?: boolean;
}

export interface ServerOptions {
  name: string;
  version: string;
  tools: Tool[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<CallToolResult>;
}

// Newest first; a client requesting any other version is offered the newest one
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05', '2024-10-07'];

// JSON-RPC 2.0 error codes
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

type RequestId = string | number;

class RpcError extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function send(message: object): void {
  // JSON.stringify escapes line breaks inside strings, so a message never spans more than one line
  process.stdout.write(JSON.stringify(message) + '\n');
}

function sendError(id: RequestId | null, code: number, message: string): void {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handleRequest(options: ServerOptions, method: string, params: Record<string, unknown>): Promise<object> {
  switch (method) {
    case 'initialize': {
      const requestedVersion = params.protocolVersion as string;
      return {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion) ? requestedVersion : SUPPORTED_PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: options.name, version: options.version },
      };
    }

    case 'ping':
      return {};

    case 'tools/list':
      return { tools: options.tools };

    case 'tools/call': {
      const { name, arguments: args = {} } = params;
      if (typeof name !== 'string' || !isObject(args)) {
        throw new RpcError(INVALID_PARAMS, 'tools/call requires a string "name" and an object "arguments"');
      }
      return options.callTool(name, args);
    }

    default:
      throw new RpcError(METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

async function handleMessage(options: ServerOptions, line: string): Promise<void> {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    sendError(null, PARSE_ERROR, 'Parse error');
    return;
  }

  // Arrays (JSON-RPC batches) are rejected here: MCP dropped batching in 2025-06-18
  if (!isObject(message) || message.jsonrpc !== '2.0') {
    sendError(null, INVALID_REQUEST, 'Invalid Request');
    return;
  }

  // This server never sends requests, so there are no responses to match
  if ('result' in message || 'error' in message) {
    return;
  }

  const { id, method, params = {} } = message;
  const isValidId = typeof id === 'string' || typeof id === 'number';
  if (typeof method !== 'string' || (id !== undefined && !isValidId)) {
    sendError(isValidId ? id : null, INVALID_REQUEST, 'Invalid Request');
    return;
  }

  // Notifications (initialized, cancelled, ...) need no reaction
  if (!isValidId) {
    return;
  }

  try {
    if (!isObject(params)) {
      throw new RpcError(INVALID_PARAMS, 'params must be an object');
    }
    const result = await handleRequest(options, method, params);
    send({ jsonrpc: '2.0', id, result });
  } catch (error: any) {
    sendError(id, error instanceof RpcError ? error.code : INTERNAL_ERROR, error?.message ?? String(error));
  }
}

export function serveStdio(options: ServerOptions): void {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });

  // Requests are handled concurrently; each response carries the id of its request
  lines.on('line', (line) => {
    if (line.trim() !== '') {
      handleMessage(options, line).catch((error) => console.error('Failed to handle MCP message:', error));
    }
  });
}
