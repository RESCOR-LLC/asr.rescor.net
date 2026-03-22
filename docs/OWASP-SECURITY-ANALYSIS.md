# OWASP Security Analysis — asr.rescor.net

**Date**: 2026-03-21
**Baseline**: OWASP Multi-Tenant Security Cheat Sheet + OWASP Top 10 (2021)
**Supersedes**: `MULTI-TENANT-GAP-ANALYSIS.md` (multi-tenant sections updated here)

## Scope

This document evaluates the application platform against:

1. **OWASP Multi-Tenant Security Cheat Sheet** — 8 best-practice areas, ~68 controls
2. **OWASP Top 10 (2021)** — 10 vulnerability categories (non-overlapping items added)

| Rating | Meaning |
|--------|---------|
| **MET** | Requirement fully satisfied |
| **PARTIAL** | Some aspects addressed, gaps remain |
| **GAP** | Not yet implemented |
| **N/A** | Not applicable to current architecture |

---

## Part 1 — OWASP Multi-Tenant Security Cheat Sheet

### MT-1. Tenant Identification & Context Management

| Control | Rating | Evidence |
|---------|--------|----------|
| 1.1 Tenant context from authenticated token | **MET** | `authenticate.mjs` extracts `tid` from Entra ID JWT; never from headers/query params |
| 1.2 Non-guessable tenant identifiers | **MET** | Tenant IDs are Entra ID directory GUIDs (UUIDv4) |
| 1.3 Client-supplied tenant ID rejected | **MET** | `tid` extracted server-side from JWT; no API accepts `tenantId` in request body for scoping |
| 1.4 Tenant context bound to session | **MET** | `request.user.tenantId` set in auth middleware, available to all handlers |
| 1.5 Tenant context propagated to all layers | **MET** | Reviews use `SCOPED_TO` relationship; ScoringConfig, QuestionnaireSnapshot, QuestionnaireDraft, GateQuestion, ComplianceTagConfig all tenant-scoped; per-tenant `Map` cache keyed by `tenantId` |
| 1.x Multi-tenant issuer validation | **MET** | `authenticate.mjs` validates issuer format regex + `allowedTenants` whitelist |

**Remaining gap**: No middleware that auto-injects `tenantId` into every Cypher query (defence-in-depth) — deferred, application-layer scoping is consistent.

---

### MT-2. Database Isolation Strategies

| Control | Rating | Evidence |
|---------|--------|----------|
| 2.1 Isolation model selected | **MET** | Shared-graph (multi-tenant) with designed database-per-tenant option |
| 2.2 Row-level tenant filtering | **MET** | All query MATCH/WHERE clauses include `tenantId` filter |
| 2.3 ORM/application-layer tenant enforcement | **MET** | `ReviewStore.verifyReviewTenant()` + tenant WHERE clauses in all stores |
| 2.4 Fail-closed on missing context | **MET** | `requireTenantContext` middleware rejects all requests without `tenantId` on tenant-scoped routes; blocks OFFBOARDING tenants |

**Remaining gaps**: Cypher query interception middleware (Group E); single-tenant deployment mode wiring (Group E).

---

### MT-3. Preventing Cross-Tenant Data Access (IDOR)

| Control | Rating | Evidence |
|---------|--------|----------|
| 3.1 Resource ownership validation | **MET** | `verifyReviewTenant()` on all review routes; 404 returned (not 403) to prevent enumeration |
| 3.2 Composite keys for lookups | **MET** | All queries filter by (`resourceId` + `tenantId`) |
| 3.3 Authorization at data access layer | **MET** | `ReviewStore`, `UserStore` enforce tenant scoping at persistence layer |
| 3.4 Non-guessable resource IDs | **MET** | All node IDs are `randomUUID()` |
| 3.5 Opaque error on missing resources | **MET** | 404 "not found" for both missing and wrong-tenant resources |

**Status**: Fully met.

---

### MT-4. Cache & Session Isolation

| Control | Rating | Evidence |
|---------|--------|----------|
| 4.1 Tenant-prefixed cache keys | **MET** | Scoring config cache keyed by `tenantId\|'global'` |
| 4.2 Separate namespaces for sensitive tenants | **N/A** | No Redis/Memcached — all reads go to Neo4j |
| 4.3 Cache key validation | **N/A** | No external cache |
| 4.4 Tenant verification on retrieval | **N/A** | No external cache |
| 4.5 Tenant cache invalidation | **N/A** | No external cache |
| Session isolation | **MET** | Stateless API — no server-side sessions; JWT per-request |

---

### MT-5. API Security & Rate Limiting

| Control | Rating | Evidence |
|---------|--------|----------|
| 5.1 Per-tenant rate limiting | **MET** | `apiLimiter`: 300 req/min keyed by `tenantId \|\| ip` |
| 5.2 Tenant-specific throttling | **MET** | Per-tenant throttle bucket via `apiLimiter` |
| 5.3 Tenant context validation per request | **MET** | Auth middleware runs on all `/api/*` except health |
| 5.4 Separate API keys per tenant | **MET** | Service accounts: `sa_` prefixed, SHA-256 hashed, per-tenant |
| 5.5 Tenant-aware request signing (B2B) | **N/A** | No B2B API signing currently needed |
| 5.6 Rate limit response headers | **MET** | `express-rate-limit` sends standard `RateLimit-*` headers |
| CORS configuration | **MET** | `server.corsAllowedOrigins` from Infisical; absent in dev = open |

---

### MT-6. File Storage & Blob Isolation

| Control | Rating | Evidence |
|---------|--------|----------|
| All controls | **N/A** | Application does not store tenant-uploaded files. Document exports generated on-the-fly |

---

### MT-7. Tenant Onboarding & Offboarding

| Control | Rating | Evidence |
|---------|--------|----------|
| 7.1 Secure provisioning | **MET** | `TenantStore.createTenant()` + `POST /api/admin/tenants` |
| 7.2 Unique keys per tenant | **N/A** | No per-tenant encryption keys (Neo4j Community, no TDE) |
| 7.3 Complete data deletion on offboarding | **MET** | `TenantStore.purgeTenant()` deletes all tenant-scoped data; `DELETE /api/admin/tenants/:id/purge?confirm=yes` |
| 7.4 Audit trail of provisioning | **MET** | `tenant.create` / `tenant.delete` fired to `AuditEventStore` |
| 7.5 Data export for portability | **PARTIAL** | Review export (DOCX/XLSX) exists; tenant-wide export via `/export` route; no full cross-entity export |
| 7.6 Prevent operations during offboarding | **MET** | `TenantStore.setOffboarding()` sets status=OFFBOARDING; `requireTenantContext` middleware blocks all tenant-scoped operations during offboarding |
| 7.7 Revoke access during offboarding | **MET** | `TokenDenylist.revokeUser(sub)` revokes all active sessions; `POST /api/admin/revoke-sessions/:sub` |
| 7.8 Data retention periods | **MET** | AuthEvent 90-day APOC TTL (`012-apoc-ttl.cypher`); AuditEvent 90-day APOC TTL (`014-audit-ttl.cypher`) |
| 7.9 Clean up failed provisioning | **MET** | `TenantStore.createTenant()` wraps steps 2–3 in try/catch with rollback that cleans up ScoringConfig, QuestionnaireSnapshot, and Tenant nodes |

---

### MT-8. Logging, Monitoring & Audit

| Control | Rating | Evidence |
|---------|--------|----------|
| 8.1 Tenant context in log entries | **MET** | `tenantId` on every AuthEvent and AuditEvent node |
| 8.2 Tenant-isolated audit trails | **MET** | `GET /admin/audit-events` scoped to requesting admin's tenant |
| 8.3 Cross-tenant access monitoring | **MET** | `verifyReviewTenant()` null hits logged as `review.cross_tenant_attempt` |
| 8.4 Alerts for isolation violations | **MET** | `SecurityMonitor` checks every 5 min for brute-force, cross-tenant denials, credential stuffing; Recorder event codes 9050–9054 |
| 8.5 Tenant-specific retention policies | **MET** | AuthEvent + AuditEvent both have 90-day APOC TTL |
| 8.6 Structured severity levels | **MET** | Recorder severity codes i/d/w/e/s/t; event codes 9000–9239 across all API modules |
| 8.7 Audit log access restricted | **MET** | Admin-only endpoints; tenant-scoped queries |

---

### Neo4j-Specific Controls

| Control | Rating | Evidence |
|---------|--------|----------|
| Encryption at rest | **PARTIAL** | LUKS operational guide published (`docs/ENCRYPTION-AT-REST.md`); not confirmed deployed on production host |
| Encryption in transit | **MET** | Production: `bolt+s://`; dev: `bolt://` (intentional) |
| Authentication | **MET** | Neo4j auth enabled; Infisical-managed in prod |
| Authorization (RBAC) | **N/A** | Community Edition — single user |
| Port security | **MET** | Ports bound to `127.0.0.1` in UAT/prod |
| Parameterized queries | **MET** | All 100+ Cypher queries use `$param` syntax |
| APOC whitelisting | **MET** | Only `apoc.ttl.*` unrestricted |
| Backup isolation | **PARTIAL** | Backup isolation strategy documented + per-tenant export endpoint exists; not yet automated |

---

## Part 2 — OWASP Top 10 (2021) — Non-Overlapping Controls

### A01: Broken Access Control

*Largely covered by MT-1, MT-3, MT-5 above. Additional findings:*

| Control | Rating | Evidence |
|---------|--------|----------|
| Default-deny for resources | **MET** | Auth middleware on all `/api/*`; unauthenticated = 401 |
| Enforce record ownership | **MET** | `requireOwnershipOrAdmin()` middleware on all mutation routes |
| Role-based access control | **MET** | `authorize(...roles)` middleware; 4 roles: admin, reviewer, user, auditor |
| Separation of duties | **MET** | Assessor cannot accept own risk (`remediation.mjs:598-619`) |
| Defence-in-depth authorization | **MET** | 7 layers: authn → role → handler-role → ownership → tenant isolation → Cypher-level → audit trail |
| Session invalidation on logout | **MET** | MSAL clears local tokens; `TokenDenylist` provides server-side revocation; admin revoke endpoint |

---

### A02: Cryptographic Failures

| Control | Rating | Evidence |
|---------|--------|----------|
| Sensitive data classification | **MET** | `docs/DATA-CLASSIFICATION.md` PII inventory and retention policies |
| Encryption at rest | **PARTIAL** | LUKS guide published; not confirmed deployed |
| Encryption in transit / TLS | **MET** | bolt+s:// for Neo4j prod; HTTPS for Entra ID, Infisical, MSAL |
| HSTS header | **MET** | nginx `Strict-Transport-Security: max-age=63072000; includeSubDomains`; helmet sets HSTS on Express |
| Hashing algorithms | **MET** | All hashing uses SHA-256; zero MD5/SHA-1 |
| Hardcoded secrets | **PARTIAL** | Dev-only `asrdev123` fallback in `database.mjs:104`; production uses Infisical |
| API key storage | **MET** | `randomBytes(32)` + SHA-256 hash-only storage; plaintext returned once |
| Security headers (Express) | **MET** | `helmet` middleware in `server.mjs` (X-Powered-By removed, HSTS, X-Content-Type-Options, etc.) |

---

### A03: Injection

| Control | Rating | Evidence |
|---------|--------|----------|
| Cypher injection | **MET** | All 100+ queries fully parameterized; template literals used only for hardcoded structural clauses |
| Command injection | **MET** | Zero `eval()`, `Function()`, `child_process.exec()` in app code |
| XSS (frontend) | **MET** | Zero `dangerouslySetInnerHTML`/`innerHTML`; React 19 auto-escaping |
| Input validation | **PARTIAL** | Parameterized Cypher queries prevent injection; body schema validation not implemented (defence-in-depth gap, not exploitable) |
| JSON.parse safety | **MET** | All instances either parse stored data or have try/catch error handling |

---

### A04: Insecure Design

| Control | Rating | Evidence |
|---------|--------|----------|
| Threat modeling | **MET** | `docs/STRIDE-THREAT-MODEL.md` — 40 threats across 7 components, 0 high-risk |
| Business logic flaws | **MET** | Ownership checks, tenant isolation, SoD on risk acceptance, proposed-changes workflow |
| Defence-in-depth authz | **MET** | 7+ authorization layers |
| Security tests | **MET** | vitest suite with 33 tests (RBAC, tenant isolation, error sanitization, security headers); GitHub Actions CI |

---

### A05: Security Misconfiguration

| Control | Rating | Evidence |
|---------|--------|----------|
| Nginx security headers | **MET** | HSTS, CSP, Permissions-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, server_tokens off |
| Express security config | **MET** | `helmet` middleware; Recorder + sanitized 62 catch blocks; global error handler |
| Docker port restrictions | **MET** | UAT/prod: all ports bound to `127.0.0.1` |
| Debug/test routes | **MET** | No debug routes. Minor: `/api/health` exposes STORM `baseUrl` |
| Technology fingerprinting | **MET** | helmet removes X-Powered-By; nginx server_tokens off |

---

### A06: Vulnerable and Outdated Components

| Control | Rating | Evidence |
|---------|--------|----------|
| Dependency versions | **MET** | All packages appear current (Express 4.21, React 19.2, jose 6.2, neo4j-driver 5.28) |
| SCA tooling | **MET** | `.github/dependabot.yml` configured for api/ and frontend/ workspaces |

---

### A07: Identification and Authentication Failures

| Control | Rating | Evidence |
|---------|--------|----------|
| Authentication flow | **MET** | Entra ID JWKS validation + service account SHA-256 hash lookup |
| Brute-force protection | **MET** | `authLimiter`: 20 req/15 min per IP; `apiLimiter`: 300 req/min per tenant |
| Session management | **MET** | JWT expiry enforced; MSAL refresh; TokenDenylist for server-side revocation |
| Default credentials | **PARTIAL** | Dev bypass guarded by `NODE_ENV !== 'production'` + localhost check |
| Service account key security | **MET** | `randomBytes(32)` + SHA-256 hash-only; admin-only CRUD; audit trail |
| MFA | **PARTIAL** | Delegated to Entra ID Conditional Access; app cannot enforce directly |

---

### A08: Software and Data Integrity Failures

| Control | Rating | Evidence |
|---------|--------|----------|
| Dependency verification | **MET** | `package-lock.json` exists for deterministic installs |
| Unsafe deserialization | **MET** | `js-yaml` v4.x safe default schema; `JSON.parse` is safe against code execution |
| CI/CD pipeline security | **MET** | `.github/workflows/ci.yml` — type-check, build, test, dependency audit |

---

### A09: Security Logging and Monitoring Failures

| Control | Rating | Evidence |
|---------|--------|----------|
| Auth event logging | **MET** | All login success/failure variants logged with tenant, IP, user-agent, reason |
| Data mutation audit trail | **MET** | `AuditEventStore` covers reviews, answers, roles, tenants, service accounts, import/export |
| Cross-tenant access logging | **MET** | `review.cross_tenant_attempt` events |
| 403 authorization failure logging | **MET** | `authorize.mjs` logs to Recorder (9010/9011) + AuditEventStore |
| Structured logs for SIEM | **MET** | Recorder with severity codes + event numbers throughout; console.* replaced in all runtime code |
| Alerting on security events | **MET** | SecurityMonitor (brute-force, cross-tenant, credential stuffing checks every 5 min) |
| Log injection protection | **MET** | Recorder handles all runtime logging; CLI scripts (setupDatabase, configureFromYaml) use console but are not network-exposed |

---

### A10: Server-Side Request Forgery (SSRF)

| Control | Rating | Evidence |
|---------|--------|----------|
| Outbound requests from user input | **MET** | No user-controlled outbound URLs |
| StormService SSRF | **MET** | All URLs from Infisical config only; timeouts enforced with AbortController |
| URL validation | **MET (N/A)** | No user-supplied URLs fetched server-side |

---

## Consolidated Summary Matrix

| # | Area | Rating | Key Gaps |
|---|------|--------|----------|
| MT-1 | Tenant Identification | **MET** | Query-level middleware deferred (low priority) |
| MT-2 | Database Isolation | **MET** | Single-tenant mode wiring deferred |
| MT-3 | IDOR Prevention | **MET** | Fully resolved |
| MT-4 | Cache Isolation | **MET/N/A** | No external cache; in-memory cache properly keyed |
| MT-5 | API Rate Limiting | **MET** | Fully resolved |
| MT-6 | File Storage | **N/A** | No file storage |
| MT-7 | Onboarding/Offboarding | **MET** | Data export partial (no full cross-entity export) |
| MT-8 | Logging & Audit | **MET** | Fully resolved |
| A01 | Broken Access Control | **MET** | Fully resolved |
| A02 | Cryptographic Failures | **PARTIAL** | EAR not confirmed deployed; dev credentials by design |
| A03 | Injection | **MET** | All queries parameterized; React auto-escaping |
| A04 | Insecure Design | **MET** | Threat model + security tests complete |
| A05 | Security Misconfiguration | **MET** | All headers, helmet, error handling, fingerprinting resolved |
| A06 | Vulnerable Components | **MET** | Dependencies current; Dependabot enabled |
| A07 | Auth Failures | **MET** | MFA via Entra ID delegation (PARTIAL by design); session revocation complete |
| A08 | Data Integrity Failures | **MET** | CI/CD pipeline + dependency verification |
| A09 | Logging & Monitoring | **MET** | Alerting, structured logging, 403 logging all resolved |
| A10 | SSRF | **MET** | No user-controlled outbound requests |
| Neo4j | Database Security | **PARTIAL** | EAR not confirmed deployed; backup not automated |

---

## Priority Remediation Roadmap

### Tier 1 — High Impact, Quick Wins ✓ COMPLETE (132a8cb)

| # | Gap | Fix | Status |
|---|-----|-----|--------|
| 1 | Error message leakage (A05) | Recorder + sanitized 62 catch blocks + global error handler | **DONE** |
| 2 | Missing security headers (A02/A05) | helmet middleware + nginx HSTS/CSP/Permissions-Policy | **DONE** |
| 3 | Technology fingerprinting (A05) | helmet removes X-Powered-By; nginx server_tokens off | **DONE** |
| 4 | 403 failure logging (A09) | authorize() rejections logged to Recorder + AuditEventStore | **DONE** |

### Tier 2 — Medium Impact, Moderate Effort ✓ COMPLETE

| # | Gap | Fix | Status |
|---|-----|-----|--------|
| 5 | SCA tooling (A06/A08) | Dependabot enabled for api/ and frontend/ workspaces | **DONE** (4d68943) |
| 6 | Security alerting (MT-8/A09) | SecurityMonitor: brute-force, cross-tenant, credential stuffing detection | **DONE** (1b11068) |
| 7 | AuditEvent TTL (MT-8) | 90-day APOC TTL on AuditEvent nodes (matches AuthEvent pattern) | **DONE** (2f20e0d) |
| 8 | STORM baseUrl in health (A05) | Removed from unauthenticated health endpoint | **DONE** (132a8cb) |

### Tier 3 — Strategic / Group E ✓ COMPLETE

| # | Gap | Fix | Status |
|---|-----|-----|--------|
| 9 | Security tests (A04) | vitest suite: 33 tests (RBAC, tenant isolation, error sanitization, headers) | **DONE** (f5b8356) |
| 10 | CI/CD pipeline (A08) | GitHub Actions: type-check, build, dependency audit, security tests | **DONE** (f5b8356) |
| 11 | Tenant offboarding (MT-7) | TenantStore.purgeTenant() + DELETE /tenants/:id/purge?confirm=yes | **DONE** (cb0187f) |
| 12 | Encryption at rest (A02/Neo4j) | LUKS operational guide: `docs/ENCRYPTION-AT-REST.md` | **DONE** (829779a) |
| 13 | Structured logging (A09) | Recorder wired throughout API (9000–9239 event codes) | **DONE** (132a8cb) |
| 14 | Formal threat model (A04) | STRIDE analysis: 40 threats, 0 high-risk — `docs/STRIDE-THREAT-MODEL.md` | **DONE** (f170c7a) |
| 15 | Server-side session revocation (A01/A07) | TokenDenylist + admin revoke endpoint + authenticate middleware check | **DONE** (144d63a) |

---

## References

- [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)
- [OWASP Top 10 (2021)](https://owasp.org/Top10/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [Neo4j Security Configuration](https://neo4j.com/docs/operations-manual/current/security/)
- Previous analysis: `docs/MULTI-TENANT-GAP-ANALYSIS.md` (2026-03-16)
- Previous plan: `docs/MULTI-TENANT-GAP-PLAN.md` (Steps 1–10 implemented)
