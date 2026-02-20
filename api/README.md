# ASR Graph API (Relational Track)

Minimal service implementing the graph persistence contract:

- `GET /asr/graph`
- `PUT /asr/graph`

Current backing store is SQLite (`asr_graph_store` table) to stay on the relational path.

Implementation conventions:

- Database operations flow through `@rescor/core-db` abstractions.
- Operational logging uses `Recorder` from `@rescor/core-utils`.
- Service lifecycle orchestration uses `VitalSigns` from `@rescor/core-utils`.

## Run

```bash
cd api
npm install
npm run migrate
npm run start
```

`npm run start` and `npm run dev` both run migrations automatically before boot.

## Migrations

SQL migrations live in `migrations/`:

- `sqlite/001_create_asr_graph_store.sql` (DDL)
- `sqlite/002_seed_asr_graph_store.sql` (seed row)
- `db2/001_create_asr_graph_store.sql` (DDL)
- `db2/002_seed_asr_graph_store.sql` (seed row)

Apply manually:

```bash
cd api
npm run migrate
```

## VitalSigns lifecycle

```bash
cd api
npm run vitals:start
npm run vitals:status
npm run vitals:status -- --verbose
npm run vitals:stop
npm run vitals:force
```

`vitals:start` runs migrations before spawning the API process.
`vitals:status -- --verbose` prints active adapter and masked DB target diagnostics.

Optional environment variables:

- `ASR_DB_ADAPTER` (`sqlite` default, `db2` optional)
- `ASR_API_PORT` (default `5180`)
- `ASR_SQLITE_PATH` (default `./asr.db`)
- `ASR_DB2_CONNECTION_STRING` (preferred when `ASR_DB_ADAPTER=db2`)
- `ASR_DB2_SCHEMA` (default `ASRDEV`)
- `ASR_DB2_HOST`, `ASR_DB2_PORT`, `ASR_DB2_DATABASE`, `ASR_DB2_USER`, `ASR_DB2_PASSWORD` (used if connection string not provided)

## Contract

### GET `/asr/graph`
- `200` with `{ success, data: { graph, updatedAt } }`
- `404` with `{ success: false, code: 'ASR_GRAPH_NOT_FOUND' }` only if table exists but row has not been seeded

### PUT `/asr/graph`
Request body:

```json
{
  "graph": { "...": "current graph payload" }
}
```

Response:
- `200` with `{ success, data: { updatedAt } }`
- `400` with `{ success: false, code: 'ASR_GRAPH_INVALID_PAYLOAD' }` for invalid shape
