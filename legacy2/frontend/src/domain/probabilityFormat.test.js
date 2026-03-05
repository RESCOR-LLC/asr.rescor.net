import { describe, expect, it } from 'vitest';
import {
  formatProbabilityAsPercent,
  parsePercentListInput,
  percentInputToNormalizedProbability,
  probabilityToPercentInput
} from './probabilityFormat.js';

describe('probabilityFormat', () => {
  it('formats probability as two-decimal percentage', () => {
    expect(formatProbabilityAsPercent(0.12345)).toBe('12.35%');
  });

  it('renders percent input from probability with two decimals', () => {
    expect(probabilityToPercentInput(0.4)).toBe('40.00');
  });

  it('normalizes percent input to clamped probability in 0..1', () => {
    expect(percentInputToNormalizedProbability('125')).toBe(1);
    expect(percentInputToNormalizedProbability('-5')).toBe(0);
    expect(percentInputToNormalizedProbability('12.34')).toBe(0.1234);
  });

  it('parses percent list input to normalized probabilities', () => {
    expect(parsePercentListInput('30, 20.25, -2, x')).toEqual([0.3, 0.2025]);
  });
});
