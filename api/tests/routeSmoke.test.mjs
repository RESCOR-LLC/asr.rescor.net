// ════════════════════════════════════════════════════════════════════
// Route Handler Smoke Tests — verify routes mount, respond, and
// handle database errors gracefully without leaking internals
// ════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import { createConfigRouter } from '../src/routes/config.mjs';
import { createReviewsRouter } from '../src/routes/reviews.mjs';
import { createRemediationRouter } from '../src/routes/remediation.mjs';
import { createProposedChangesRouter } from '../src/routes/proposedChanges.mjs';
import { createAuditorCommentsRouter } from '../src/routes/auditorComments.mjs';
import { initializeAuthorization } from '../src/middleware/authorize.mjs';

// ── Mock helpers ──────────────────────────────────────────────────

function createMockDatabase(queryResults = []) {
  return {
    query: vi.fn(async () => queryResults),
    transaction: vi.fn(async (callback) => {
      const mockTransaction = { run: vi.fn(async () => ({ records: [] })) };
      return callback(mockTransaction);
    }),
  };
}

function createMockRecorder() {
  return { emit: vi.fn() };
}

function injectUser(roles = ['admin'], tenantId = 'tenant-1') {
  return (request, _response, next) => {
    request.user = {
      sub: 'test-user',
      preferred_username: 'tester@example.com',
      tenantId,
      roles,
    };
    next();
  };
}

async function makeRequest(application, method, path) {
  // Use a simple approach: create a mock request/response and call the app
  return new Promise((resolve) => {
    const request = {
      method: method.toUpperCase(),
      url: path,
      headers: { host: 'localhost:3100' },
      get: (header) => request.headers[header.toLowerCase()] || null,
      ip: '127.0.0.1',
    };

    const response = {
      statusCode: 200,
      _body: null,
      _ended: false,
      status(code) { response.statusCode = code; return response; },
      json(data) { response._body = data; response._ended = true; resolve(response); return response; },
      end() { response._ended = true; resolve(response); return response; },
      setHeader() { return response; },
      getHeader() { return null; },
      removeHeader() { return response; },
      headersSent: false,
    };

    application(request, response);
  });
}

// ── Tests ─────────────────────────────────────────────────────────

describe('route handler smoke tests', () => {
  let database;
  let recorder;

  beforeEach(() => {
    database = createMockDatabase();
    recorder = createMockRecorder();
    initializeAuthorization({ recorder: null, auditEventStore: null });
  });

  // ── Config route ────────────────────────────────────────────────

  describe('config router', () => {
    it('returns 200 with config data when database queries succeed', async () => {
      database.query = vi.fn(async () => []);

      const application = express();
      application.use(injectUser());
      application.use('/api/config', createConfigRouter(database, recorder));

      const response = await makeRequest(application, 'GET', '/api/config');

      expect(response.statusCode).toBe(200);
      expect(database.query).toHaveBeenCalled();
    });

    it('returns 200 for /api/config/scoring', async () => {
      database.query = vi.fn(async () => []);

      const application = express();
      application.use(injectUser());
      application.use('/api/config', createConfigRouter(database, recorder));

      const response = await makeRequest(application, 'GET', '/api/config/scoring');

      expect(response.statusCode).toBe(200);
    });

    it('returns 500 when database throws', async () => {
      database.query = vi.fn(async () => { throw new Error('DB down'); });

      const application = express();
      application.use(injectUser());
      application.use('/api/config', createConfigRouter(database, recorder));

      const response = await makeRequest(application, 'GET', '/api/config');

      expect(response.statusCode).toBe(500);
      expect(response._body.error).toBe('Internal server error');
    });

    it('returns 404 for unknown questionnaire version', async () => {
      database.query = vi.fn(async () => []);

      const application = express();
      application.use(injectUser());
      application.use('/api/config', createConfigRouter(database, recorder));

      const response = await makeRequest(application, 'GET', '/api/config?version=nonexistent');

      expect(response.statusCode).toBe(404);
    });
  });

  // ── Reviews route ───────────────────────────────────────────────

  describe('reviews router', () => {
    it('returns 200 with empty array when no reviews exist', async () => {
      database.query = vi.fn(async () => []);

      const application = express();
      application.use(injectUser());
      application.use('/api/reviews', createReviewsRouter(database, null, recorder));

      const response = await makeRequest(application, 'GET', '/api/reviews');

      expect(response.statusCode).toBe(200);
      expect(response._body).toEqual([]);
    });

    it('returns 200 with mapped review data', async () => {
      database.query = vi.fn(async () => [
        { review: { reviewId: 'r1', name: 'Test Review', active: true }, questionnaireName: 'Q1' },
      ]);

      const application = express();
      application.use(injectUser());
      application.use('/api/reviews', createReviewsRouter(database, null, recorder));

      const response = await makeRequest(application, 'GET', '/api/reviews');

      expect(response.statusCode).toBe(200);
      expect(response._body).toHaveLength(1);
      expect(response._body[0].reviewId).toBe('r1');
    });

    it('returns 404 for nonexistent review', async () => {
      database.query = vi.fn(async () => []);

      const application = express();
      application.use(injectUser());
      application.use('/api/reviews', createReviewsRouter(database, null, recorder));

      const response = await makeRequest(application, 'GET', '/api/reviews/nonexistent');

      expect(response.statusCode).toBe(404);
    });

    it('returns 500 when database throws on list', async () => {
      database.query = vi.fn(async () => { throw new Error('DB down'); });

      const application = express();
      application.use(injectUser());
      application.use('/api/reviews', createReviewsRouter(database, null, recorder));

      const response = await makeRequest(application, 'GET', '/api/reviews');

      expect(response.statusCode).toBe(500);
      expect(response._body.error).toBe('Internal server error');
    });
  });

  // ── Remediation route ───────────────────────────────────────────

  describe('remediation router', () => {
    it('returns 200 with remediation items', async () => {
      database.query = vi.fn(async () => []);

      const application = express();
      application.use(injectUser());
      application.use('/api/reviews', createRemediationRouter(database, null, recorder));

      const response = await makeRequest(application, 'GET', '/api/reviews/r1/remediation');

      expect(response.statusCode).toBe(200);
    });
  });

  // ── Proposed changes route ──────────────────────────────────────

  describe('proposedChanges router', () => {
    it('returns 200 with proposed changes', async () => {
      database.query = vi.fn(async () => []);

      const application = express();
      application.use(injectUser());
      application.use('/api/reviews', createProposedChangesRouter(database, null, recorder));

      const response = await makeRequest(application, 'GET', '/api/reviews/r1/proposed-changes');

      expect(response.statusCode).toBe(200);
    });
  });

  // ── Auditor comments route ──────────────────────────────────────

  describe('auditorComments router', () => {
    it('returns 200 with auditor comments', async () => {
      database.query = vi.fn(async () => []);

      const application = express();
      application.use(injectUser());
      application.use('/api/reviews', createAuditorCommentsRouter(database, null, recorder));

      const response = await makeRequest(application, 'GET', '/api/reviews/r1/auditor-comments');

      expect(response.statusCode).toBe(200);
    });
  });

  // ── Error response sanitization (integration) ──────────────────

  describe('error response sanitization', () => {
    it('never exposes internal error messages in 500 responses', async () => {
      database.query = vi.fn(async () => { throw new Error('SENSITIVE: Neo4j connection string leaked'); });

      const application = express();
      application.use(injectUser());
      application.use('/api/config', createConfigRouter(database, recorder));

      const response = await makeRequest(application, 'GET', '/api/config');

      expect(response.statusCode).toBe(500);
      const responseText = JSON.stringify(response._body);
      expect(responseText).not.toContain('SENSITIVE');
      expect(responseText).not.toContain('Neo4j');
      expect(responseText).not.toContain('leaked');
    });
  });
});
