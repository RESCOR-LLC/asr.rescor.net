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

// Migration: stamp all existing GateQuestion nodes with the RESCOR tenant
MATCH (g:GateQuestion)
WHERE g.tenantId IS NULL
SET g.tenantId = '319d0c76-9d6c-4f59-b427-299fc75b1e62';

// Migration: stamp all existing ComplianceTagConfig nodes with the RESCOR tenant
MATCH (c:ComplianceTagConfig)
WHERE c.tenantId IS NULL
SET c.tenantId = '319d0c76-9d6c-4f59-b427-299fc75b1e62';
