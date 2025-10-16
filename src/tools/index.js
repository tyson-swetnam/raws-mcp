/**
 * MCP Tools Registration
 * Exports all tool definitions and handlers
 */

import * as getCurrentTool from './get-current.js';
import * as searchStationsTool from './search-stations.js';
import * as getHistoricalTool from './get-historical.js';
import * as fireIndicesTool from './fire-indices.js';

/**
 * All available tools
 */
export const tools = [
  getCurrentTool,
  searchStationsTool,
  getHistoricalTool,
  fireIndicesTool
];

/**
 * Tool registry mapping tool names to handlers
 */
export const toolRegistry = new Map(
  tools.map(tool => [tool.toolDefinition.name, tool.handler])
);

/**
 * Get tool definitions for MCP server registration
 */
export function getToolDefinitions() {
  return tools.map(tool => tool.toolDefinition);
}

/**
 * Get tool handler by name
 * @param {string} name - Tool name
 * @returns {Function|null} Tool handler or null if not found
 */
export function getToolHandler(name) {
  return toolRegistry.get(name) || null;
}

/**
 * Execute a tool with given arguments
 * @param {string} name - Tool name
 * @param {Object} args - Tool arguments
 * @returns {Promise<Object>} Tool result
 */
export async function executeTool(name, args) {
  const handler = getToolHandler(name);

  if (!handler) {
    return {
      success: false,
      error: {
        code: 'TOOL_NOT_FOUND',
        message: `Tool '${name}' not found`,
        status: 404,
        details: { toolName: name }
      }
    };
  }

  try {
    return await handler(args);
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'TOOL_EXECUTION_ERROR',
        message: error.message || 'Tool execution failed',
        status: 500,
        details: {
          toolName: name,
          error: error.message
        }
      }
    };
  }
}

export default {
  tools,
  toolRegistry,
  getToolDefinitions,
  getToolHandler,
  executeTool
};
