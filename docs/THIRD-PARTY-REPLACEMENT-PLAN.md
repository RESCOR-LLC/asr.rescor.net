# Third-Party Replacement Plan (Legacy → React/MUI)

## Objective
Eliminate direct dependency on legacy browser-era libraries in `legacy/files/` for the modern ASR interface.

## Legacy Libraries to Retire from Modern UI
- `jquery-3.js`
- `jquery-ui.js` / `jquery-ui.css`
- `datatables.js` / `datatables.css`

## Replacement Mapping
- jQuery DOM mutation/event wiring → React state + event handlers
- jQuery UI sliders/tabs/widgets → MUI components (`Tabs`, `Slider`, `Checkbox`, etc.)
- DataTables listing/filter/sort/page → MUI `Table` + `TableSortLabel` + `TablePagination`

## Current Implementation Status
- ASR modern frontend now has `ThreatRegistryTable` using React/MUI behavior instead of DataTables.
- Legacy remains available only as a parity reference (`legacy/asrRisk.html`).

## Core Package Usage Rule
Use `@rescor/core-*` for shared operational logic when applicable.
- Implemented: `frontend/src/domain/validateThreatFilter.js` imports `ValidationError` from `@rescor/core-utils/errors`.
- Future: move risk model calculators to shared core package once cross-project domain contracts stabilize.
