export function formatProbabilityAsPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 'n/a';
  }

  return `${(numeric * 100).toFixed(2)}%`;
}

export function probabilityToPercentInput(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }

  return (numeric * 100).toFixed(2);
}

export function percentInputToProbability(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return NaN;
  }

  return numeric / 100;
}

export function percentInputToNormalizedProbability(value) {
  const parsed = percentInputToProbability(value);
  if (!Number.isFinite(parsed)) {
    return NaN;
  }

  const clamped = Math.min(1, Math.max(0, parsed));
  return Math.round(clamped * 10000) / 10000;
}

export function parsePercentListInput(value) {
  return String(value)
    .split(',')
    .map((item) => percentInputToNormalizedProbability(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}
