import { describe, it, expect } from 'vitest';
import {
  computeAssetValueA,
  computeThreatT,
  computeVulnerabilityV,
  computeControlEffective,
  computeControlEfficacy
} from './stormRsk.js';
import { computeLossExpectancies } from './lossExpectancy.js';
import { legacyAsrScenarios } from './fixtures/legacyAsrScenarios.js';

describe('stormRsk legacy-shaped characterization scenarios', () => {
  it('baseline TAR-like scenario matches current transform outputs', () => {
    const scenario = legacyAsrScenarios.baselineTarLike;

    const A = computeAssetValueA(scenario.asset).value;
    const threat = computeThreatT(scenario.threat);
    const V = computeVulnerabilityV(scenario.vulnerability).value;
    const controlEffectives = scenario.controls.map((control) => computeControlEffective(control));
    const C = computeControlEfficacy(controlEffectives);

    const result = computeLossExpectancies({
      assetValue: A,
      threatProbability: threat.probability,
      vulnerabilitySeverity: V,
      controlEfficacy: 0,
      controlEffectives
    });

    expect(A).toBeCloseTo(0.2647008138, 6);
    expect(threat.probability).toBeCloseTo(0.5333333333, 6);
    expect(V).toBeCloseTo(0.4091710758, 6);
    expect(C).toBeCloseTo(0.40625, 6);

    expect(result.SLE).toBeCloseTo(0.0643078256, 6);
    expect(result.DLE).toBeCloseTo(0.0342975070, 6);
  });

  it('no-controls high-risk scenario keeps C at 0 and preserves ordering DLE <= SLE', () => {
    const scenario = legacyAsrScenarios.noControlsHighRisk;

    const A = computeAssetValueA(scenario.asset).value;
    const threat = computeThreatT(scenario.threat);
    const V = computeVulnerabilityV(scenario.vulnerability).value;

    const result = computeLossExpectancies({
      assetValue: A,
      threatProbability: threat.probability,
      vulnerabilitySeverity: V,
      controlEfficacy: 0,
      controlEffectives: []
    });

    expect(result.C).toBe(0);
    expect(result.SLE).toBeGreaterThan(0);
    expect(result.DLE).toBeGreaterThan(0);
    expect(result.DLE).toBeLessThanOrEqual(result.SLE);
  });
});
