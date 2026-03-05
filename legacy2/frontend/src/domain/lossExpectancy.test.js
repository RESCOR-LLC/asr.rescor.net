import { describe, it, expect } from 'vitest';
import { computeLossExpectancies } from './lossExpectancy.js';

describe('loss expectancy calculations', () => {
  it('computes SLE and DLE with explicit control efficacy', () => {
    const result = computeLossExpectancies({
      assetValue: 100,
      threatProbability: 0.2,
      vulnerabilitySeverity: 0.5,
      controlEfficacy: 0.25
    });

    expect(result.SLE).toBeCloseTo(37.5, 6);
    expect(result.DLE).toBeCloseTo(7.5, 6);
  });

  it('derives control efficacy from control effectives when provided', () => {
    const result = computeLossExpectancies({
      assetValue: 100,
      threatProbability: 0.2,
      vulnerabilitySeverity: 0.5,
      controlEfficacy: 0.9,
      controlEffectives: [0.3, 0.2]
    });

    expect(result.C).toBeCloseTo(0.35, 6);
    expect(result.SLE).toBeCloseTo(32.5, 6);
    expect(result.DLE).toBeCloseTo(6.5, 6);
  });
});
