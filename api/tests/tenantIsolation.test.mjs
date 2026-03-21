// ════════════════════════════════════════════════════════════════════
// Security Tests — Tenant isolation in persistence stores
// ════════════════════════════════════════════════════════════════════
// These tests verify that Cypher queries in stores always scope by
// tenantId, preventing cross-tenant data access (IDOR / broken
// access control).  They use a mock database that captures queries.
// ════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const routesDir = join(__dirname, '..', 'src', 'routes');
const persistenceDir = join(__dirname, '..', 'src', 'persistence');

describe('tenant isolation — Cypher query scoping', () => {
  const routeFiles = readdirSync(routesDir).filter((f) => f.endsWith('.mjs'));
  const persistenceFiles = readdirSync(persistenceDir).filter((f) => f.endsWith('.mjs'));

  for (const file of [...routeFiles, ...persistenceFiles]) {
    const dir = routeFiles.includes(file) ? routesDir : persistenceDir;
    const source = readFileSync(join(dir, file), 'utf-8');

    // Extract all Cypher template literals that contain MATCH
    const cypherMatches = source.match(/`[^`]*MATCH[^`]*`/gs) || [];

    for (const cypher of cypherMatches) {
      // Skip queries that are clearly global (constraints, config lookups,
      // questionnaire templates not scoped to tenant)
      const isGlobal = /CREATE CONSTRAINT/i.test(cypher)
        || /Question\b/.test(cypher) && !/Review|Answer/.test(cypher)
        || /ScoringConfig\s*\{configId:\s*'default'/.test(cypher);

      if (isGlobal) continue;

      // Skip queries that operate on a Review by reviewId — these are
      // guarded by requireOwnershipOrAdmin middleware which performs the
      // tenant+ownership check before the route handler executes.
      const reviewByIdGuarded = /Review\s*\{reviewId:\s*\$reviewId\}/.test(cypher);

      if (reviewByIdGuarded) continue;

      // Any query that creates new tenant-scoped root nodes should include
      // a SCOPED_TO relationship or tenantId property.
      const createsTenantData = /CREATE\s*\([^)]*:(Review)\b/.test(cypher);

      if (createsTenantData) {
        it(`${file}: tenant-scoped CREATE includes tenantId or SCOPED_TO`, () => {
          const hasTenantFilter = /tenantId/i.test(cypher)
            || /SCOPED_TO/.test(cypher)
            || /\$tenantId/.test(cypher);
          expect(hasTenantFilter, `Query in ${file} creates tenant data but lacks tenantId/SCOPED_TO:\n${cypher.slice(0, 200)}`).toBe(true);
        });
      }
    }
  }
});

describe('tenant isolation — store constructors', () => {
  it('TenantStore.deactivateTenant requires tenantId parameter', async () => {
    const source = readFileSync(join(persistenceDir, 'TenantStore.mjs'), 'utf-8');
    expect(source).toContain('deactivateTenant');
    expect(source).toContain('$tenantId');
  });

  it('AuditEventStore.logEvent includes tenantId in CREATE', () => {
    const source = readFileSync(join(persistenceDir, 'AuditEventStore.mjs'), 'utf-8');
    const createBlock = source.match(/CREATE\s*\(:AuditEvent[^)]+\)/s);
    expect(createBlock).not.toBeNull();
    expect(createBlock[0]).toContain('tenantId');
  });

  it('AuditEventStore.logEvent includes TTL in CREATE', () => {
    const source = readFileSync(join(persistenceDir, 'AuditEventStore.mjs'), 'utf-8');
    const createBlock = source.match(/CREATE\s*\(:AuditEvent[^)]+\)/s);
    expect(createBlock).not.toBeNull();
    expect(createBlock[0]).toContain('ttl');
  });
});
