#!/usr/bin/env node
import 'reflect-metadata';
import { runServer } from './server.js';

runServer().catch((error) => {
  console.error('Failed to start Spendlog MCP server:', error);
  process.exit(1);
});
