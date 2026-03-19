# Multi-Tenant Security Gap Analysis

**Date**: 2026-03-16
**Last reviewed**: 2026-03-19 (post Steps 1–10 implementation)
**Baseline**: [OWASP Multi-Tenant Application Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)
**Additional references**: OWASP Cloud Tenant Isolation Project, OWASP ASVS, Neo4j Security Checklist

## Scope

This document evaluates the ASR platform (asr.rescor.net) against the OWASP
Multi-Tenant Security Cheat Sheet's 8 best-practice areas and the Neo4j-specific
security guidance.  Each area is rated:

| Rating | Meaning |
|--------|---------|
| **MET** | Requirement fully satisfied |
| **PARTIAL** | Some aspects addressed, gaps remain |
| **GAP** | Not yet implemented |
| **N/A** | Not applicable to current architecture |

---

## 1. Tenant Identification & Context Management

**OWASP requirement**: Establish tenant context early in the request lifecycle;
use cryptographically secure, non-guessable tenant identifiers; never trust
client-supplied tenant IDs; bind tenant context to the authenticated session;
propagate tenant context securely through all application layers.

| Control | Rating | Evidence / Gap |
|---------|--------|----------------|
| Tenant context from authenticated token | **MET** | `authenticate.mjs` extracts `tid` from Entra ID JWT `payload.tid` — never from client headers or query params |
| Non-guessable tenant identifiers | **MET** | Tenant IDs are Entra ID directory GUIDs (UUIDv4) — not sequential |
| Client-supplied tenant ID rejected | **MET** | `tid` is extracted server-side from JWT; no API accepts `tenantId` in request body for scoping |
| Tenant context bound to session | **MET** | `request.user.tenantId` set in auth middleware, available to all route handlers |
| Tenant context propagated to all layers | **MET** | Reviews use `SCOPED_TO` relationship. Steps 5 + 6: ScoringConfig, QuestionnaireSnapshot, QuestionnaireDraft, GateQuestion, ComplianceTagConfig all tenant-scoped; scoring config uses per-tenant `Map` cache keyed by `tenantId` |
| Multi-tenant issuer validation | **MET** | `authenticate.mjs` validates issuer format (`/^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]+)\/v2\.0$/`) and checks against `allowedTenants` whitelist |

**Gaps**:
- ~~Questionnaire, scoring, gates, and compliance config lack tenant context propagation~~ ✅ resolved (Steps 5 + 6)
- No middleware that automatically injects `tenantId` into every database query (defence-in-depth) — low-priority; application-layer scoping is consistent

**Remediation**: ~~Phase 2 (tenant-scoped questionnaire/scoring)~~ ✅ implemented + query-level middleware deferred (Group E)

---

## 2. Database Isolation Strategies

**OWASP requirement**: Choose an isolation strategy based on security
requirements and compliance needs — separate databases (highest), separate
schemas (high), shared tables with row-level security (medium), or hybrid.

| Control | Rating | Evidence / Gap |
|---------|--------|----------------|
| Isolation model selected | **MET** | Architecture plan defines two deployment modes: shared-graph (multi-tenant) and database-per-tenant (single-tenant) — see [PLAN-FULL-MULTITENANCY-USERLOG.md](PLAN-FULL-MULTITENANCY-USERLOG.md) |
| Relationship-based isolation (Reviews) | **MET** | `Review-[:SCOPED_TO]->Tenant` enforced in `reviews.mjs`; non-admin queries filter by tenant |
| Relationship-based isolation (global data) | **MET** | ~~ScoringConfig, QuestionnaireSnapshot, QuestionnaireDraft, GateQuestion, ComplianceTagConfig are **not** linked to a Tenant node~~ All stamped with `tenantId`; indexes + tenant-filter WHERE clauses in all queries (Steps 5 + 6) |
| Database-per-tenant option | **PARTIAL** | Designed in Phase 6 of the plan; not yet implemented. `SessionPerQueryWrapper` provides the abstraction boundary |
| Neo4j row-level security | **N/A** | Neo4j Community Edition does not support RLS or RBAC at the database level; isolation is application-enforced |
| Defence-in-depth: query filter middleware | **GAP** | No middleware automatically injects tenant filter into every Cypher query |

**Gaps**:
- ~~Global config entities readable by all tenants~~ ✅ resolved (Steps 5 + 6)
- No automated Cypher query interception to enforce tenant scope — deferred (Group E)
- Single-tenant deployment mode not yet wired — deferred (Group E)

**Remediation**: ~~Phase 2–3 (OWNED_BY relationships)~~ ✅ implemented. Phase 6 (deployment-mode wiring) + `TenantScopedDatabase` wrapper deferred (Group E)

---

## 3. Preventing Cross-Tenant Data Access (IDOR Prevention)

**OWASP requirement**: Always validate that requested resources belong to
the current tenant; use composite keys; implement authorization at the data
access layer, not just the API layer; avoid exposing sequential/guessable IDs.

| Control | Rating | Evidence / Gap |
|---------|--------|----------------|
| Non-guessable resource IDs | **MET** | Reviews use `randomUUID()` for `reviewId`; all node IDs are UUIDs |
| Tenant-scoped review access | **MET** | `reviews.mjs` GET list: admin sees all, non-admin filtered by `SCOPED_TO` tenant |
| Tenant-scoped single review access | **MET** | `verifyReviewTenant()` in `ReviewStore.mjs` called at entry of every single-review handler; returns `null` for both not-found and wrong-tenant (404, not 403) — enumeration oracle prevention (Step 1) |
| Answers/remediation tenant check | **MET** | `verifyReviewTenant()` applied to answers, remediation, proposed-changes, auditor-comments, and gates sub-routes (Step 1c) |
| Questionnaire admin IDOR | **MET** | All draft/snapshot CRUD operations tenant-scoped by `tenantId` match on MATCH clause (Step 5d) |
| Admin user management IDOR | **MET** | Admin routes gated by `authorize('admin')` — only admins can manage users |

**Gaps**:
- ~~Direct review access by UUID not tenant-validated~~ ✅ resolved (Step 1 — `verifyReviewTenant()`)
- ~~Answer/remediation/proposed-change routes inherit review scope but lack explicit tenant guard~~ ✅ resolved (Step 1c)
- ~~Questionnaire admin operations are not tenant-scoped~~ ✅ resolved (Step 5d)

**Remediation**:
- ✅ `verifyReviewTenant()` in `ReviewStore.mjs` — all review sub-routes protected
- ✅ Questionnaire admin tenant-scoped (Step 5d)
- `GET /admin/users` still returns all users to non-superadmin admins — outstanding (see recommendations)

---

## 4. Cache & Session Isolation

**OWASP requirement**: Prefix cache keys with tenant identifier; use separate
cache namespaces; implement cache key validation; set appropriate TTLs.

| Control | Rating | Evidence / Gap |
|---------|--------|----------------|
| Server-side caching | **N/A** | ASR does not use an application-level cache (Redis, Memcached) — all reads go to Neo4j |
| MSAL token cache | **MET** | MSAL v4 manages per-account token cache client-side; tenant context embedded in access token |
| Session isolation | **MET** | Stateless API — no server-side sessions; tenant context derived from JWT on every request |

**Gaps**: ~~If caching is introduced (e.g., questionnaire config cache), it must be keyed by `tenantId`~~ — scoring config cache introduced in Step 5 and correctly implemented as `Map<tenantId|'global', config>`. No unkeyed caches.

---

## 5. API Security & Rate Limiting

**OWASP requirement**: Per-tenant rate limiting and quotas; tenant-specific
throttling; validate tenant context on every API request; separate API keys
per tenant; tenant-aware request signing for B2B APIs.

| Control | Rating | Evidence / Gap |
|---------|--------|----------------|
| Tenant context validation per request | **MET** | Auth middleware runs on all `/api/*` routes (except health) |
| Per-tenant rate limiting | **MET** | `express-rate-limit` — authLimiter (20 req/15 min per IP on `/api/auth/*`), apiLimiter (300 req/min keyed by `tenantId \|\| ip`) — Step 2 |
| API key per tenant | **N/A** | Uses Entra ID OAuth2 tokens, not API keys |
| Tenant-aware throttling | **MET** | apiLimiter keys by `req.user?.tenantId \|\| req.ip` — per-tenant throttle bucket (Step 2) |
| CORS configuration | **MET** | `server.corsAllowedOrigins` read from Infisical at startup; absent in dev = open, comma-separated allowlist in prod (Step 4) |

**Gaps**:
- ~~No rate limiting (DoS/noisy-neighbor vulnerability)~~ ✅ resolved (Step 2)
- ~~CORS allows all origins~~ ✅ resolved (Step 4 — Infisical-managed per deployment)

**Remediation**:
- ✅ `express-rate-limit` with per-tenant key derivation (Step 2)
- ✅ CORS origin allowlist via Infisical `server.corsAllowedOrigins` (Step 4)
- Per-tenant quota enforcement at API Gateway level — future / Group E

---

## 6. File Storage & Blob Isolation

**OWASP requirement**: Tenant-prefixed paths; storage access policies per
tenant; tenant ownership validation; signed URLs with tenant context; encryption
at rest with tenant-specific keys.

| Control | Rating | Evidence / Gap |
|---------|--------|----------------|
| File storage | **N/A** | ASR does not store tenant-uploaded files. Document export (DOCX) is generated on-the-fly from review data without server-side file persistence |

**Gaps**: None currently. If document storage or evidence uploads are added, tenant prefixing and ownership validation will be required.

---

## 7. Tenant Onboarding & Offboarding Security

**OWASP requirement**: Secure provisioning with isolated resources; unique
encryption keys per tenant; complete data deletion on offboarding; audit trail
of provisioning/deprovisioning; data export for portability.

| Control | Rating | Evidence / Gap |
|---------|--------|----------------|
| Tenant provisioning | **MET** | `TenantStore.createTenant()` + `GET/POST /api/admin/tenants` endpoints; `005-seed-tenants.cypher` seeds demo tenant (Step 8) |
| Resource isolation on provisioning | **MET** | `createTenant()` clones ScoringConfig from default and current QuestionnaireSnapshot for each new tenant (Step 8) |
| Tenant offboarding / data deletion | **GAP** | Soft-delete (`deactivateTenant`) implemented; hard purge (`purgeTenant`) is a stub — no full data-deletion workflow |
| Data export for portability | **PARTIAL** | Review export (DOCX, XLSX) exists; no tenant-wide data export |
| Audit trail of provisioning | **MET** | `tenant.create` / `tenant.delete` fired to `AuditEventStore` on each mutation (Step 7d + Step 8) |

**Gaps**:
- ~~No automated provisioning that creates tenant-specific config~~ ✅ resolved (Step 8)
- Offboarding: soft-delete done; hard purge + tenant-wide export deferred (Group E)
- ~~No tenant lifecycle audit trail~~ ✅ resolved (Step 7 + Step 8)

**Remediation**: ✅ Provisioning API + isolated config cloning (Step 8). Full offboarding workflow deferred (Group E)

---

## 8. Logging, Monitoring & Audit

**OWASP requirement**: Include tenant context in all log entries; implement
tenant-isolated audit trails; monitor for cross-tenant access attempts; set
up alerts for tenant isolation violations; ensure compliance with
tenant-specific retention policies.

| Control | Rating | Evidence / Gap |
|---------|--------|----------------|
| Auth event logging | **MET** | Phase 1 (just implemented): `AuthEvent` nodes with timestamp, IP, user-agent, host, outcome, reason, linked to User via `HAS_AUTH_EVENT` |
| Tenant context in auth events | **MET** | `tenantId` stored directly on every `AuthEvent` node; tenant index on `auth_event_tenant_idx`; all admin auth-event endpoints scoped to requesting admin's tenant (Step 3) |
| Application audit trail | **MET** | `AuditEventStore.logEvent()` fire-and-forget on: review.create, review.delete, answer.update, role.change, questionnaire.publish, tenant.create, tenant.delete; `GET /api/admin/audit-events` with tenant-scoped pagination (Step 7) |
| Cross-tenant access attempt detection | **GAP** | `verifyReviewTenant()` null hits currently produce a silent 404 — no audit event fired; recommended next step |
| Tenant-specific retention policies | **PARTIAL** | AuthEvent: 90-day APOC TTL stamped at creation + back-filled on existing nodes (Step 9). AuditEvent: no TTL yet |
| Alerting on isolation violations | **GAP** | No alerting system — deferred (Group E) |

**Gaps**:
- ~~Auth events don't include `tenantId` directly~~ ✅ resolved (Step 3)
- ~~No data-mutation audit trail~~ ✅ resolved (Step 7)
- Cross-tenant access attempt detection: `verifyReviewTenant()` null hits not logged — immediate next step
- ~~No retention policies~~ PARTIAL: AuthEvent TTL done (Step 9); AuditEvent TTL outstanding

**Remediation**:
- ✅ `tenantId` on AuthEvent nodes (Step 3)
- ✅ `AuditEventStore` + wired to all mutation routes (Step 7)
- Cross-tenant attempt logging: log `verifyReviewTenant()` null hits as `review.cross_tenant_attempt` — next step
- ✅ APOC TTL 90-day auto-purge on AuthEvent (Step 9); AuditEvent TTL deferred

---

## Neo4j-Specific Security Assessment

| Control | Rating | Evidence / Gap |
|---------|--------|----------------|
| Encryption at rest | **GAP** | Dev Neo4j container uses default storage — no dm-crypt/Bitlocker |
| Encryption in transit (TLS/SSL) | **MET** | Production: `bolt+s://thorium.rescor.net:7687` configured via Infisical `NEO4J_URI` (Step 10). Dev remains `bolt://` — intentional |
| Authentication | **MET** | Neo4j auth enabled (neo4j/asrdev123 in dev; Infisical-managed in prod) |
| Authorization (Neo4j RBAC) | **N/A** | Community Edition — single user, no database-level RBAC |
| Port security | **MET** | Neo4j ports (17474, 17687) bound to localhost via Docker compose |
| Parameterized queries | **MET** | All Cypher queries use `$param` syntax — no string interpolation |
| APOC whitelisting | **MET** | `NEO4J_dbms_security_procedures_unrestricted: "apoc.ttl.*"` configured in docker-compose; only TTL procedures unrestricted (Step 10) |
| Backup isolation | **GAP** | No per-tenant backup strategy |
| Import directory segmentation | **N/A** | No bulk import operations; data seeded via Cypher scripts |

---

## Summary Matrix

| OWASP Area | Rating | Key Gaps |
|------------|--------|----------|
| 1. Tenant Identification | **MET** | ~~Config entities not tenant-propagated~~ ✅ Steps 5+6. Query-level middleware deferred (Group E) |
| 2. Database Isolation | **MET** | ~~Global config entities~~ ✅ Steps 5+6. Query-level defence-in-depth + single-tenant deployment mode deferred (Group E) |
| 3. IDOR Prevention | **MET** | ~~Direct review access lacks tenant check; questionnaire admin unscoped~~ ✅ Steps 1+5. `GET /admin/users` tenant scoping outstanding |
| 4. Cache Isolation | **MET/N/A** | No unkeyed caches; scoring config cache correctly keyed by `tenantId` |
| 5. API Rate Limiting | **MET** | ~~No rate limiting or throttling~~ ✅ Step 2. ~~CORS unrestricted~~ ✅ Step 4 |
| 6. File Storage | **N/A** | No tenant file storage |
| 7. Onboarding/Offboarding | **PARTIAL** | ~~No provisioning automation~~ ✅ Step 8. Hard purge + tenant-wide export deferred (Group E) |
| 8. Logging & Audit | **MET** | ~~No data-mutation audit trail~~ ✅ Step 7. Cross-tenant attempt detection + AuditEvent TTL outstanding |
| Neo4j Security | **PARTIAL** | ~~No TLS~~ ✅ Step 10. ~~APOC unwhitelisted~~ ✅ Step 10. EAR + backup isolation deferred (Group E) |

---

## Priority Remediation Roadmap

| Priority | Gap | Remediation | Status |
|----------|-----|-------------|--------|
| **Critical** | Direct review IDOR | `verifyReviewTenant()` on all review routes | ✅ Step 1 |
| **Critical** | No rate limiting | `express-rate-limit` with per-tenant key derivation | ✅ Step 2 |
| **High** | Global config entities | Tenant-scoped indexes + WHERE clauses on all config queries | ✅ Steps 5+6 |
| **High** | Questionnaire admin unscoped | Tenant-scope all draft/publish operations | ✅ Step 5d |
| **High** | No TLS on Neo4j | `bolt+s://` via Infisical production secret | ✅ Step 10 |
| **Medium** | No data-mutation audit | `AuditEventStore` + wired to all mutation routes | ✅ Step 7 |
| **Medium** | No tenant provisioning automation | `TenantStore` + `GET/POST/DELETE /api/admin/tenants` | ✅ Step 8 |
| **Medium** | `GET /admin/users` not tenant-scoped | Non-superadmin admins see all users — WHERE clause | **outstanding** |
| **Medium** | No cross-tenant access monitoring | Log `verifyReviewTenant()` null hits as audit events | **outstanding** |
| **Medium** | CORS unrestricted | `server.corsAllowedOrigins` from Infisical | ✅ Step 4 |
| **Low** | Auth event retention | APOC TTL 90-day auto-purge | ✅ Step 9 |
| **Low** | AuditEvent retention | APOC TTL on AuditEvent nodes | deferred |
| **Low** | No encryption at rest | dm-crypt/LUKS — value varies by deployment model (see MULTI-TENANT-GAP-PLAN.md Group E) | deferred |
| **Low** | No tenant offboarding | Hard purge + tenant-wide export workflow | deferred (Group E) |
| **Low** | APOC procedure scope | `NEO4J_dbms_security_procedures_unrestricted: "apoc.ttl.*"` | ✅ Step 10 |

---

## Related Documents

- [Multi-Tenancy + User Activity Log Plan](PLAN-FULL-MULTITENANCY-USERLOG.md) — 6-phase implementation roadmap
- [RBAC + Multi-Tenancy Plan](PLAN-RBAC-MULTITENANCY.md) — Role-based access control and tenant-scoped review isolation (completed)
- [ASR Project Patterns](PROJECT-PATTERNS.md) — Neo4j schema, scoring model, CLI commands
- [RESCOR Cross-Project Patterns](../../core.rescor.net/docs/PROJECT-PATTERNS.md) — Code style, secrets policy, configuration-first runtime

## References

- [OWASP Multi-Tenant Application Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)
- [OWASP Cloud Tenant Isolation Project](https://owasp.org/www-project-cloud-tenant-isolation/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [Neo4j Security Configuration](https://neo4j.com/docs/operations-manual/current/security/)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
