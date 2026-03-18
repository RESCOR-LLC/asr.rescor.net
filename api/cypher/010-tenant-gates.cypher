// ════════════════════════════════════════════════════════════════════
// 010 — Tenant-scoped gate + compliance config indexes + migration
// ════════════════════════════════════════════════════════════════════
// Adds tenantId to GateQuestion and ComplianceTagConfig nodes so each
// tenant can have isolated gate sets and compliance chip actions.
//
// Safe to re-run (IF NOT EXISTS / WHERE IS NULL guards).
// ════════════════════════════════════════════════════════════════════

CREATE INDEX gate_tenant_idx IF NOT EXISTS
  FOR (g:GateQuestion) ON (g.tenantId);

CREATE INDEX compliance_tag_tenant_idx IF NOT EXISTS
  FOR (c:ComplianceTagConfig) ON (c.tenantId);

// Migration: stamp all existing GateQuestion nodes with the demo tenant
MATCH (g:GateQuestion)
WHERE g.tenantId IS NULL
SET g.tenantId = 'demo';

// Migration: stamp all existing ComplianceTagConfig nodes with the demo tenant
MATCH (c:ComplianceTagConfig)
WHERE c.tenantId IS NULL
SET c.tenantId = 'demo';
