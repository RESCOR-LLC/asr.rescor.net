import { describe, it, expect } from 'vitest';
import {
  rskDiminishingAggregate,
  calculateStormAggregate,
  calculateStormWeightedCorrection,
  computeAssetShareA,
  computeAssetValueA,
  computeThreatT,
  computeControlEffective,
  computeControlEfficacy,
  computeVulnerabilityV
} from './stormRsk.js';

describe('stormRsk domain transforms', () => {
  it('computes diminishing returns aggregate with descending weighting', () => {
    const aggregate = rskDiminishingAggregate([0.2, 0.4, 0.1]);
    expect(aggregate).toBeCloseTo(0.45625, 6);
  });

  it('matches TestingCenter-style storm aggregate behavior', () => {
    const aggregate = calculateStormAggregate([4, 2, 1]);
    expect(aggregate).toBe(5);
  });

  it('caps weighted correction at 1', () => {
    const correction = calculateStormWeightedCorrection([0.9, 0.9, 0.9, 0.9]);
    expect(correction).toBe(1);
  });

  it('computes control effective remediation from implemented and correction', () => {
    const effective = computeControlEffective({ implemented: 0.75, correction: 0.5 });
    expect(effective).toBeCloseTo(0.375, 6);
  });

  it('computes control efficacy with RSK diminishing returns', () => {
    const efficacy = computeControlEfficacy([0.3, 0.2]);
    expect(efficacy).toBeCloseTo(0.35, 6);
  });

  it('computes threat probability and impact using HAM533 semantics', () => {
    const threat = computeThreatT({ history: 3, access: 2, means: 2 });

    expect(threat.probability).toBeCloseTo(12 / 45, 6);
    expect(threat.impact).toBeCloseTo(20 / 45, 6);
  });

  it('computes vulnerability severity/exposure using CRVE3 semantics', () => {
    const vulnerability = computeVulnerabilityV({
      capabilities: 2,
      resources: 3,
      visibility: 2,
      confidentialityExposure: 2,
      integrityExposure: 2,
      availabilityExposure: 2
    });

    expect(vulnerability.value).toBeGreaterThan(0);
    expect(vulnerability.value).toBeLessThanOrEqual(1);
  });

  it('computes asset value using valuation transform', () => {
    const asset = computeAssetValueA({
      dataClassification: 2,
      users: 3,
      highValueSelections: [3, 4]
    });

    expect(asset.value).toBeGreaterThan(0);
    expect(asset.value).toBeLessThan(1);
  });

  it('computes asset share A from absolute and total asset values', () => {
    const A = computeAssetShareA({ assetValue: 10000, totalAssetValue: 1000000 });
    expect(A).toBeCloseTo(0.01, 8);
  });
});
