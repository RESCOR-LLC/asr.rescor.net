# Replication Log (ASR ↔ Testing Center)

Purpose: track intentional temporary duplication from Testing Center into ASR.

## Entry Format
- **ASR target**: file path in this repo
- **Source**: file path in `testingcenter.rescor.net`
- **Why replicated**: short reason
- **Abstraction candidate**: proposed shared package/module
- **Status**: replicated | diverged | extracted

---

## 2026-02-19

### Theme baseline
- **ASR target**: `frontend/src/theme/createAsrTheme.js`
- **Source**: `testingcenter.rescor.net/src/frontend/src/App.jsx` (theme block)
- **Why replicated**: align visual tokens and typography while ASR UI is bootstrapped
- **Abstraction candidate**: shared frontend design tokens package (e.g. `@rescor/ui-theme`)
- **Status**: replicated

### Dialog style helpers
- **ASR target**: `frontend/src/replicated/testingcenter/dialogStyles.js`
- **Source**: `testingcenter.rescor.net/src/frontend/src/utils/dialogStyles.js`
- **Why replicated**: maintain consistent MUI dialog behavior in dark/light contexts
- **Abstraction candidate**: shared UI utility package (e.g. `@rescor/ui-utils`)
- **Status**: replicated

### Threat table behavior replacement
- **ASR target**: `frontend/src/components/asr/ThreatRegistryTable.jsx`
- **Source**: legacy `asrRisk.html` + DataTables behavior and Testing Center list/table interaction patterns
- **Why replicated**: remove jQuery/DataTables and rebuild in React/MUI while preserving filter/sort/pagination workflow
- **Abstraction candidate**: shared table pattern/hooks package for risk workflows
- **Status**: replicated

### Core error model usage
- **ASR target**: `frontend/src/domain/validateThreatFilter.js`
- **Source**: `@rescor/core-utils/errors` (`ValidationError`)
- **Why replicated**: keep validation and error contracts aligned with core conventions
- **Abstraction candidate**: shared risk-domain validation package
- **Status**: replicated

### Loss expectancy domain formulas
- **ASR target**: `frontend/src/domain/lossExpectancy.js`
- **Source**: ASR baseline formula definition (`A/T/V/C`, `SLE`, `DLE`)
- **Why replicated**: establish canonical, testable React-domain implementation of legacy risk math
- **Abstraction candidate**: shared risk-model package for ASR/Testing Center successors
- **Status**: replicated

### STORM/RSK transform module
- **ASR target**: `frontend/src/domain/stormRsk.js`
- **Source**: `legacy/files/STORM.js`, `legacy/files/asrRisk.js`, `testingcenter.rescor.net/src/frontend/src/components/tests/utils/storm.js`
- **Why replicated**: isolate diminishing-returns and process transforms (`A`, `T`, `C`, `V`) into a standalone module with no jQuery dependency
- **Abstraction candidate**: core/shared risk transform package (candidate: `@rescor/core-risk`)
- **Status**: replicated

### Asset share semantics
- **ASR target**: `frontend/src/domain/stormRsk.js` (`computeAssetShareA`)
- **Source**: STORM operating model note that `A` is represented as share of total asset portfolio
- **Why replicated**: ensure `A` aligns with residual-risk formulas using normalized portfolio share values
- **Abstraction candidate**: shared portfolio valuation utility in a future core risk package
- **Status**: replicated

### Linked risk graph generation
- **ASR target**: `frontend/src/domain/riskGraph.js` + `frontend/src/components/asr/LinkedRiskTable.jsx`
- **Source**: ASR modeling direction for many-to-many A/T/V relationships and scoped control applicability
- **Why replicated**: prevent full Cartesian risk expansion and support practical link-constrained residual risk generation
- **Abstraction candidate**: shared risk-graph engine in a future core risk package
- **Status**: replicated

### Link editor interaction model
- **ASR target**: `frontend/src/components/asr/LinkEditor.jsx`
- **Source**: ASR modeling direction for user-managed constrained links
- **Why replicated**: provide direct interactive management of link graph relationships used by constrained risk generation
- **Abstraction candidate**: shared risk-link editor component package
- **Status**: replicated

### Theme mode toggling with contrast overrides
- **ASR target**: `frontend/src/theme/createAsrTheme.js` + `frontend/src/components/layout/AppShell.jsx`
- **Source**: Testing Center theming baseline with ASR-specific contrast hardening
- **Why replicated**: ensure robust dark/light readability while migration remains in a standalone ASR frontend
- **Abstraction candidate**: shared UI theme tokens and color-mode utilities package
- **Status**: replicated

### Graph persistence controls
- **ASR target**: `frontend/src/domain/graphPersistence.js` + `frontend/src/components/asr/LinkEditor.jsx` + `frontend/src/App.jsx`
- **Source**: ASR migration requirement for stable link graph iteration across sessions
- **Why replicated**: persist constrained-link graph with relational-compatible JSON semantics while backend graph service work is deferred
- **Abstraction candidate**: shared persistence adapter that can target local storage, relational DB, and Neo4j
- **Status**: replicated

### Relational graph API contract
- **ASR target**: `api/src/server.mjs` + `frontend/src/services/graphApiClient.js`
- **Source**: ASR migration requirement to move from browser-only persistence to service-backed persistence
- **Why replicated**: provide immediate API-first `GET/PUT /asr/graph` contract backed by SQLite while keeping a future Neo4j migration path open
- **Abstraction candidate**: shared graph repository interface with relational and graph-database adapters
- **Status**: replicated

### Core module backend integration
- **ASR target**: `api/src/db/SqliteCoreDbOperations.mjs` + `api/src/server.mjs` + `api/scripts/vitalsigns.mjs`
- **Source**: project standardization on `@rescor/core-db` and `@rescor/core-utils` orchestration/logging
- **Why replicated**: enforce core-db operation abstraction, Recorder-based logging, and VitalSigns lifecycle management even in the minimal ASR API
- **Abstraction candidate**: shared API service bootstrap package for core-db + recorder + vitalsigns conventions
- **Status**: replicated

### DB adapter factory (sqlite + db2)
- **ASR target**: `api/src/db/createOperations.mjs` + `api/src/db/GraphStoreRepository.mjs` + `api/migrations/db2/*`
- **Source**: requirement for config-driven relational adapter switching without API route changes
- **Why replicated**: add DB2 adapter stub through `@rescor/core-db` while retaining SQLite default path
- **Abstraction candidate**: shared database adapter registry for service templates
- **Status**: replicated
