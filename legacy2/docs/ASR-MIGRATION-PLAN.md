# ASR Migration Plan

## Vision
Build ASR as a React/MUI adjunct to Testing Center while retaining STORM-specific risk model depth.

## Functional Areas to Preserve
- Asset valuation (A)
- Threat probability/impact (T)
- Vulnerability exposure (V)
- Control efficacy (C)
- Risk aggregation views (DLE/SLE)

## Formula Baseline
- `SLE = A * 1 * V * (1 - C)` (threat treated as certain)
- `DLE = A * T * V * (1 - C)`

Where:
- `A` = asset share of portfolio value (e.g., `10,000 / 1,000,000 = 0.01`)
- `T` = threat probability
- `V` = vulnerability severity (Testing Center-aligned display concept)
- `C` = control efficacy

### IAP Notes
- `A`, `T`, `V`, and `C` are modeled as Independent Ancillary Processes (IAP transforms).
- `T` currently includes HAM533 semantics (`history[1..5]`, `access[1..3]`, `means[1..3]`).
- `V` currently supports CRVE3 transform semantics and remains open to CVSS-adaptation variants.
- `A` asset-valuation IAPs remain an active design area (CCP and related patterns under review).

## STORM/RSK Module Boundary
- Dedicated module: `frontend/src/domain/stormRsk.js`
- Contains legacy-consistent transforms for:
	- `A` (asset valuation transform)
	- `T` (HAM533 probability/impact transform)
	- `C` (SCEP effective remediation + diminishing-returns aggregate)
	- `V` (CRVE3 exposure transform)
- Contains shared diminishing-returns primitives used by Testing Center and legacy STORM semantics.

## Characterization Test Strategy
- Legacy-shaped scenarios are captured as characterization fixtures, not immutable product requirements.
- Current pinned outputs protect against accidental regressions while migration is active.
- As target behavior evolves, update fixture expectations intentionally with migration notes.

### Parity Snapshot Commands
- Generate/update snapshot: `cd frontend && npm run parity:report`
- Verify no drift: `cd frontend && npm run parity:check`
- Snapshot artifact: `frontend/reports/legacy-parity-report.json`

## Phased Delivery

### Phase 1 — Foundation (in progress)
- Create modern frontend shell (`frontend/`).
- Mirror Testing Center theme/conventions where useful.
- Add replication ledger for future extraction planning.
- Keep legacy UI available for behavior comparison.

### Phase 2 — Domain Modeling
- Extract typed domain model from legacy STORM/StackMap behavior.
- Define pure calculation utilities for A/T/V/C and risk aggregation.
- Add focused unit tests for calculations before major UI migration.

### Phase 3 — Feature Parity UI
- Rebuild ASR tabs/workflow in React components.
- Integrate DataGrid/table equivalents for threat/vulnerability/risk views.
- Add import/export model persistence behavior.

### Current Linking Baseline
- A first-pass link model now constrains risk generation to valid links:
	- `assetThreat`
	- `assetVulnerability`
	- `threatVulnerability`
- Controls can apply by asset, threat, vulnerability, or explicit threat-vulnerability pair.
- This replaces naive Cartesian combination generation in the modern ASR baseline UI.
- UI now includes an interactive link editor for maintaining these relationships directly in React/MUI.
- Theme mode now supports light/dark toggling with explicit contrast-safe palette overrides for text, tables, and surfaces.
- Link graph persistence currently uses relational-compatible JSON storage semantics (browser `localStorage` + JSON import/export) to keep implementation aligned with the current stack.

### Future Graph Storage Track
- Neo4j is a planned service for advanced relationship querying and graph-native traversals.
- Until that service track starts, the active implementation remains relational-first with explicit link tables and JSON graph portability.
- API contract is now active in ASR: `GET /asr/graph` and `PUT /asr/graph` (SQLite-backed reference service).
- Frontend persistence is API-first with browser-local fallback when the service is unavailable.
- API backend now uses `@rescor/core-db` operation abstractions and `@rescor/core-utils` Recorder + VitalSigns lifecycle orchestration.
- API backend now includes a DB2 adapter stub behind the same repository contract (`ASR_DB_ADAPTER=db2`) to enable config-only adapter switching.

### Phase 4 — Convergence
- Compare ASR and Testing Center replications.
- Extract common UI and utility modules into shared packages.
- Replace duplicated code with shared imports.
