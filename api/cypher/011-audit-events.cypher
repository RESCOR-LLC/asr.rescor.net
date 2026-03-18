// ════════════════════════════════════════════════════════════════════
// 011 — AuditEvent constraints and indexes
// ════════════════════════════════════════════════════════════════════
// Data-mutation audit trail — review lifecycle, answer changes,
// role assignments, and questionnaire publish events.
//
// Safe to re-run (IF NOT EXISTS).
// ════════════════════════════════════════════════════════════════════

CREATE CONSTRAINT audit_event_id IF NOT EXISTS
  FOR (a:AuditEvent) REQUIRE a.eventId IS UNIQUE;

CREATE INDEX audit_event_tenant_idx IF NOT EXISTS
  FOR (a:AuditEvent) ON (a.tenantId);

CREATE INDEX audit_event_action_idx IF NOT EXISTS
  FOR (a:AuditEvent) ON (a.action);

CREATE INDEX audit_event_ts_idx IF NOT EXISTS
  FOR (a:AuditEvent) ON (a.timestamp);
