// ════════════════════════════════════════════════════════════════════
// YAML Validation — extracted from configureFromYaml.mjs for testability
// ════════════════════════════════════════════════════════════════════

export const VALID_RISK_LEVELS = new Set(['L', 'G', 'M', 'E', 'H']);
export const VALID_WEIGHT_TIERS = new Set(['Critical', 'High', 'Medium', 'Info']);

export function validateYaml(data) {
  const errors = [];

  if (!Array.isArray(data.domains) || data.domains.length === 0) {
    errors.push('YAML must have a non-empty "domains" array.');
  }

  const validArchetypes = new Set(Object.keys(data.deployment_archetypes || {}));

  // Validate source x environment archetype structure
  for (const [code, meta] of Object.entries(data.deployment_archetypes || {})) {
    if (!meta.source || !meta.environment) {
      errors.push(`Archetype "${code}": must have "source" and "environment" properties.`);
    }
  }

  if (!data.source_question || !Array.isArray(data.source_question.choices)) {
    errors.push('YAML must have a "source_question" with a "choices" array.');
  }
  if (!data.environment_question || !Array.isArray(data.environment_question.choices)) {
    errors.push('YAML must have an "environment_question" with a "choices" array.');
  }

  for (let domainIndex = 0; domainIndex < (data.domains || []).length; domainIndex++) {
    const domain = data.domains[domainIndex];
    const domainLabel = `Domain ${domainIndex} (${domain.name || 'unnamed'})`;

    if (!domain.name) {
      errors.push(`${domainLabel}: missing "name".`);
    }

    if (!Array.isArray(domain.questions) || domain.questions.length === 0) {
      errors.push(`${domainLabel}: must have at least one question.`);
      continue;
    }

    for (let questionIndex = 0; questionIndex < domain.questions.length; questionIndex++) {
      const question = domain.questions[questionIndex];
      const questionLabel = `D${domainIndex} Q${questionIndex}`;

      if (!question.text) {
        errors.push(`${questionLabel}: missing "text".`);
      }

      if (!VALID_WEIGHT_TIERS.has(question.weight)) {
        errors.push(`${questionLabel}: invalid weight "${question.weight}". Must be one of: ${[...VALID_WEIGHT_TIERS].join(', ')}`);
      }

      if (!Array.isArray(question.choices) || question.choices.length < 2) {
        errors.push(`${questionLabel}: must have at least 2 choices.`);
        continue;
      }

      for (let choiceIndex = 0; choiceIndex < question.choices.length; choiceIndex++) {
        const choice = question.choices[choiceIndex];
        if (!choice.text) {
          errors.push(`${questionLabel} choice ${choiceIndex}: missing "text".`);
        }
        if (!VALID_RISK_LEVELS.has(choice.risk)) {
          errors.push(`${questionLabel} choice ${choiceIndex}: invalid risk "${choice.risk}".`);
        }
      }

      const applicability = question.applicability || [];
      for (const code of applicability) {
        if (validArchetypes.size > 0 && !validArchetypes.has(code)) {
          errors.push(`${questionLabel}: unknown archetype code "${code}". Valid: ${[...validArchetypes].join(', ')}`);
        }
      }
    }
  }

  return errors;
}

export function deriveChoiceScores(choices, scoreScales) {
  const choiceCount = choices.length;
  const scale = scoreScales[choiceCount];

  if (!scale) {
    // Fallback: linear interpolation for unusual choice counts
    const result = choices.map((_, index) =>
      Math.round(15 + (index / (choiceCount - 1)) * 70)
    );
    return result;
  }

  const result = choices.map((choice) => scale[choice.risk] || 50);
  return result;
}
