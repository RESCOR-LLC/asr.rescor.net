// ════════════════════════════════════════════════════════════════════
// 009 — Tenant-scoped config indexes + migration stamps
// ════════════════════════════════════════════════════════════════════
// Adds tenantId to ScoringConfig, QuestionnaireSnapshot, and
// QuestionnaireDraft nodes so each tenant has isolated scoring
// parameters and questionnaire history.
//
// Safe to re-run (IF NOT EXISTS / WHERE IS NULL guards).
// ════════════════════════════════════════════════════════════════════

CREATE INDEX scoring_config_tenant_idx IF NOT EXISTS
  FOR (s:ScoringConfig) ON (s.tenantId);

CREATE INDEX snapshot_tenant_idx IF NOT EXISTS
  FOR (s:QuestionnaireSnapshot) ON (s.tenantId);

CREATE INDEX draft_tenant_idx IF NOT EXISTS
  FOR (d:QuestionnaireDraft) ON (d.tenantId);

// Migration: stamp the global ScoringConfig with the demo tenant
MATCH (sc:ScoringConfig {configId: 'default'})
WHERE sc.tenantId IS NULL
SET sc.tenantId = 'demo';

// Migration: stamp all existing snapshots with the demo tenant
MATCH (snap:QuestionnaireSnapshot)
WHERE snap.tenantId IS NULL
SET snap.tenantId = 'demo';

// Migration: stamp all existing drafts with the demo tenant
MATCH (d:QuestionnaireDraft)
WHERE d.tenantId IS NULL
SET d.tenantId = 'demo';
