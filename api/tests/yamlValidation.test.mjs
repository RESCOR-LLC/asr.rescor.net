import { describe, it, expect } from 'vitest';
import { validateYaml, deriveChoiceScores, VALID_RISK_LEVELS, VALID_WEIGHT_TIERS } from '../src/yamlValidation.mjs';

// ────────────────────────────────────────────────────────────────────
// Helpers — minimal valid YAML structures
// ────────────────────────────────────────────────────────────────────

function makeValidChoice(overrides = {}) {
  return { text: 'Some choice', risk: 'L', ...overrides };
}

function makeValidQuestion(overrides = {}) {
  return {
    text: 'Is your data encrypted at rest?',
    weight: 'High',
    choices: [
      makeValidChoice({ text: 'Yes', risk: 'L' }),
      makeValidChoice({ text: 'No', risk: 'H' }),
    ],
    ...overrides,
  };
}

function makeValidDomain(overrides = {}) {
  return {
    name: 'Data Protection',
    questions: [makeValidQuestion()],
    ...overrides,
  };
}

function makeValidData(overrides = {}) {
  return {
    domains: [makeValidDomain()],
    source_question: { text: 'Source?', choices: [{ text: 'A', source: 'a' }] },
    environment_question: { text: 'Env?', choices: [{ text: 'B', environment: 'b' }] },
    deployment_archetypes: {
      SH: { label: 'Self-Hosted', source: 'self', environment: 'on-prem' },
    },
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────
// validateYaml
// ────────────────────────────────────────────────────────────────────

describe('validateYaml', () => {
  it('returns empty errors for valid complete YAML', () => {
    const errors = validateYaml(makeValidData());
    expect(errors).toEqual([]);
  });

  it('returns error when domains is missing', () => {
    const data = makeValidData();
    delete data.domains;
    const errors = validateYaml(data);
    expect(errors).toContainEqual(expect.stringContaining('non-empty "domains" array'));
  });

  it('returns error when domains is an empty array', () => {
    const errors = validateYaml(makeValidData({ domains: [] }));
    expect(errors).toContainEqual(expect.stringContaining('non-empty "domains" array'));
  });

  it('returns error when a domain has no name', () => {
    const errors = validateYaml(makeValidData({
      domains: [makeValidDomain({ name: '' })],
    }));
    expect(errors).toContainEqual(expect.stringContaining('missing "name"'));
  });

  it('returns error when a domain has no questions', () => {
    const errors = validateYaml(makeValidData({
      domains: [makeValidDomain({ questions: [] })],
    }));
    expect(errors).toContainEqual(expect.stringContaining('at least one question'));
  });

  it('returns error when a question has no text', () => {
    const errors = validateYaml(makeValidData({
      domains: [makeValidDomain({
        questions: [makeValidQuestion({ text: '' })],
      })],
    }));
    expect(errors).toContainEqual(expect.stringContaining('missing "text"'));
  });

  it('returns error for invalid weight tier', () => {
    const errors = validateYaml(makeValidData({
      domains: [makeValidDomain({
        questions: [makeValidQuestion({ weight: 'Ultra' })],
      })],
    }));
    expect(errors).toContainEqual(expect.stringContaining('invalid weight "Ultra"'));
  });

  it('returns error when a question has fewer than 2 choices', () => {
    const errors = validateYaml(makeValidData({
      domains: [makeValidDomain({
        questions: [makeValidQuestion({ choices: [makeValidChoice()] })],
      })],
    }));
    expect(errors).toContainEqual(expect.stringContaining('at least 2 choices'));
  });

  it('returns error when a choice has no text', () => {
    const errors = validateYaml(makeValidData({
      domains: [makeValidDomain({
        questions: [makeValidQuestion({
          choices: [
            makeValidChoice({ text: '' }),
            makeValidChoice({ text: 'Option B' }),
          ],
        })],
      })],
    }));
    expect(errors).toContainEqual(expect.stringContaining('missing "text"'));
  });

  it('returns error for invalid risk level on a choice', () => {
    const errors = validateYaml(makeValidData({
      domains: [makeValidDomain({
        questions: [makeValidQuestion({
          choices: [
            makeValidChoice({ risk: 'Z' }),
            makeValidChoice({ risk: 'L' }),
          ],
        })],
      })],
    }));
    expect(errors).toContainEqual(expect.stringContaining('invalid risk "Z"'));
  });

  it('returns error for unknown archetype code in applicability', () => {
    const errors = validateYaml(makeValidData({
      domains: [makeValidDomain({
        questions: [makeValidQuestion({ applicability: ['BOGUS'] })],
      })],
    }));
    expect(errors).toContainEqual(expect.stringContaining('unknown archetype code "BOGUS"'));
  });
});

// ────────────────────────────────────────────────────────────────────
// deriveChoiceScores
// ────────────────────────────────────────────────────────────────────

describe('deriveChoiceScores', () => {
  const standardScales = {
    4: { L: 15, G: 40, M: 60, H: 85 },
    5: { L: 10, G: 30, M: 50, E: 70, H: 90 },
  };

  it('returns scores from scale when choice count matches', () => {
    const choices = [
      { text: 'A', risk: 'L' },
      { text: 'B', risk: 'G' },
      { text: 'C', risk: 'M' },
      { text: 'D', risk: 'H' },
    ];
    const scores = deriveChoiceScores(choices, standardScales);
    expect(scores).toEqual([15, 40, 60, 85]);
  });

  it('handles standard 5-choice scale', () => {
    const choices = [
      { text: 'A', risk: 'L' },
      { text: 'B', risk: 'G' },
      { text: 'C', risk: 'M' },
      { text: 'D', risk: 'E' },
      { text: 'E', risk: 'H' },
    ];
    const scores = deriveChoiceScores(choices, standardScales);
    expect(scores).toEqual([10, 30, 50, 70, 90]);
  });

  it('falls back to linear interpolation for unusual choice counts', () => {
    const choices = [
      { text: 'A', risk: 'L' },
      { text: 'B', risk: 'H' },
      { text: 'C', risk: 'M' },
    ];
    // 3-choice not in standardScales => linear interpolation
    // index 0: round(15 + 0/2 * 70) = 15
    // index 1: round(15 + 1/2 * 70) = 50
    // index 2: round(15 + 2/2 * 70) = 85
    const scores = deriveChoiceScores(choices, standardScales);
    expect(scores).toEqual([15, 50, 85]);
  });

  it('returns default 50 for unknown risk level in scale', () => {
    const choices = [
      { text: 'A', risk: 'L' },
      { text: 'B', risk: 'X' }, // not in the scale map
      { text: 'C', risk: 'M' },
      { text: 'D', risk: 'H' },
    ];
    const scores = deriveChoiceScores(choices, standardScales);
    expect(scores).toEqual([15, 50, 60, 85]);
  });
});

// ────────────────────────────────────────────────────────────────────
// Exported constants
// ────────────────────────────────────────────────────────────────────

describe('exported constants', () => {
  it('VALID_RISK_LEVELS contains L, G, M, E, H', () => {
    expect([...VALID_RISK_LEVELS].sort()).toEqual(['E', 'G', 'H', 'L', 'M']);
  });

  it('VALID_WEIGHT_TIERS contains Critical, High, Medium, Info', () => {
    expect([...VALID_WEIGHT_TIERS].sort()).toEqual(['Critical', 'High', 'Info', 'Medium']);
  });
});
