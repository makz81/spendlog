#!/usr/bin/env node
import 'reflect-metadata';
import { runServer } from './server.js';

runServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('Failed to start Spendlog MCP server:', message);
  process.exit(1);
});
