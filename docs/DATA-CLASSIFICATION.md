# Data Classification — ASR Platform

**Date:** 2026-03-21
**Purpose:** Satisfy OWASP A02 (Cryptographic Failures) sensitive-data classification requirements.
**Scope:** All data types stored in the ASR platform's Neo4j database.

---

## Classification Levels

| Level          | Definition                                                        |
|----------------|-------------------------------------------------------------------|
| **RESTRICTED** | Credentials, key material, PII enabling identity theft            |
| **CONFIDENTIAL** | Assessment data, risk scores, audit trails containing IP addresses |
| **INTERNAL**   | Configuration, scoring parameters, questionnaire templates        |
| **PUBLIC**     | None — all data is behind authentication                          |

---

## Node-Level Classification

| Neo4j Node Label          | Classification   | Rationale                                                    |
|---------------------------|------------------|--------------------------------------------------------------|
| User                      | RESTRICTED       | Contains Entra ID subject, email, display name (PII)        |
| ServiceAccount            | RESTRICTED       | Contains SHA-256 API key hash and role grants                |
| AuthEvent                 | CONFIDENTIAL     | Login trail with IP address, user agent, outcome/reason      |
| AuditEvent                | CONFIDENTIAL     | Mutation trail with IP address, user agent, subject ID       |
| Review                    | CONFIDENTIAL     | Risk scores (rskRaw, rskNormalized), rating, assessor name  |
| Answer                    | CONFIDENTIAL     | Assessment responses linked to specific reviews              |
| ProposedChange            | CONFIDENTIAL     | Remediation proposals revealing control gaps                 |
| AuditorComment            | CONFIDENTIAL     | Auditor notes with author attribution                        |
| Remediation               | CONFIDENTIAL     | Remediation status, assignee, notes on control deficiencies  |
| GateDecision              | CONFIDENTIAL     | Functional gating answers with decidedBy attribution         |
| Tenant                    | INTERNAL         | Tenant metadata (name, domain, status); no secrets           |
| ScoringConfig             | INTERNAL         | Scoring parameters (damping, thresholds, labels)             |
| ComplianceTagConfig       | INTERNAL         | Compliance tag display configuration                         |
| WeightTier                | INTERNAL         | Scoring weight tier values                                   |
| ClassificationChoice      | INTERNAL         | Classification factor choices and multipliers                |
| Question                  | INTERNAL         | Assessment question text and choice scores                   |
| Domain                    | INTERNAL         | Assessment domain groupings                                  |
| Questionnaire             | INTERNAL         | Active questionnaire definition                              |
| QuestionnaireSnapshot     | INTERNAL         | Historical questionnaire versions                            |
| QuestionnaireDraft        | INTERNAL         | Draft questionnaire edits                                    |
| DeploymentArchetype       | INTERNAL         | Deployment taxonomy reference data                           |
| ComplianceSource          | INTERNAL         | Compliance source reference data                             |

---

## PII Inventory

| Field               | Node(s)              | PII Type              | Notes                              |
|---------------------|----------------------|-----------------------|------------------------------------|
| email               | User                 | Direct identifier     | Entra ID email address             |
| preferred_username  | User                 | Direct identifier     | Entra ID username (often email)    |
| displayName         | User                 | Direct identifier     | Full name from Entra ID            |
| sub                 | User, AuditEvent     | Pseudonymous ID       | Entra ID subject GUID              |
| assessor            | Review               | Direct identifier     | Name of person conducting review   |
| author              | AuditorComment       | Direct identifier     | Name of commenting auditor         |
| decidedBy           | GateDecision         | Direct identifier     | Name of gate decision maker        |
| assignee            | Remediation          | Direct identifier     | Person assigned to remediation     |
| ipAddress           | AuthEvent, AuditEvent| Indirect identifier   | Client IP from request headers     |
| userAgent           | AuthEvent, AuditEvent| Indirect identifier   | Browser/client fingerprint string  |

---

## Retention Policies

| Data Type       | Retention          | Mechanism                                  |
|-----------------|--------------------|--------------------------------------------|
| AuthEvent       | 90 days            | APOC TTL automatic purge (`ttl` property)  |
| AuditEvent      | 90 days            | APOC TTL automatic purge (`ttl` property)  |
| User            | Tenant lifetime    | Removed on tenant hard-purge               |
| ServiceAccount  | Tenant lifetime    | Removed on tenant hard-purge               |
| Review + children| Tenant lifetime   | Removed on tenant hard-purge               |
| Tenant          | Until offboarding  | Hard-purge endpoint deletes all tenant data |
| Config nodes    | Indefinite         | Global scoring/template data; no PII       |

---

## Controls Summary

- **At rest:** Neo4j filesystem encryption available (see `docs/ENCRYPTION-AT-REST.md`)
- **In transit:** TLS enforced on Bolt (`bolt+s://`) and HTTPS for all API traffic
- **Access control:** Entra ID JWT + RBAC; tenant-scoped isolation prevents cross-tenant reads
- **Credential storage:** API keys stored as SHA-256 hashes only; no plaintext persistence
- **Audit coverage:** All authentication attempts (AuthEvent) and data mutations (AuditEvent) logged
