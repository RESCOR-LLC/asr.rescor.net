// ════════════════════════════════════════════════════════════════════
// Unit Tests — API Client (ApiError class, response handling, fetch calls)
// ════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock MSAL modules before importing apiClient
vi.mock('@azure/msal-browser', () => ({
  InteractionRequiredAuthError: class extends Error { name = 'InteractionRequiredAuthError'; },
  PublicClientApplication: vi.fn(),
}));

vi.mock('./authConfig', () => ({
  msalInstance: {
    getAllAccounts: vi.fn(() => []),
    acquireTokenSilent: vi.fn(),
    acquireTokenRedirect: vi.fn(),
  },
  apiScopes: [],
  isMsalConfigured: false,
}));

import { ApiError, fetchConfiguration, fetchReviews } from './apiClient';

// ── ApiError class ───────────────────────────────────────────────

describe('ApiError', () => {
  it('creates an error with status and body', () => {
    const error = new ApiError('Not found', 404, { error: 'Not found' });
    expect(error.message).toBe('Not found');
    expect(error.status).toBe(404);
    expect(error.body).toEqual({ error: 'Not found' });
    expect(error.name).toBe('ApiError');
  });

  it('is an instance of Error', () => {
    const error = new ApiError('fail', 500, null);
    expect(error).toBeInstanceOf(Error);
  });

  it('handles null body', () => {
    const error = new ApiError('Server error', 500, null);
    expect(error.body).toBeNull();
  });
});

// ── API fetch functions ──────────────────────────────────────────

describe('API fetch functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchConfiguration calls /api/config', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn(async () => ({ scoringConfiguration: {} })),
    };
    global.fetch = vi.fn(async () => mockResponse) as unknown as typeof fetch;

    const result = await fetchConfiguration();

    expect(global.fetch).toHaveBeenCalledOnce();
    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callUrl).toBe('/api/config');
    expect(result).toEqual({ scoringConfiguration: {} });
  });

  it('fetchReviews returns array from /api/reviews', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn(async () => [{ reviewId: 'r1' }]),
    };
    global.fetch = vi.fn(async () => mockResponse) as unknown as typeof fetch;

    const result = await fetchReviews();

    expect(result).toEqual([{ reviewId: 'r1' }]);
  });

  it('throws ApiError on non-2xx response', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: vi.fn(async () => ({ error: 'Internal server error' })),
    };
    global.fetch = vi.fn(async () => mockResponse) as unknown as typeof fetch;

    await expect(fetchConfiguration()).rejects.toThrow(ApiError);

    try {
      await fetchConfiguration();
    } catch (error) {
      expect((error as ApiError).status).toBe(500);
      expect((error as ApiError).message).toBe('Internal server error');
    }
  });

  it('extracts error message from response body', async () => {
    const mockResponse = {
      ok: false,
      status: 403,
      json: vi.fn(async () => ({ error: 'Forbidden' })),
    };
    global.fetch = vi.fn(async () => mockResponse) as unknown as typeof fetch;

    try {
      await fetchConfiguration();
    } catch (error) {
      expect((error as ApiError).message).toBe('Forbidden');
      expect((error as ApiError).status).toBe(403);
    }
  });

  it('falls back to HTTP status when body has no error field', async () => {
    const mockResponse = {
      ok: false,
      status: 502,
      json: vi.fn(async () => ({})),
    };
    global.fetch = vi.fn(async () => mockResponse) as unknown as typeof fetch;

    try {
      await fetchConfiguration();
    } catch (error) {
      expect((error as ApiError).message).toBe('HTTP 502');
    }
  });

  it('handles json parse failure on error response', async () => {
    const mockResponse = {
      ok: false,
      status: 503,
      json: vi.fn(async () => { throw new Error('Invalid JSON'); }),
    };
    global.fetch = vi.fn(async () => mockResponse) as unknown as typeof fetch;

    try {
      await fetchConfiguration();
    } catch (error) {
      expect((error as ApiError).status).toBe(503);
      expect((error as ApiError).message).toBe('HTTP 503');
    }
  });
});
