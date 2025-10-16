#!/usr/bin/env node

/**
 * RAWS MCP Server
 * Model Context Protocol server for Remote Automatic Weather Station data
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { getToolDefinitions, executeTool } from './tools/index.js';
import config from './config.js';
import logger from './logger.js';

/**
 * Initialize and start the MCP server
 */
async function main() {
  try {
    logger.info('Starting RAWS MCP Server', {
      version: '1.0.0',
      features: config.features
    });

    // Create MCP server instance
    const server = new Server(
      {
        name: 'raws-mcp',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Register tool list handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = getToolDefinitions();
      logger.debug('Listing tools', { count: tools.length });
      return { tools };
    });

    // Register tool call handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logger.info('Tool called', {
        tool: name,
        args: Object.keys(args || {})
      });

      try {
        const result = await executeTool(name, args || {});

        // Format response based on success
        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ],
            isError: true
          };
        }
      } catch (error) {
        logger.error('Tool execution failed', {
          tool: name,
          error: error.message
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'INTERNAL_ERROR',
                  message: error.message,
                  status: 500
                }
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    });

    // Set up error handlers
    server.onerror = (error) => {
      logger.error('MCP Server error', { error: error.message });
    };

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully');
      await server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully');
      await server.close();
      process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', {
        reason: reason instanceof Error ? reason.message : String(reason)
      });
    });

    // Start server with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('RAWS MCP Server started successfully', {
      transport: 'stdio',
      tools: getToolDefinitions().map(t => t.name)
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Start the server
main();
