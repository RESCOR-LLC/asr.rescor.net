import { describe, expect, it } from 'vitest';
import {
  cloneDefaultGraph,
  loadGraphFromStorage,
  parseGraphJson,
  saveGraphToStorage,
  serializeGraph,
  validateGraphStructure
} from './graphPersistence.js';
import { mockRiskGraph } from '../data/mockRiskGraph.js';

function createMemoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}

describe('graphPersistence', () => {
  it('validates a correct graph shape', () => {
    expect(() => validateGraphStructure(mockRiskGraph)).not.toThrow();
  });

  it('rejects invalid imported json payload', () => {
    expect(() => parseGraphJson('{"assets": []}')).toThrow();
  });

  it('round-trips graph into storage', () => {
    const storage = createMemoryStorage();

    saveGraphToStorage(mockRiskGraph, storage);
    const loaded = loadGraphFromStorage(mockRiskGraph, storage);

    expect(loaded.warning).toBe('');
    expect(loaded.graph.links.assetThreat.length).toBe(mockRiskGraph.links.assetThreat.length);
  });

  it('falls back to defaults when storage contains invalid graph', () => {
    const storage = createMemoryStorage({
      'asr.linkedRiskGraph.v1': '{"not":"graph"}'
    });

    const loaded = loadGraphFromStorage(mockRiskGraph, storage);

    expect(loaded.warning).toContain('invalid');
    expect(loaded.graph.assets.length).toBe(mockRiskGraph.assets.length);
  });

  it('serializes graph as pretty json', () => {
    const serialized = serializeGraph(mockRiskGraph);
    const parsed = JSON.parse(serialized);

    expect(parsed.links.threatVulnerability.length).toBe(mockRiskGraph.links.threatVulnerability.length);
  });

  it('returns deep clone for default graph copy', () => {
    const clone = cloneDefaultGraph(mockRiskGraph);
    clone.assets[0].name = 'Changed';

    expect(mockRiskGraph.assets[0].name).not.toBe('Changed');
  });
});
