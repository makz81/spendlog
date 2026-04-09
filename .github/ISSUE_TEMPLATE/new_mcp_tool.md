---
name: New MCP Tool
about: Propose a new MCP tool for Spendlog
title: "[Tool] "
labels: new-tool, good first issue
assignees: ''
---

## Tool Name

`tool_name` (snake_case)

## Description

What does this tool do? When would a user need it?

## Input Schema

```typescript
{
  param1: z.string(),        // Description
  param2: z.number().optional(), // Description
}
```

## Expected Output

```json
{
  "success": true,
  "data": {}
}
```

## Implementation Notes

- Which entities/services are involved?
- Any edge cases to handle?
- Should it be read-only or destructive?

## See also

- [How to add a new MCP Tool](../CONTRIBUTING.md#how-to-add-a-new-mcp-tool)
