// ════════════════════════════════════════════════════════════════════
// Unit Tests — Frontend RSK Scoring Engine
// ════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  rskAggregate,
  mitigationAggregate,
  rskNormalize,
  questionMeasurement,
  ratingFromNormalized,
  computeScore,
} from './scoring';
import type { ScoringConfiguration } from './scoring';

// ── rskAggregate ─────────────────────────────────────────────────

describe('rskAggregate', () => {
  it('returns 0 for empty measurements', () => {
    expect(rskAggregate([])).toBe(0);
  });

  it('returns the single measurement for one item', () => {
    expect(rskAggregate([10])).toBe(10);
  });

  it('applies diminishing damping to sorted measurements', () => {
    // [20, 10] sorted desc → 20/4^0 + 10/4^1 = 20 + 2.5 = 22.5 → ceil = 23
    expect(rskAggregate([10, 20], 4)).toBe(23);
  });

  it('filters out non-positive values', () => {
    expect(rskAggregate([0, -5, 10], 4)).toBe(10);
  });

  it('uses default damping factor when omitted', () => {
    expect(rskAggregate([10])).toBe(10);
  });
});

// ── mitigationAggregate ──────────────────────────────────────────

describe('mitigationAggregate', () => {
  it('returns 0 for empty mitigations', () => {
    expect(mitigationAggregate([])).toBe(0);
  });

  it('applies diminishing damping like rskAggregate', () => {
    expect(mitigationAggregate([10, 20], 4)).toBe(23);
  });

  it('caps at 100', () => {
    expect(mitigationAggregate([200], 1)).toBe(100);
  });

  it('caps sum at 100 even with many items and damping=1', () => {
    expect(mitigationAggregate([50, 50, 50], 1)).toBe(100);
  });
});

// ── rskNormalize ─────────────────────────────────────────────────

describe('rskNormalize', () => {
  it('returns 0 for raw score of 0', () => {
    expect(rskNormalize(0)).toBe(0);
  });

  it('scales raw to percentage of rawMax', () => {
    expect(rskNormalize(67, 134)).toBe(50);
  });

  it('caps at 100', () => {
    expect(rskNormalize(200, 134)).toBe(100);
  });

  it('rounds to one decimal place', () => {
    expect(rskNormalize(50, 134)).toBe(37.3);
  });
});

// ── questionMeasurement ──────────────────────────────────────────

describe('questionMeasurement', () => {
  it('returns 0 when any factor is 0', () => {
    expect(questionMeasurement(0, 50, 1.0)).toBe(0);
    expect(questionMeasurement(75, 0, 1.0)).toBe(0);
    expect(questionMeasurement(75, 50, 0)).toBe(0);
  });

  it('computes floor of (rawScore/100) * (weightValue/100) * factor', () => {
    expect(questionMeasurement(100, 100, 1.0)).toBe(1);
    expect(questionMeasurement(100, 100, 100)).toBe(100);
  });
});

// ── ratingFromNormalized ─────────────────────────────────────────

describe('ratingFromNormalized', () => {
  it('returns Low for 0', () => {
    expect(ratingFromNormalized(0)).toBe('Low');
  });

  it('returns Moderate for 26', () => {
    expect(ratingFromNormalized(26)).toBe('Moderate');
  });

  it('returns Elevated for 51', () => {
    expect(ratingFromNormalized(51)).toBe('Elevated');
  });

  it('returns Critical for 76', () => {
    expect(ratingFromNormalized(76)).toBe('Critical');
  });

  it('uses default thresholds and labels', () => {
    expect(ratingFromNormalized(25)).toBe('Low');
  });
});

// ── computeScore ─────────────────────────────────────────────────

describe('computeScore', () => {
  const configuration: ScoringConfiguration = {
    dampingFactor: 4,
    rawMax: 134,
    ratingThresholds: [25, 50, 75],
    ratingLabels: ['Low', 'Moderate', 'Elevated', 'Critical'],
  };

  it('returns zero score for empty measurements', () => {
    const result = computeScore([], configuration);
    expect(result.raw).toBe(0);
    expect(result.normalized).toBe(0);
    expect(result.rating).toBe('Low');
  });

  it('returns a complete scored result', () => {
    const result = computeScore([20, 15, 10], configuration);
    expect(result.raw).toBeGreaterThan(0);
    expect(result.normalized).toBeGreaterThan(0);
    expect(typeof result.rating).toBe('string');
  });

  it('uses default configuration when omitted', () => {
    const result = computeScore([]);
    expect(result.rating).toBe('Low');
  });
});
