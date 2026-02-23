# ASR Session Handoff — 2026-02-20

## Current Runtime State
- Frontend is running on `http://localhost:5174`
- API is running on `http://localhost:5180`
- API health endpoint: `http://localhost:5180/health`
- Verified listeners on ports `5174` and `5180`.

## What Was Completed
- React ASR frontend scaffolded and wired to relational-first graph persistence.
- Graph API implemented (`GET/PUT /asr/graph`) with SQLite default path.
- Core integrations added:
  - `@rescor/core-db` for DB operations abstraction
  - `@rescor/core-utils` `Recorder` for logging
  - `VitalSigns` lifecycle orchestration in API scripts
- Adapter factory added for DB selection via env:
  - `ASR_DB_ADAPTER=sqlite` (default)
  - `ASR_DB_ADAPTER=db2` (stub path wired via core-db `DB2Operations`)
- Migrations split by adapter:
  - `api/migrations/sqlite/*`
  - `api/migrations/db2/*`
- UI delivered:
  - Link editor for constrained A↔T↔V graph relationships
  - Dark/light mode toggle with contrast-safe overrides
  - Tabbed entity tables (assets, threats, vulnerabilities, controls)
  - Inline editing for names + percentage fields
  - Row-level percentage validation hints (`0..100`)
  - HAM533 workbench with discrete sliders for `History (1..5)`, `Access (1..3)`, `Means (1..3)`
    and live `Probability` + `Impact` recomputation.
- Probability UX normalized everywhere to percentage display with two decimals; internal math remains `0..1`.

## Validation Snapshot
- Frontend tests: passing (`npm test`)
- Frontend build: passing (`npm run build`)
- Parity check: passing (`npm run parity:check`)
- API migration + vitals lifecycle validated in sqlite mode.

## Key Files Added/Updated Recently
- `frontend/src/components/asr/Ham533Workbench.jsx`
- `frontend/src/components/asr/RiskEntityTabs.jsx`
- `frontend/src/domain/probabilityFormat.js`
- `frontend/src/domain/probabilityFormat.test.js`
- `frontend/src/App.jsx`
- `frontend/src/data/mockRiskGraph.js`
- `api/src/server.mjs`
- `api/src/db/createOperations.mjs`
- `api/src/db/GraphStoreRepository.mjs`
- `api/src/db/SqliteCoreDbOperations.mjs`
- `api/scripts/vitalsigns.mjs`
- `api/scripts/apply-migrations.mjs`
- `api/migrations/sqlite/*`
- `api/migrations/db2/*`
- `api/README.md`
- `docs/ASR-MIGRATION-PLAN.md`
- `docs/REPLICATION-LOG.md`

## Resume Checklist (Next Session)
1. Confirm stack status:
   - `cd frontend && npm run stack:status`
   - `cd ../api && npm run vitals:status -- --verbose`
2. Open frontend at `http://localhost:5174` and validate HAM533 interactions manually.
3. If desired next step: add category + add/delete threat actions in HAM533 workbench to mirror reference workflow more closely.
4. Optional ops enhancement: `status --json --verbose` output for automation.

## Notes
- The current implementation intentionally stays relational-first while preserving a clean path to Neo4j later.
- No legacy `asr.rescor.net/legacy/` files were modified.
