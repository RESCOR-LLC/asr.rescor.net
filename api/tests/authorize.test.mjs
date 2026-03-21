// ════════════════════════════════════════════════════════════════════
// Security Tests — RBAC authorization middleware
// ════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { authorize, initializeAuthorization } from '../src/middleware/authorize.mjs';

function createMockRequest(roles = [], extra = {}) {
  return {
    user: { sub: 'test-user', tenantId: 'tenant-1', roles, preferred_username: 'tester', ...extra },
    path: '/test',
    method: 'GET',
    ip: '127.0.0.1',
    get: () => 'test-agent',
  };
}

function createMockResponse() {
  const response = {
    statusCode: null,
    body: null,
    status(code) { response.statusCode = code; return response; },
    json(data) { response.body = data; return response; },
  };
  return response;
}

describe('authorize middleware', () => {
  beforeEach(() => {
    initializeAuthorization({ recorder: null, auditEventStore: null });
  });

  it('allows admin to access any role-gated route', () => {
    const middleware = authorize('reviewer', 'user');
    const request = createMockRequest(['admin']);
    const response = createMockResponse();
    let nextCalled = false;

    middleware(request, response, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(response.statusCode).toBeNull();
  });

  it('allows user with matching role', () => {
    const middleware = authorize('reviewer', 'user');
    const request = createMockRequest(['user']);
    const response = createMockResponse();
    let nextCalled = false;

    middleware(request, response, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  it('rejects user without matching role with 403', () => {
    const middleware = authorize('admin');
    const request = createMockRequest(['user']);
    const response = createMockResponse();
    let nextCalled = false;

    middleware(request, response, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects request with no user object', () => {
    const middleware = authorize('user');
    const request = { user: null, path: '/test', method: 'GET', ip: '127.0.0.1', get: () => null };
    const response = createMockResponse();
    let nextCalled = false;

    middleware(request, response, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(403);
  });

  it('rejects request with empty roles array', () => {
    const middleware = authorize('reviewer');
    const request = createMockRequest([]);
    const response = createMockResponse();
    let nextCalled = false;

    middleware(request, response, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(response.statusCode).toBe(403);
  });

  it('does not leak role details in error response', () => {
    const middleware = authorize('admin');
    const request = createMockRequest(['user']);
    const response = createMockResponse();

    middleware(request, response, () => {});

    expect(response.body.error.message).toBe('Insufficient permissions');
    expect(JSON.stringify(response.body)).not.toContain('admin');
    expect(JSON.stringify(response.body)).not.toContain('user');
  });
});
