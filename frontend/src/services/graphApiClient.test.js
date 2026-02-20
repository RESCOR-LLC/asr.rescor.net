import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGraphFromApi, putGraphToApi } from './graphApiClient.js';

describe('graphApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns graph when GET succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { graph: { links: {} } } })
    }));

    const result = await getGraphFromApi();
    expect(result.ok).toBe(true);
    expect(result.graph).toEqual({ links: {} });
  });

  it('returns notFound for 404 GET', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404
    }));

    const result = await getGraphFromApi();
    expect(result.ok).toBe(false);
    expect(result.notFound).toBe(true);
  });

  it('returns false when PUT fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const ok = await putGraphToApi({ links: {} });
    expect(ok).toBe(false);
  });
});
