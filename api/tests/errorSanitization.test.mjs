// ════════════════════════════════════════════════════════════════════
// Security Tests — Error message sanitization
// ════════════════════════════════════════════════════════════════════
// Verifies that route catch blocks do not leak internal error details
// (stack traces, SQL/Cypher errors, library messages) to clients.
// ════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const routesDir = join(__dirname, '..', 'src', 'routes');

describe('error sanitization — no error.message leakage in 500 responses', () => {
  const routeFiles = readdirSync(routesDir).filter((f) => f.endsWith('.mjs'));

  for (const file of routeFiles) {
    it(`${file}: catch blocks do not return error.message in 500 responses`, () => {
      const source = readFileSync(join(routesDir, file), 'utf-8');

      // Find all catch blocks
      const catchBlocks = source.match(/catch\s*\([^)]*\)\s*\{[^}]*\}/gs) || [];

      for (const block of catchBlocks) {
        // Check if this catch block sends a 500 AND includes error.message in the response
        const sends500 = /status\(500\)/.test(block) || /\.json\(.*error\.message/.test(block);
        const leaksMessage = /\.json\(\s*\{[^}]*error\.message[^}]*\}/.test(block)
          || /\.json\(\s*\{[^}]*error:\s*error\.message/.test(block);

        if (sends500) {
          expect(leaksMessage, `Catch block in ${file} leaks error.message to client:\n${block.slice(0, 200)}`).toBe(false);
        }
      }
    });
  }
});

describe('error sanitization — server.mjs global error handler', () => {
  it('global error handler returns generic message', () => {
    const source = readFileSync(join(__dirname, '..', 'src', 'server.mjs'), 'utf-8');

    // The global error handler should exist
    expect(source).toContain('application.use((error, request, response, next)');

    // Extract from the handler marker to the next line with response.status(500)
    const handlerStart = source.indexOf('application.use((error, request, response, next)');
    expect(handlerStart).toBeGreaterThan(-1);

    // Find the 500 json response line within 20 lines of the handler start
    const handlerRegion = source.slice(handlerStart, handlerStart + 500);

    expect(handlerRegion).toContain('Internal server error');
    expect(handlerRegion).not.toMatch(/\.json\(\s*\{[^}]*error:\s*error\.message/s);
  });
});
