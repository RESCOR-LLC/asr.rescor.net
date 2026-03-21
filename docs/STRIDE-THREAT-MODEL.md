# STRIDE Threat Model — ASR Platform

**Date**: 2026-03-21
**Methodology**: Microsoft STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)
**Scope**: Full production architecture including all trust boundaries and data flows
**Related**: [OWASP Security Analysis](OWASP-SECURITY-ANALYSIS.md)

---

## System Overview

The ASR (Assessment, Scoring, and Reporting) platform is a multi-tenant web application for security risk assessments. It consists of:

- **Frontend**: React 19 SPA (MUI 7, Vite 6) served as static assets through nginx
- **Reverse Proxy**: nginx handles TLS termination, static file serving, and API proxying
- **API Server**: Express 4 (ESM `.mjs`, port 3100) with authentication, authorization, RBAC, and business logic
- **Database**: Neo4j 5.15 Community Edition with APOC plugin for graph-based tenant-isolated data storage
- **Scoring Engine**: STORM service for RSK risk score computation, accessed via authenticated REST calls
- **Secrets Management**: Infisical for all runtime configuration (database credentials, OAuth parameters, CORS origins)
- **Identity Provider**: Microsoft Entra ID (Azure AD) for user authentication via OAuth2 PKCE; service accounts use SHA-256 hashed API keys for machine-to-machine auth

### Authentication Flows

1. **User authentication**: Browser performs OAuth2 PKCE with Entra ID, obtains JWT, presents as `Authorization: Bearer <jwt>` to API. API validates via Entra ID JWKS endpoint.
2. **Service account authentication**: External systems present `Authorization: Bearer sa_<key>`. API hashes with SHA-256 and looks up in Neo4j `ServiceAccount` nodes.
3. **Development bypass**: When `NODE_ENV !== 'production'` and request originates from localhost, a synthetic admin user is attached if no token is present.

### Multi-Tenancy Model

Shared-graph multi-tenancy in Neo4j. Tenant isolation enforced at the application layer: `tenantId` extracted from JWT `tid` claim (never from client input), propagated via `request.user.tenantId`, and included in every Cypher query WHERE clause. Reviews use `[:SCOPED_TO]->(:Tenant)` relationships.

---

## Trust Boundaries

```
                                    ┌─────────────────────────────┐
                                    │       Entra ID (IdP)        │
                                    │   OAuth2 PKCE + JWKS        │
                                    └──────────┬──────────────────┘
                                               │ TB-6
    ┌───────────┐    TB-1     ┌────────────┐   │       ┌────────────────┐
    │  Browser   │───────────→│   nginx    │   │       │   Infisical    │
    │  (React)   │←───────────│  (reverse  │   │       │   (secrets)    │
    └───────────┘             │   proxy)   │   │       └───────┬────────┘
                              └─────┬──────┘               TB-5│
                               TB-2 │                          │
                              ┌─────▼──────┐    TB-4    ┌──────▼────────┐
                              │  Express   │───────────→│    STORM      │
                              │    API     │            │  (scoring)    │
                              └─────┬──────┘            └───────────────┘
                               TB-3 │
                              ┌─────▼──────┐
                              │   Neo4j    │
                              │ (database) │
                              └────────────┘
```

| ID | Boundary | Direction | Protocol |
|----|----------|-----------|----------|
| TB-1 | Internet to nginx reverse proxy | Inbound | HTTPS (TLS 1.2+) |
| TB-2 | nginx to Express API | Internal network / Docker | HTTP (plain, container-to-container) |
| TB-3 | Express API to Neo4j database | Internal network / Docker | Bolt (TLS in prod, plain in dev) |
| TB-4 | Express API to STORM scoring service | Internal network | HTTPS + Keycloak bearer token |
| TB-5 | Express API to Infisical secrets service | Outbound | HTTPS (mTLS client credentials) |
| TB-6 | Client browser to Entra ID | Outbound (OAuth2 PKCE) | HTTPS |

---

## STRIDE Analysis by Component

### 1. Frontend (React SPA)

#### S-01 — Spoofing: Stolen or Forged JWT Tokens

| Field | Value |
|-------|-------|
| **Category** | Spoofing |
| **Component** | Frontend (React SPA) |
| **Description** | An attacker who obtains a valid JWT (via XSS, token exfiltration, or browser extension compromise) could impersonate a legitimate user by replaying the token against the API. |
| **Current Mitigation** | MSAL.js stores tokens in browser session storage (not localStorage). CSP header in nginx restricts `script-src 'self'` and `connect-src` to approved origins (`nginx-frontend.conf:54`). React 19 auto-escapes all rendered content (no `dangerouslySetInnerHTML`). JWT expiry enforced server-side via `jose.jwtVerify()` (`authenticate.mjs:176`). |
| **Residual Risk** | **Low** — Token theft requires XSS, which is mitigated by CSP and React auto-escaping; JWT lifetime is controlled by Entra ID. No server-side revocation mechanism exists for active tokens. |

#### T-01 — Tampering: Client-Side State Manipulation

| Field | Value |
|-------|-------|
| **Category** | Tampering |
| **Component** | Frontend (React SPA) |
| **Description** | An attacker could modify client-side state (React state, localStorage, or API request payloads) to submit altered assessment answers, scoring data, or role claims. |
| **Current Mitigation** | All business logic and authorization decisions are enforced server-side. Roles are extracted from JWT claims or Neo4j `User` nodes, never from client-supplied data (`authenticate.mjs:194-203`). Tenant ID comes from JWT `tid` claim only. Input validation on all mutation endpoints. |
| **Residual Risk** | **None** — Server-side enforcement is authoritative; client-side state is untrusted by design. |

#### R-01 — Repudiation: User Denies Assessment Actions

| Field | Value |
|-------|-------|
| **Category** | Repudiation |
| **Component** | Frontend (React SPA) |
| **Description** | A user could deny having submitted, modified, or approved a risk assessment, answer, or remediation action. |
| **Current Mitigation** | All data mutations are recorded in `AuditEventStore` with `sub`, `tenantId`, `ipAddress`, `userAgent`, and `timestamp` (`AuditEventStore.mjs:21-52`). Authentication events tracked in `AuthEventStore` with session grouping (`AuthEventStore.mjs:17-41`). Both stores use APOC TTL for 90-day retention. |
| **Residual Risk** | **Low** — Audit trail exists but audit events are stored in the same database as application data; an admin with Neo4j access could theoretically alter audit records. No cryptographic signing of audit entries. |

#### I-01 — Information Disclosure: Sensitive Data in Browser

| Field | Value |
|-------|-------|
| **Category** | Information Disclosure |
| **Component** | Frontend (React SPA) |
| **Description** | Assessment data, scoring results, user email addresses, and JWT tokens are present in browser memory, network responses, and potentially browser history/cache. |
| **Current Mitigation** | CSP restricts data exfiltration channels (`connect-src 'self' https://login.microsoftonline.com https://*.rescor.net`). `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy: strict-origin-when-cross-origin` headers set in nginx (`nginx-frontend.conf:50-53`). MSAL uses session storage (cleared on tab close). |
| **Residual Risk** | **Low** — Standard browser security controls are in place. Data is visible to authenticated users in their own tenant scope. |

#### D-01 — Denial of Service: Frontend Resource Exhaustion

| Field | Value |
|-------|-------|
| **Category** | Denial of Service |
| **Component** | Frontend (React SPA) |
| **Description** | An attacker could attempt to exhaust nginx resources by flooding requests for static assets or triggering excessive SPA route transitions. |
| **Current Mitigation** | nginx `worker_connections 1024` limits concurrent connections (`nginx-frontend.conf:7`). `client_max_body_size 64m` prevents oversized uploads (`nginx-frontend.conf:21`). Static assets served via `sendfile on` for kernel-level efficiency. |
| **Residual Risk** | **Low** — No nginx-level rate limiting on static assets, but CDN or external WAF can be layered. |

#### E-01 — Elevation of Privilege: Client-Side Role Bypass

| Field | Value |
|-------|-------|
| **Category** | Elevation of Privilege |
| **Component** | Frontend (React SPA) |
| **Description** | An attacker could modify client-side role checks to display admin UI components or attempt to call admin-only API endpoints. |
| **Current Mitigation** | All authorization is enforced server-side via `authorize(...roles)` middleware (`authorize.mjs:13-51`). Admin routes require `admin` role. Frontend role checks are cosmetic only. 403 responses logged to `AuditEventStore`. |
| **Residual Risk** | **None** — Server-side RBAC is authoritative; client-side bypass exposes UI elements but all API calls are rejected. |

---

### 2. nginx Reverse Proxy

#### S-02 — Spoofing: TLS Certificate Impersonation

| Field | Value |
|-------|-------|
| **Category** | Spoofing |
| **Component** | nginx reverse proxy |
| **Description** | An attacker could perform a man-in-the-middle attack by presenting a fraudulent TLS certificate, intercepting authentication tokens and assessment data in transit. |
| **Current Mitigation** | HSTS header with `max-age=63072000; includeSubDomains` (`nginx-frontend.conf:53`). TLS configuration managed at the deployment layer. `X-Forwarded-Proto` set to `$scheme` for downstream awareness (`nginx-frontend.conf:41`). |
| **Residual Risk** | **Low** — HSTS prevents downgrade attacks after first visit. Certificate management and TLS version/cipher configuration are deployment-dependent. |

#### T-02 — Tampering: Proxy Header Injection

| Field | Value |
|-------|-------|
| **Category** | Tampering |
| **Component** | nginx reverse proxy |
| **Description** | An attacker could inject or manipulate `X-Forwarded-For`, `X-Forwarded-Host`, or other proxy headers to spoof IP addresses, bypass rate limiting, or confuse authentication logic. |
| **Current Mitigation** | nginx sets `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` from actual connection metadata (`nginx-frontend.conf:39-41`). Express configured with `trust proxy: 1` to trust only the first proxy hop (`server.mjs:44`). Rate limiter uses `express-rate-limit` IP key generator as fallback (`rateLimiter.mjs:29`). Localhost detection in auth middleware checks `x-forwarded-host` to prevent remote dev-bypass exploitation (`authenticate.mjs:28-29`). |
| **Residual Risk** | **Low** — Single proxy hop trust limits spoofing surface. If nginx sits behind another load balancer, `trust proxy` may need adjustment. |

#### I-02 — Information Disclosure: Server Fingerprinting

| Field | Value |
|-------|-------|
| **Category** | Information Disclosure |
| **Component** | nginx reverse proxy |
| **Description** | Server version headers or error pages could reveal technology stack details (nginx version, OS), aiding targeted attacks. |
| **Current Mitigation** | `server_tokens off` in nginx configuration (`nginx-frontend.conf:22`). Express uses `helmet()` middleware which removes `X-Powered-By` header (`server.mjs:45-48`). |
| **Residual Risk** | **None** — Standard fingerprinting vectors are suppressed. |

#### D-02 — Denial of Service: Connection Exhaustion

| Field | Value |
|-------|-------|
| **Category** | Denial of Service |
| **Component** | nginx reverse proxy |
| **Description** | Volumetric DDoS or slowloris attacks could exhaust nginx worker connections, rendering the platform unavailable to all tenants. |
| **Current Mitigation** | `worker_connections 1024` with `worker_processes auto` (`nginx-frontend.conf:1,7`). `keepalive_timeout 65` limits idle connection duration (`nginx-frontend.conf:20`). `proxy_read_timeout 120s` prevents indefinite upstream waits (`nginx-frontend.conf:42`). |
| **Residual Risk** | **Medium** — No connection-level rate limiting, `limit_req`, or `limit_conn` directives in nginx config. Application-layer rate limiting exists downstream but L4/L7 volumetric attacks would reach nginx unmitigated without an external WAF or DDoS protection service. |

#### E-02 — Elevation of Privilege: nginx Misconfiguration Bypass

| Field | Value |
|-------|-------|
| **Category** | Elevation of Privilege |
| **Component** | nginx reverse proxy |
| **Description** | Misconfigured location blocks could allow direct access to API endpoints that should be restricted, or expose internal nginx status pages. |
| **Current Mitigation** | Only two location blocks: `/api/` proxied to Express, `/` serves SPA with `try_files` fallback (`nginx-frontend.conf:34-48`). No debug or status endpoints exposed. nginx runs with `pid /tmp/nginx.pid` (non-root PID file) (`nginx-frontend.conf:3`). |
| **Residual Risk** | **None** — Minimal location block configuration; no exposed management interfaces. |

---

### 3. Express API Server

#### S-03 — Spoofing: JWT Forgery or Replay

| Field | Value |
|-------|-------|
| **Category** | Spoofing |
| **Component** | Express API |
| **Description** | An attacker could attempt to forge a JWT, replay an expired token, or use a token from an unauthorized Entra ID tenant to gain access. |
| **Current Mitigation** | JWT validation via `jose.jwtVerify()` against Entra ID JWKS endpoint with cryptographic signature verification (`authenticate.mjs:176`). Issuer validated against regex pattern for multi-tenant mode (`authenticate.mjs:180-191`). `allowedTenants` whitelist rejects unauthorized directory tenants. Audience claim validated against `clientId` (`authenticate.mjs:173`). |
| **Residual Risk** | **Low** — JWKS rotation is managed by Entra ID. No server-side token revocation; compromised tokens remain valid until expiry. |

#### S-04 — Spoofing: Service Account Key Brute Force

| Field | Value |
|-------|-------|
| **Category** | Spoofing |
| **Component** | Express API |
| **Description** | An attacker could attempt to brute-force service account API keys (prefixed `sa_`) to gain machine-to-machine access. |
| **Current Mitigation** | Keys generated with `randomBytes(32)` providing 256 bits of entropy (`serviceAccounts.mjs:35`). Keys stored as SHA-256 hashes only; plaintext returned once at creation (`serviceAccounts.mjs:37`). `authLimiter` applies 20 requests per 15 minutes per IP on `/api/auth/*` (`rateLimiter.mjs:14-20`). Failed auth attempts logged to `AuthEventStore` with IP and user-agent (`authenticate.mjs:126`). |
| **Residual Risk** | **None** — 256-bit key space makes brute force computationally infeasible. Rate limiting provides additional protection. |

#### T-03 — Tampering: Request Body Manipulation

| Field | Value |
|-------|-------|
| **Category** | Tampering |
| **Component** | Express API |
| **Description** | An attacker could manipulate API request bodies to alter assessment data, inject malicious tenant IDs, modify scoring parameters, or tamper with user role assignments. |
| **Current Mitigation** | Tenant ID sourced exclusively from JWT `tid` claim, never from request body (`authenticate.mjs:200`). Role assignments validated against allowlist `['admin', 'reviewer', 'user', 'auditor']` (`admin.mjs:43-44`). All Cypher queries fully parameterized (`$param` syntax) preventing injection (`OWASP-SECURITY-ANALYSIS.md:183`). Review ownership verified via `requireOwnershipOrAdmin()` with tenant-scoped queries (`authorize.mjs:53-113`). Admin-only endpoints gated by `authorize('admin')` (`server.mjs:112-115`). |
| **Residual Risk** | **Low** — Some endpoints lack strict type/length validation on body fields (defense-in-depth gap), but parameterized queries prevent injection and authorization prevents unauthorized mutations. |

#### T-04 — Tampering: Tenant Data Cross-Contamination via Import

| Field | Value |
|-------|-------|
| **Category** | Tampering |
| **Component** | Express API |
| **Description** | The tenant data import endpoint (`POST /:tenantId/import`) accepts a full JSON dataset. A malicious admin could craft an import payload that overwrites data belonging to another tenant, or inject nodes with mismatched tenant IDs. |
| **Current Mitigation** | Import endpoint requires `admin` role (`server.mjs:114`). `conflictStrategy` parameter controls overwrite behavior (`tenantData.mjs:68`). Import is scoped to the target `tenantId` path parameter. Audit event logged with full import metadata (`tenantData.mjs:116-132`). Format version validation rejects unknown schemas (`tenantData.mjs:75-76`). Body size limited to 10MB (`tenantData.mjs:62`). |
| **Residual Risk** | **Medium** — Admin-only access limits the attack surface, but the import logic trusts the structure of the uploaded JSON. No cryptographic integrity verification (e.g., HMAC) on export payloads. A compromised admin account could potentially inject cross-tenant data if the import logic does not strictly re-stamp all imported nodes with the target tenant ID. |

#### R-02 — Repudiation: Admin Action Deniability

| Field | Value |
|-------|-------|
| **Category** | Repudiation |
| **Component** | Express API |
| **Description** | An administrator could perform destructive actions (tenant purge, role changes, service account creation) and deny responsibility. |
| **Current Mitigation** | All admin mutations logged to `AuditEventStore` with `sub`, `tenantId`, `ipAddress`, `userAgent`, and action-specific metadata (`admin.mjs:74-85, 291-301, 327-337, 364-390`). Tenant purge logged with separate Recorder warning events (`admin.mjs:364-367, 377-379`). Service account CRUD logged with audit events (`serviceAccounts.mjs:57-68, 110-119`). |
| **Residual Risk** | **Low** — Comprehensive audit trail exists. Audit records are in the same database as application data and could theoretically be tampered with by a database administrator. No immutable or append-only log guarantee. |

#### R-03 — Repudiation: Development Bypass Audit Gap

| Field | Value |
|-------|-------|
| **Category** | Repudiation |
| **Component** | Express API |
| **Description** | In development mode, the synthetic dev user (`dev-user-0000`) is used for all unauthenticated requests from localhost. Actions performed under this identity are not attributable to a real person. |
| **Current Mitigation** | Dev bypass only activates when `NODE_ENV !== 'production'` AND the request originates from localhost (`authenticate.mjs:101`). Non-localhost requests (e.g., via ngrok) must authenticate even in dev mode. Dev-bypass auth events are logged with reason `'dev-bypass'` (`authenticate.mjs:108`). |
| **Residual Risk** | **Low** — Risk is limited to development environments. Production deployment sets `NODE_ENV=production`, completely disabling the bypass. |

#### I-03 — Information Disclosure: Error Message Leakage

| Field | Value |
|-------|-------|
| **Category** | Information Disclosure |
| **Component** | Express API |
| **Description** | Internal error messages, stack traces, or database error details could leak through API error responses, revealing implementation details to attackers. |
| **Current Mitigation** | Global error handler returns generic `'Internal server error'` message with 500 status (`server.mjs:120-128`). All route-level catch blocks return sanitized error messages. Recorder captures detailed errors server-side for debugging (`server.mjs:122-126`). `helmet()` middleware configured (`server.mjs:45-48`). |
| **Residual Risk** | **Low** — Error sanitization has been applied across all 60+ catch blocks (per OWASP analysis Tier 1 remediation). The tenant import route passes through `error.message` for non-500 status codes (`tenantData.mjs:140`), which could reveal internal details for validation errors. |

#### I-04 — Information Disclosure: Cross-Tenant Data Leakage

| Field | Value |
|-------|-------|
| **Category** | Information Disclosure |
| **Component** | Express API |
| **Description** | A user in Tenant A could attempt to access reviews, scores, or configuration belonging to Tenant B by manipulating resource IDs in API requests. |
| **Current Mitigation** | All data queries include `tenantId` in WHERE clauses or `:SCOPED_TO` relationship traversals. `verifyReviewTenant()` on all review routes returns 404 (not 403) to prevent tenant enumeration. Resource IDs are `randomUUID()` preventing sequential enumeration. Cross-tenant access attempts logged as `review.cross_tenant_attempt` audit events. `SecurityMonitor` checks for authorization denial patterns every 5 minutes (`SecurityMonitor.mjs:84-103`). |
| **Residual Risk** | **Low** — Application-layer isolation is consistent across all stores. No Cypher-level tenant injection middleware exists as a defense-in-depth backstop (deferred Group E item). |

#### I-05 — Information Disclosure: Auth Event Metadata Exposure

| Field | Value |
|-------|-------|
| **Category** | Information Disclosure |
| **Component** | Express API |
| **Description** | Auth event and audit event listing endpoints expose IP addresses, user agents, and email addresses. If tenant-scoping were bypassed, an attacker could enumerate users across all tenants. |
| **Current Mitigation** | Auth events endpoint tenant-scoped: `request.user?.tenantId` applied to all queries (`admin.mjs:145, 169, 189`). Admin-only access required (`server.mjs:112`). User listing is tenant-scoped (`admin.mjs:20-21`). |
| **Residual Risk** | **Low** — Access restricted to authenticated admins within their own tenant. A super-admin with `tenantId: null` could see cross-tenant data; this is by design for platform operators. |

#### D-03 — Denial of Service: API Rate Limit Bypass

| Field | Value |
|-------|-------|
| **Category** | Denial of Service |
| **Component** | Express API |
| **Description** | An attacker could attempt to bypass rate limiting by rotating IP addresses, or exploit the tenant-keyed rate limiter to impose the 300 req/min limit on an entire tenant by making requests as that tenant. |
| **Current Mitigation** | `authLimiter`: 20 req/15 min per IP on `/api/auth/*` (`rateLimiter.mjs:14-20`). `apiLimiter`: 300 req/min keyed by `tenantId || ip` (`rateLimiter.mjs:26-34`). Standard `RateLimit-*` response headers enabled. `SecurityMonitor` detects brute-force patterns (`SecurityMonitor.mjs:61-81`). |
| **Residual Risk** | **Medium** — Authenticated requests from a legitimate tenant are rate-limited per-tenant, meaning a compromised account within a tenant could exhaust the quota for all users of that tenant. IP rotation by unauthenticated attackers can circumvent per-IP limits. No adaptive rate limiting or CAPTCHA challenge. |

#### D-04 — Denial of Service: Tenant Purge as Destructive Attack

| Field | Value |
|-------|-------|
| **Category** | Denial of Service |
| **Component** | Express API |
| **Description** | A compromised admin account could invoke the hard-purge endpoint (`DELETE /tenants/:tenantId/purge?confirm=yes`) to irreversibly destroy all data for a tenant, including reviews, users, audit events, and the tenant node itself. |
| **Current Mitigation** | Purge requires `admin` role (`server.mjs:112`). Explicit `?confirm=yes` query parameter required (`admin.mjs:357`). Purge events logged to Recorder with warning severity and to `AuditEventStore` (`admin.mjs:364-390`). Sequential multi-query deletion with verification (`TenantStore.mjs:108-177`). |
| **Residual Risk** | **Medium** — Single confirmation parameter is the only safeguard beyond admin role. No two-person authorization, time-delayed execution, or soft-delete-before-purge mandatory workflow. The `?confirm=yes` parameter is trivially included in a scripted attack. An admin with purge rights for one tenant could potentially purge any tenant (admin role grants cross-tenant purge capability). |

#### E-03 — Elevation of Privilege: Role Escalation via Admin API

| Field | Value |
|-------|-------|
| **Category** | Elevation of Privilege |
| **Component** | Express API |
| **Description** | An admin could grant themselves additional roles, or a non-admin could attempt to call the role update endpoint to escalate privileges. |
| **Current Mitigation** | Role update endpoint requires `admin` role (`server.mjs:112`). Roles validated against allowlist `['admin', 'reviewer', 'user', 'auditor']` (`admin.mjs:63`). Role changes logged to `AuditEventStore` with before/after metadata (`admin.mjs:74-85`). |
| **Residual Risk** | **Low** — An existing admin can grant admin to others, which is by design. No separation between "can manage users" and "can manage tenants" within the admin role; it is a single superuser role. |

#### E-04 — Elevation of Privilege: Service Account with Admin Role

| Field | Value |
|-------|-------|
| **Category** | Elevation of Privilege |
| **Component** | Express API |
| **Description** | Service accounts can be created with admin roles, granting full platform access to an API key. If a service account key is compromised, the attacker gains admin privileges without Entra ID MFA. |
| **Current Mitigation** | Service account creation requires `admin` role (`server.mjs:113`). Default role assignment is `['admin']` if no roles specified (`serviceAccounts.mjs:30-31`). Keys are 256-bit random with SHA-256 hash-only storage. Service account deactivation endpoint available (`serviceAccounts.mjs:97-129`). All operations audit-logged. |
| **Residual Risk** | **Medium** — Service accounts bypass Entra ID MFA by design. Default role of `admin` when no roles are specified is a permissive default. No key rotation mechanism or expiration policy exists. A leaked `sa_` key provides persistent admin access until manually revoked. |

---

### 4. Neo4j Database

#### S-05 — Spoofing: Database Credential Theft

| Field | Value |
|-------|-------|
| **Category** | Spoofing |
| **Component** | Neo4j Database |
| **Description** | If Neo4j credentials are compromised, an attacker could connect directly to the database and impersonate the application, bypassing all application-layer access controls. |
| **Current Mitigation** | Production credentials managed via Infisical, never in source code (`database.mjs:102-104`). Dev credentials (`asrdev123`) used only in local development (`docker-compose.yml:12`). Production ports bound to `127.0.0.1` (not externally accessible). `bolt+s://` enforced in production for encrypted transport. |
| **Residual Risk** | **Low** — Production credentials are isolated in Infisical. Dev credentials exist in `docker-compose.yml` and `database.mjs` fallback but are not used in production. |

#### T-05 — Tampering: Direct Database Manipulation

| Field | Value |
|-------|-------|
| **Category** | Tampering |
| **Component** | Neo4j Database |
| **Description** | An attacker with direct database access could modify assessment data, alter scoring configurations, change user roles, delete audit events, or manipulate tenant isolation relationships. |
| **Current Mitigation** | Neo4j port restricted to `127.0.0.1` in production (not exposed to network). Neo4j Community Edition does not support granular RBAC (single user model). All legitimate access goes through the application layer. |
| **Residual Risk** | **Medium** — Neo4j Community Edition provides no role separation. Any user with database credentials has full read/write access to all data across all tenants. A compromised server or insider with SSH access could directly manipulate data including audit trails. |

#### T-06 — Tampering: Audit Event Manipulation

| Field | Value |
|-------|-------|
| **Category** | Tampering |
| **Component** | Neo4j Database |
| **Description** | Audit events (`AuditEvent`, `AuthEvent` nodes) stored in Neo4j can be modified or deleted by anyone with database access, undermining the integrity of the compliance audit trail. |
| **Current Mitigation** | Application-layer access to audit events is read-only for admin users (no update/delete API endpoints). APOC TTL handles automatic expiration after 90 days. Tenant purge deletes audit events for that tenant only (`TenantStore.mjs:152-159`). |
| **Residual Risk** | **Medium** — No write-once / append-only guarantee. No cryptographic chaining or signatures on audit records. Database-level access allows silent modification. Sufficient for regulatory compliance in most non-SOC2 contexts but would not meet WORM (Write Once Read Many) requirements. |

#### I-06 — Information Disclosure: Unencrypted Data at Rest

| Field | Value |
|-------|-------|
| **Category** | Information Disclosure |
| **Component** | Neo4j Database |
| **Description** | Neo4j Community Edition does not support Transparent Data Encryption (TDE). Assessment data, PII (email addresses, display names, IP addresses), and scoring results are stored unencrypted on disk. |
| **Current Mitigation** | Network isolation (ports bound to `127.0.0.1`). Docker volumes used for data persistence (`docker-compose.yml:23`). Host-level disk encryption (LUKS/dm-crypt) may be applied at the infrastructure layer but is not confirmed. |
| **Residual Risk** | **Medium** — Physical disk access or backup theft would expose all tenant data in plaintext. This is a known limitation of Neo4j Community Edition. Host-level encryption is the recommended compensating control. |

#### D-05 — Denial of Service: Database Resource Exhaustion

| Field | Value |
|-------|-------|
| **Category** | Denial of Service |
| **Component** | Neo4j Database |
| **Description** | Resource-intensive Cypher queries (e.g., unbounded graph traversals during tenant purge or large data exports) could starve Neo4j of memory or CPU, affecting all tenants in the shared database. |
| **Current Mitigation** | Neo4j heap limited to 256MB initial / 512MB max (`docker-compose.yml:14-15`). Session-per-query wrapper ensures no session leaks (`database.mjs:17-70`). API rate limiting prevents excessive query volume. APOC TTL limits to 1000 nodes per cycle (`docker-compose.yml:19`). Health check ensures Neo4j is responsive (`docker-compose.yml:24-29`). |
| **Residual Risk** | **Low** — Memory bounds and connection management are configured. Tenant purge executes sequential queries rather than a single unbounded traversal, but a very large tenant purge could still cause temporary performance degradation. |

#### E-05 — Elevation of Privilege: Single-User Database Model

| Field | Value |
|-------|-------|
| **Category** | Elevation of Privilege |
| **Component** | Neo4j Database |
| **Description** | Neo4j Community Edition supports only a single database user. If the application database credential is compromised, the attacker has full access to all data including system metadata. There is no principle of least privilege at the database layer. |
| **Current Mitigation** | All access routed through the application layer which enforces RBAC and tenant isolation. Database credentials stored in Infisical (not in application code for production). |
| **Residual Risk** | **Medium** — Inherent limitation of Neo4j Community Edition. Upgrading to Enterprise Edition would enable database-level RBAC with read-only roles and per-database access control. |

---

### 5. STORM Scoring Service

#### S-06 — Spoofing: Forged Scoring Responses

| Field | Value |
|-------|-------|
| **Category** | Spoofing |
| **Component** | STORM Service |
| **Description** | An attacker performing a man-in-the-middle attack between the API and STORM service could inject fabricated risk scores, undermining the integrity of all assessments. |
| **Current Mitigation** | STORM communication uses HTTPS. Keycloak client-credentials bearer token required for all STORM API calls (`StormService.mjs:186-188`). Token fetched with 10-second timeout via AbortController (`StormService.mjs:50-51`). STORM requests have 15-second timeout (`StormService.mjs:192`). All STORM URLs sourced from Infisical configuration, not user input (`StormService.mjs:112`). |
| **Residual Risk** | **Low** — Authenticated, encrypted channel with timeout protection. MITM would require compromising the internal network and the Keycloak token. |

#### T-07 — Tampering: Score Manipulation via STORM

| Field | Value |
|-------|-------|
| **Category** | Tampering |
| **Component** | STORM Service |
| **Description** | If the STORM service is compromised, it could return manipulated risk scores that affect assessment outcomes and compliance decisions across all tenants. |
| **Current Mitigation** | Local fallback scoring formula activates on any STORM error (`StormService.mjs:162-164`). Score computation parameters (dampingFactor, rawMax, ratingThresholds, ratingLabels) are loaded from Neo4j `ScoringConfig` nodes, not from STORM. STORM only computes the mathematical score; rating classification happens locally. |
| **Residual Risk** | **Low** — Fallback mechanism limits blast radius of STORM compromise. Score manipulation would still require the attacker to control STORM's responses without triggering errors. Scoring configuration remains under platform control. |

#### D-06 — Denial of Service: STORM Unavailability

| Field | Value |
|-------|-------|
| **Category** | Denial of Service |
| **Component** | STORM Service |
| **Description** | If the STORM service becomes unavailable (outage, network partition, or deliberate attack), score computation could fail, blocking assessment workflows. |
| **Current Mitigation** | Automatic fallback to local `computeScore()` function on any STORM error (`StormService.mjs:162-164`). `enabled` feature flag allows disabling STORM entirely (`StormService.mjs:146-148`). AbortController timeouts prevent hanging requests: 10s for token, 15s for scoring (`StormService.mjs:24-25`). Keycloak token caching with 60-second buffer reduces token endpoint dependency (`StormService.mjs:40`). |
| **Residual Risk** | **None** — Full graceful degradation implemented. STORM outage is transparent to end users. |

#### I-07 — Information Disclosure: Assessment Data Sent to STORM

| Field | Value |
|-------|-------|
| **Category** | Information Disclosure |
| **Component** | STORM Service |
| **Description** | Assessment measurement data is sent to the STORM service for scoring. If STORM logging or storage is compromised, assessment data could be exposed. |
| **Current Mitigation** | Only numerical measurements and scaling base are sent to STORM (`StormService.mjs:152-155`). No PII, tenant identifiers, or review metadata are included in STORM requests. HTTPS transport encryption. |
| **Residual Risk** | **None** — Minimal data exposure; only anonymous numerical arrays are transmitted. |

---

### 6. Infisical Secrets Service

#### S-07 — Spoofing: Infisical Credential Compromise

| Field | Value |
|-------|-------|
| **Category** | Spoofing |
| **Component** | Infisical |
| **Description** | If Infisical client credentials (`INFISICAL_PROJECT_ID`, `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`) are compromised, an attacker could read all platform secrets including database passwords, OAuth configuration, and STORM/Keycloak credentials. |
| **Current Mitigation** | Infisical credentials passed via environment variables to the API container (`database.mjs:85-87`). Not stored in source code. `requireInfisical: false` allows graceful degradation to local defaults in development (`database.mjs:83`). |
| **Residual Risk** | **Medium** — Infisical credentials are the single root of trust for all secrets. Compromise of these three values exposes the entire secret tree. Container environment variables are visible to anyone with Docker access on the host. No Infisical access IP restrictions or audit alerting confirmed. |

#### T-08 — Tampering: Secret Value Manipulation

| Field | Value |
|-------|-------|
| **Category** | Tampering |
| **Component** | Infisical |
| **Description** | An attacker with Infisical access could modify secret values (e.g., change `entra.allowedTenants` to include a malicious tenant, alter `server.corsAllowedOrigins` to allow attacker-controlled origins, or change the Neo4j password to lock out the application). |
| **Current Mitigation** | Infisical provides its own access control and audit logging. Configuration is cached in-memory by `@rescor/core-config` (`database.mjs:84`), so changes take effect only on application restart. CORS origins, Neo4j credentials, and Entra ID parameters are all sourced from Infisical. |
| **Residual Risk** | **Medium** — Infisical is a high-value target. Tampering with secrets could redirect authentication, change CORS policy, or deny database access. The caching behavior provides a brief buffer against real-time manipulation. |

#### D-07 — Denial of Service: Infisical Outage

| Field | Value |
|-------|-------|
| **Category** | Denial of Service |
| **Component** | Infisical |
| **Description** | If Infisical is unavailable during application startup, the API cannot resolve its configuration (database credentials, OAuth settings, CORS origins) and may fail to boot. |
| **Current Mitigation** | `requireInfisical: false` in configuration allows fallback to local defaults (`database.mjs:83`). In-memory caching (`enableCache: true`) means running instances survive transient Infisical outages (`database.mjs:84`). Development environment has hardcoded fallback values for Neo4j connection (`database.mjs:102-104`). |
| **Residual Risk** | **Low** — Running instances are resilient to Infisical outages due to caching. Cold start during an Infisical outage in production would use fallback defaults which may not include correct production credentials. |

---

### 7. Entra ID (Identity Provider)

#### S-08 — Spoofing: Compromised Entra ID Tenant

| Field | Value |
|-------|-------|
| **Category** | Spoofing |
| **Component** | Entra ID |
| **Description** | If an Entra ID tenant in the `allowedTenants` list is compromised, the attacker could issue valid JWTs that the ASR API would accept, gaining access as any user from that tenant. |
| **Current Mitigation** | `allowedTenants` whitelist restricts which Entra ID directories are accepted (`authenticate.mjs:187-191`). Issuer format validated against strict regex `^https://login.microsoftonline.com/[uuid]/v2.0$` (`authenticate.mjs:180-181`). Audience validated against the application's `clientId` (`authenticate.mjs:173`). User roles resolved from Neo4j `User` nodes, not solely from JWT claims (`authenticate.mjs:205-209`). |
| **Residual Risk** | **Low** — Even with a compromised tenant, the attacker would get the roles assigned in the ASR `User` node, not arbitrary roles. New users from a compromised tenant would default to minimal permissions unless pre-provisioned. |

#### S-09 — Spoofing: Multi-Tenant Issuer Confusion

| Field | Value |
|-------|-------|
| **Category** | Spoofing |
| **Component** | Entra ID |
| **Description** | In multi-tenant mode (no single `tenantId` configured), an attacker could attempt to present tokens from arbitrary Entra ID tenants, exploiting issuer validation weaknesses. |
| **Current Mitigation** | Multi-tenant JWKS uses the `organizations` endpoint for key resolution (`authenticate.mjs:90`). Issuer validated per-request against strict UUID-based regex (`authenticate.mjs:180-181`). `allowedTenants` array, when populated, rejects tokens from unlisted tenants (`authenticate.mjs:187-188`). When `allowedTenants` is empty, all Entra ID tenants are accepted (intentional for open federation scenarios). |
| **Residual Risk** | **Low** — When `allowedTenants` is configured, only explicitly listed tenants are accepted. Operators must ensure this list is maintained. |

#### R-04 — Repudiation: Entra ID Token Claims as Identity Proof

| Field | Value |
|-------|-------|
| **Category** | Repudiation |
| **Component** | Entra ID |
| **Description** | User identity is derived from Entra ID JWT claims (`sub`, `preferred_username`, `email`). If Entra ID audit logs are not retained or correlated, a user could dispute that they authenticated to the platform. |
| **Current Mitigation** | All successful and failed authentications logged to `AuthEventStore` with `sub`, `ipAddress`, `userAgent`, `host`, `outcome`, and `reason` (`authenticate.mjs:71-78, 108, 112, 142, 212, 224`). Auth event session grouping provides temporal context (`AuthEventStore.mjs:119-244`). Platform audit trail is independent of Entra ID audit logs. |
| **Residual Risk** | **None** — Platform maintains its own authentication audit trail independent of the identity provider. |

#### D-08 — Denial of Service: Entra ID Outage

| Field | Value |
|-------|-------|
| **Category** | Denial of Service |
| **Component** | Entra ID |
| **Description** | If Entra ID or its JWKS endpoint is unavailable, no new users can authenticate. Existing sessions with valid (non-expired) JWT tokens continue to work, but token refresh and new logins fail. |
| **Current Mitigation** | `jose` library caches JWKS keys after first fetch. Service account authentication (`sa_` keys) is completely independent of Entra ID and continues to function. Development bypass activates on localhost in non-production environments. |
| **Residual Risk** | **Low** — JWKS caching provides resilience against transient outages. Service account authentication provides an alternate access path for critical machine-to-machine operations. Entra ID SLA is 99.99%. |

#### E-06 — Elevation of Privilege: Entra ID Role Claim Injection

| Field | Value |
|-------|-------|
| **Category** | Elevation of Privilege |
| **Component** | Entra ID |
| **Description** | An attacker who controls an Entra ID app registration or directory could inject elevated role claims (e.g., `admin`) into JWT tokens. |
| **Current Mitigation** | JWT `roles` claim is used as initial assignment only. If a `User` node exists in Neo4j with persisted roles, those take precedence over JWT claims (`authenticate.mjs:205-209`). User provisioning by admin assigns specific roles (`admin.mjs:32-53`). New users without pre-provisioned `User` nodes inherit JWT roles which default to empty for standard Entra ID configurations. |
| **Residual Risk** | **Low** — Neo4j-stored roles override JWT claims for existing users. New users from a compromised directory would get whatever roles are in their JWT, but standard Entra ID app registrations do not include app roles unless explicitly configured by the ASR platform admin. |

---

## Summary Matrix

| ID | Category | Component | Threat | Residual Risk |
|----|----------|-----------|--------|---------------|
| S-01 | Spoofing | Frontend | Stolen/forged JWT tokens | **Low** |
| S-02 | Spoofing | nginx | TLS certificate impersonation | **Low** |
| S-03 | Spoofing | Express API | JWT forgery or replay | **Low** |
| S-04 | Spoofing | Express API | Service account key brute force | **None** |
| S-05 | Spoofing | Neo4j | Database credential theft | **Low** |
| S-06 | Spoofing | STORM | Forged scoring responses | **Low** |
| S-07 | Spoofing | Infisical | Credential compromise (root of trust) | **Medium** |
| S-08 | Spoofing | Entra ID | Compromised allowed tenant | **Low** |
| S-09 | Spoofing | Entra ID | Multi-tenant issuer confusion | **Low** |
| T-01 | Tampering | Frontend | Client-side state manipulation | **None** |
| T-02 | Tampering | nginx | Proxy header injection | **Low** |
| T-03 | Tampering | Express API | Request body manipulation | **Low** |
| T-04 | Tampering | Express API | Cross-tenant data via import | **Medium** |
| T-05 | Tampering | Neo4j | Direct database manipulation | **Medium** |
| T-06 | Tampering | Neo4j | Audit event manipulation | **Medium** |
| T-07 | Tampering | STORM | Score manipulation | **Low** |
| T-08 | Tampering | Infisical | Secret value manipulation | **Medium** |
| R-01 | Repudiation | Frontend | User denies assessment actions | **Low** |
| R-02 | Repudiation | Express API | Admin action deniability | **Low** |
| R-03 | Repudiation | Express API | Development bypass audit gap | **Low** |
| R-04 | Repudiation | Entra ID | Token claims as identity proof | **None** |
| I-01 | Information Disclosure | Frontend | Sensitive data in browser | **Low** |
| I-02 | Information Disclosure | nginx | Server fingerprinting | **None** |
| I-03 | Information Disclosure | Express API | Error message leakage | **Low** |
| I-04 | Information Disclosure | Express API | Cross-tenant data leakage | **Low** |
| I-05 | Information Disclosure | Express API | Auth event metadata exposure | **Low** |
| I-06 | Information Disclosure | Neo4j | Unencrypted data at rest | **Medium** |
| I-07 | Information Disclosure | STORM | Assessment data sent to STORM | **None** |
| D-01 | Denial of Service | Frontend | Frontend resource exhaustion | **Low** |
| D-02 | Denial of Service | nginx | Connection exhaustion (DDoS) | **Medium** |
| D-03 | Denial of Service | Express API | Rate limit bypass / tenant quota abuse | **Medium** |
| D-04 | Denial of Service | Express API | Tenant purge as destructive attack | **Medium** |
| D-05 | Denial of Service | Neo4j | Database resource exhaustion | **Low** |
| D-06 | Denial of Service | STORM | STORM unavailability | **None** |
| D-07 | Denial of Service | Infisical | Infisical outage | **Low** |
| D-08 | Denial of Service | Entra ID | Entra ID outage | **Low** |
| E-01 | Elevation of Privilege | Frontend | Client-side role bypass | **None** |
| E-02 | Elevation of Privilege | nginx | Misconfiguration bypass | **None** |
| E-03 | Elevation of Privilege | Express API | Role escalation via admin API | **Low** |
| E-04 | Elevation of Privilege | Express API | Service account with admin role | **Medium** |
| E-05 | Elevation of Privilege | Neo4j | Single-user database model | **Medium** |
| E-06 | Elevation of Privilege | Entra ID | Role claim injection | **Low** |

### Risk Distribution

| Residual Risk | Count | Percentage |
|---------------|-------|------------|
| **None** | 10 | 25% |
| **Low** | 21 | 53% |
| **Medium** | 9 | 22% |
| **High** | 0 | 0% |

### Medium-Risk Items Requiring Attention

| ID | Threat | Recommended Mitigation |
|----|--------|----------------------|
| S-07 | Infisical credential compromise | Restrict Infisical access by IP; enable Infisical audit alerting; rotate credentials periodically |
| T-04 | Cross-tenant data via import | Add HMAC integrity verification on export payloads; validate all imported node tenant IDs match target |
| T-05 | Direct database manipulation | Restrict SSH/Docker access; consider Neo4j Enterprise for database RBAC; implement host-level LUKS encryption |
| T-06 | Audit event manipulation | Implement append-only log export to external SIEM; consider cryptographic chaining of audit records |
| T-08 | Secret value manipulation | Enable Infisical change notifications; implement secret change detection on API startup |
| I-06 | Unencrypted data at rest | Deploy host-level LUKS/dm-crypt on Neo4j data volumes |
| D-02 | Connection exhaustion (DDoS) | Add nginx `limit_req` / `limit_conn` directives; deploy external WAF or DDoS protection |
| D-03 | Rate limit bypass / tenant quota | Implement per-user sub-quotas within tenant bucket; add adaptive rate limiting |
| D-04 | Tenant purge as destructive attack | Implement two-step purge (deactivate then purge after cooldown); add two-person authorization for destructive operations |
| E-04 | Service account admin role | Change default role to least-privilege; add key expiration policy; implement key rotation mechanism |
| E-05 | Single-user database model | Evaluate Neo4j Enterprise Edition for database-level RBAC |

---

## References

- [Microsoft STRIDE Threat Model](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats)
- [OWASP Threat Modeling](https://owasp.org/www-community/Threat_Modeling)
- [OWASP Security Analysis (this project)](OWASP-SECURITY-ANALYSIS.md)
- [OWASP Top 10 (2021)](https://owasp.org/Top10/)
- [Neo4j Security Configuration](https://neo4j.com/docs/operations-manual/current/security/)
- [Entra ID Token Validation Best Practices](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens)
