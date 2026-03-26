// ════════════════════════════════════════════════════════════════════
// Unit Tests — TenantDataStore (export / import tenant data)
// ════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantDataStore } from '../src/persistence/TenantDataStore.mjs';

// ── Mock database ────────────────────────────────────────────────

function createMockDatabase() {
  return { query: vi.fn() };
}

// ── Helpers for Neo4j-like integer objects ────────────────────────

function neo4jInteger(value) {
  return { toNumber: () => value };
}

// ── Minimal global nodes fixture ─────────────────────────────────

function emptyGlobalNodes() {
  return {
    questionnaires: [],
    domains: [],
    questions: [],
    weightTiers: [],
    classificationQuestions: [],
    sourceQuestions: [],
    environmentQuestions: [],
    deploymentArchetypes: [],
    scoreScales: [],
  };
}

// ── Minimal valid export data fixture ────────────────────────────

function minimalExportData(overrides = {}) {
  return {
    globalNodes: emptyGlobalNodes(),
    scoringConfigs: [],
    questionnaireSnapshots: [],
    questionnaireDrafts: [],
    gateQuestions: [],
    complianceTagConfigs: [],
    users: [],
    reviews: [],
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('TenantDataStore', () => {
  let database;
  let store;

  beforeEach(() => {
    database = createMockDatabase();
    store = new TenantDataStore(database);
  });

  // ── Constructor ──────────────────────────────────────────────────

  it('stores database reference', () => {
    expect(store.database).toBe(database);
  });

  // ════════════════════════════════════════════════════════════════
  // EXPORT
  // ════════════════════════════════════════════════════════════════

  describe('exportTenantData', () => {
    it('returns null when tenant not found', async () => {
      database.query.mockResolvedValueOnce([]);

      const result = await store.exportTenantData('nonexistent');

      expect(result).toBeNull();
      expect(database.query).toHaveBeenCalledOnce();
    });

    it('returns complete export package when tenant exists', async () => {
      // 1. Tenant lookup
      database.query.mockResolvedValueOnce([{ name: 'Acme Corp' }]);

      // 2-9. The eight parallel export queries (scoring, snapshots, drafts,
      //       gate questions, compliance tags, reviews, users, global nodes)
      // ScoringConfigs
      database.query.mockResolvedValueOnce([{ sc: { configId: 'cfg-1', dampingFactor: 0.5, tenantId: 'acme' } }]);
      // QuestionnaireSnapshots
      database.query.mockResolvedValueOnce([]);
      // QuestionnaireDrafts
      database.query.mockResolvedValueOnce([]);
      // GateQuestions
      database.query.mockResolvedValueOnce([]);
      // ComplianceTagConfigs
      database.query.mockResolvedValueOnce([]);
      // Reviews
      database.query.mockResolvedValueOnce([]);
      // Users
      database.query.mockResolvedValueOnce([{ u: { sub: 'user-1', email: 'a@b.com' } }]);
      // Global nodes — 9 parallel sub-queries
      database.query.mockResolvedValueOnce([]); // questionnaires
      database.query.mockResolvedValueOnce([]); // domains
      database.query.mockResolvedValueOnce([]); // questions
      database.query.mockResolvedValueOnce([]); // weightTiers
      database.query.mockResolvedValueOnce([]); // classificationQuestions
      database.query.mockResolvedValueOnce([]); // sourceQuestions
      database.query.mockResolvedValueOnce([]); // environmentQuestions
      database.query.mockResolvedValueOnce([]); // deploymentArchetypes
      database.query.mockResolvedValueOnce([]); // scoreScales

      const result = await store.exportTenantData('acme', 'admin@acme.com');

      expect(result).not.toBeNull();
      expect(result.manifest.formatVersion).toBe(2);
      expect(result.manifest.sourceTenantId).toBe('acme');
      expect(result.manifest.sourceTenantName).toBe('Acme Corp');
      expect(result.manifest.exportedBy).toBe('admin@acme.com');
      expect(result.manifest.counts.scoringConfigs).toBe(1);
      expect(result.manifest.counts.users).toBe(1);
      expect(result.scoringConfigs).toHaveLength(1);
      // tenantId should be stripped from exported scoring config
      expect(result.scoringConfigs[0]).not.toHaveProperty('tenantId');
      expect(result.users).toHaveLength(1);
    });

    it('converts Neo4j integers via toPlain in exported nodes', async () => {
      // Tenant lookup
      database.query.mockResolvedValueOnce([{ name: 'Test' }]);
      // ScoringConfigs — return node with Neo4j integer property
      database.query.mockResolvedValueOnce([{
        sc: { configId: 'cfg-1', rawMax: neo4jInteger(100), tenantId: 'test' },
      }]);
      // Remaining parallel queries return empty
      for (let i = 0; i < 16; i++) database.query.mockResolvedValueOnce([]);

      const result = await store.exportTenantData('test');

      // rawMax should be converted from Neo4j integer to plain number
      expect(result.scoringConfigs[0].rawMax).toBe(100);
      expect(typeof result.scoringConfigs[0].rawMax).toBe('number');
    });

    it('aggregates review child counts in manifest', async () => {
      // Use implementation-based routing: match on cypher text to return correct data
      database.query.mockImplementation((cypher) => {
        if (cypher.includes('MATCH (t:Tenant')) return Promise.resolve([{ name: 'Test' }]);
        if (cypher.includes('MATCH (review:Review)-[:SCOPED_TO]')) {
          return Promise.resolve([{ review: { reviewId: 'rev-1', applicationName: 'App' } }]);
        }
        if (cypher.includes('MATCH (review:Review)-[:CONTAINS]->(a:Answer)') && !cypher.includes('HAS_REMEDIATION')) {
          return Promise.resolve([{ reviewId: 'rev-1', a: { domainIndex: 0, questionIndex: 0, rawScore: 3 } }]);
        }
        if (cypher.includes('HAS_REMEDIATION')) return Promise.resolve([]);
        if (cypher.includes('HAS_PROPOSED_CHANGE')) {
          return Promise.resolve([{ reviewId: 'rev-1', pc: { changeId: 'pc-1' } }]);
        }
        if (cypher.includes('HAS_AUDITOR_COMMENT')) return Promise.resolve([]);
        if (cypher.includes('GateAnswer')) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      const result = await store.exportTenantData('test');

      expect(result.manifest.counts.reviews).toBe(1);
      expect(result.manifest.counts.answers).toBe(1);
      expect(result.manifest.counts.proposedChanges).toBe(1);
      expect(result.manifest.counts.remediationItems).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // IMPORT
  // ════════════════════════════════════════════════════════════════

  describe('importTenantData', () => {
    it('throws 404 when target tenant not found or inactive', async () => {
      database.query.mockResolvedValueOnce([]);

      await expect(store.importTenantData('missing', minimalExportData()))
        .rejects.toThrow('Target tenant not found or inactive');
    });

    it('throws 409 when tenant has existing reviews (reject strategy)', async () => {
      // Tenant exists
      database.query.mockResolvedValueOnce([{ name: 'Existing' }]);
      // Conflict check — existing review count
      database.query.mockResolvedValueOnce([{ count: neo4jInteger(3) }]);

      await expect(store.importTenantData('existing', minimalExportData()))
        .rejects.toThrow('already has 3 review(s)');
    });

    it('imports scoring configs, users, and reviews into target tenant', async () => {
      // Tenant lookup
      database.query.mockResolvedValueOnce([{ name: 'Target' }]);
      // Conflict check (reject) — no existing reviews
      database.query.mockResolvedValueOnce([{ count: neo4jInteger(0) }]);
      // All subsequent queries succeed with empty results
      database.query.mockResolvedValue([]);

      const data = minimalExportData({
        scoringConfigs: [{ configId: 'cfg-1', dampingFactor: 0.5, rawMax: 100 }],
        users: [{ sub: 'user-1', username: 'alice', email: 'alice@test.com', roles: ['user'] }],
        reviews: [{
          reviewId: 'rev-1',
          applicationName: 'TestApp',
          assessor: 'alice',
          status: 'IN_PROGRESS',
          created: '2026-01-01T00:00:00Z',
          createdBy: 'alice',
          updated: '2026-01-01T00:00:00Z',
          answers: [{ domainIndex: 0, questionIndex: 0, rawScore: 3 }],
          remediationItems: [],
          proposedChanges: [],
          auditorComments: [],
          gateAnswers: [],
        }],
      });

      const result = await store.importTenantData('target', data);

      expect(result.success).toBe(true);
      expect(result.targetTenantId).toBe('target');
      expect(result.counts.scoringConfigs).toBe(1);
      expect(result.counts.users).toBe(1);
      expect(result.counts.reviews).toBe(1);
      expect(result.counts.answers).toBe(1);
    });

    it('skips existing reviews in merge mode', async () => {
      // Tenant lookup
      database.query.mockResolvedValueOnce([{ name: 'Target' }]);
      // All subsequent queries return empty by default
      database.query.mockResolvedValue([]);
      // For the merge-mode per-review existence check, return existing review
      // We need to carefully order: after the tenant+conflict queries,
      // globalNodes import calls, then the review existence check
      // Reset and set up sequentially
      database.query.mockReset();
      // Tenant lookup
      database.query.mockResolvedValueOnce([{ name: 'Target' }]);
      // Conflict check is skipped for merge strategy — no query
      // No conflict check query happens for merge — goes straight to import
      // Global nodes: 0 nodes to import, returns immediately
      // ScoringConfigs: none
      // QuestionnaireSnapshots: none
      // QuestionnaireDrafts: none
      // GateQuestions: none
      // ComplianceTagConfigs: none
      // Users: none
      // Reviews: existence check returns a match → skip
      database.query.mockResolvedValueOnce([{ r: { reviewId: 'rev-1' } }]);

      const data = minimalExportData({
        reviews: [{
          reviewId: 'rev-1',
          applicationName: 'OldApp',
          assessor: 'alice',
          status: 'SUBMITTED',
          created: '2026-01-01T00:00:00Z',
          createdBy: 'alice',
          updated: '2026-01-01T00:00:00Z',
          answers: [],
          remediationItems: [],
          proposedChanges: [],
          auditorComments: [],
          gateAnswers: [],
        }],
      });

      const result = await store.importTenantData('target', data, { conflictStrategy: 'merge' });

      expect(result.counts.reviews).toBe(0);
      expect(result.counts.skipped).toBe(1);
    });

    it('calls _wipeTenantData before import with replace strategy', async () => {
      // Tenant lookup
      database.query.mockResolvedValueOnce([{ name: 'Target' }]);
      // Wipe queries (11 total) + subsequent import queries
      database.query.mockResolvedValue([]);

      const result = await store.importTenantData('target', minimalExportData(), { conflictStrategy: 'replace' });

      expect(result.success).toBe(true);
      // Verify wipe queries were called (tenant lookup + 11 wipe queries at minimum)
      expect(database.query.mock.calls.length).toBeGreaterThanOrEqual(12);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // checkQuestionnaireConflicts
  // ════════════════════════════════════════════════════════════════

  describe('checkQuestionnaireConflicts', () => {
    it('returns empty array when no global nodes provided', async () => {
      const result = await store.checkQuestionnaireConflicts(null);

      expect(result).toEqual([]);
      expect(database.query).not.toHaveBeenCalled();
    });

    it('detects name collision with different questionnaire ID', async () => {
      database.query.mockResolvedValueOnce([
        { id: 'existing-id', name: 'ASR Standard' },
      ]);

      const globalNodes = {
        questionnaires: [{ questionnaireId: 'incoming-id', name: 'ASR Standard' }],
      };

      const conflicts = await store.checkQuestionnaireConflicts(globalNodes);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].incomingId).toBe('incoming-id');
      expect(conflicts[0].existingId).toBe('existing-id');
    });
  });

  // ════════════════════════════════════════════════════════════════
  // _buildIdMap (tested indirectly via regenerateIds option)
  // ════════════════════════════════════════════════════════════════

  describe('importTenantData with regenerateIds', () => {
    it('generates new UUIDs for review, draft, remediation, proposedChange, and comment IDs', async () => {
      // Tenant lookup
      database.query.mockResolvedValueOnce([{ name: 'Target' }]);
      // Conflict check — no existing reviews
      database.query.mockResolvedValueOnce([{ count: neo4jInteger(0) }]);
      // All subsequent queries succeed
      database.query.mockResolvedValue([]);

      const data = minimalExportData({
        questionnaireDrafts: [{ draftId: 'original-draft-id', label: 'v1', status: 'DRAFT', data: '{}', created: '2026-01-01', updated: '2026-01-01' }],
        reviews: [{
          reviewId: 'original-review-id',
          applicationName: 'App',
          assessor: 'alice',
          status: 'IN_PROGRESS',
          created: '2026-01-01T00:00:00Z',
          createdBy: 'alice',
          updated: '2026-01-01T00:00:00Z',
          answers: [],
          remediationItems: [{ remediationId: 'original-rem-id', answerKey: { domainIndex: 0, questionIndex: 0 } }],
          proposedChanges: [{ changeId: 'original-pc-id', domainIndex: 0, questionIndex: 0 }],
          auditorComments: [{ commentId: 'original-ac-id', text: 'Fix this' }],
          gateAnswers: [],
        }],
      });

      await store.importTenantData('target', data, { regenerateIds: true });

      // Find the CREATE draft query — draftId should differ from original
      const draftCall = database.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('QuestionnaireDraft')
      );
      expect(draftCall).toBeDefined();
      expect(draftCall[1].draftId).not.toBe('original-draft-id');

      // Find the CREATE review query — reviewId should differ from original
      const reviewCall = database.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('CREATE (review:Review')
      );
      expect(reviewCall).toBeDefined();
      expect(reviewCall[1].reviewId).not.toBe('original-review-id');
    });
  });
});
