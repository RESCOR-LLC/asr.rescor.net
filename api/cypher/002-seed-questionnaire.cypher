// ════════════════════════════════════════════════════════════════════
// ASR Neo4j Schema — Scoring Scaffolding
// ════════════════════════════════════════════════════════════════════
// Seeds the scoring framework nodes that are product constants.
// MERGE ensures idempotency — safe to re-run.
//
// Domain, Question, and Classification/Deployment content is NOT
// seeded here.  That content comes from the client YAML via:
//   ASR_QUESTIONNAIRE_YAML=path/to/yaml npm run cypher:configure -w api
//
// Tuning dials (all admin-adjustable, zero code deployment):
//   1. ClassificationChoice.factor   — global multiplier per review
//   2. WeightTier.value              — per-tier weight across questions
//   3. Question.choiceScores         — per-question score override
//   4. ScoringConfig.*               — damping, thresholds, labels
// ════════════════════════════════════════════════════════════════════

// ─── Scoring Configuration ───────────────────────────────────────

MERGE (config:ScoringConfig {configId: 'default'})
  SET config.dampingFactor    = 4,
      config.rawMax           = 134,
      config.ratingThresholds = [25, 50, 75],
      config.ratingLabels     = ['Low', 'Moderate', 'Elevated', 'Critical'],
      config.updated          = datetime();

// ─── Weight Tiers ────────────────────────────────────────────────

MERGE (critical:WeightTier {name: 'Critical'})
  SET critical.value = 100, critical.updated = datetime();

MERGE (high:WeightTier {name: 'High'})
  SET high.value = 67, high.updated = datetime();

MERGE (medium:WeightTier {name: 'Medium'})
  SET medium.value = 33, medium.updated = datetime();

MERGE (info:WeightTier {name: 'Info'})
  SET info.value = 13, info.updated = datetime();

// ─── Score Scale Templates (defaults for seeding new questions) ──

MERGE (scales:ScoreScale {scaleId: 'default'})
  SET scales.threeChoice  = [20, 50, 70],
      scales.fourChoice   = [20, 40, 60, 80],
      scales.fiveChoice   = [15, 35, 50, 70, 85],
      scales.naScore      = 1,
      scales.updated      = datetime();
