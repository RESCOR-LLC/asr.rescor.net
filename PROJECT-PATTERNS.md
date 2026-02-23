# ASR Project Patterns

**Last Updated**: 2026-02-22

This document defines the official patterns and tooling for ASR.

---

## Official Tooling

### The `rescor` CLI

**The `rescor` CLI is the OFFICIAL way to manage all ASR operations.**

```bash
# Verify CLI is available
rescor --version

# Auto-loads .env from asr.rescor.net/.env
cd asr.rescor.net
rescor env validate --template .env.example
```

---

## Quick Reference

### Environment Management

```bash
# Deploy .env from template
rescor env deploy asr.rescor.net

# Validate .env
rescor env validate asr.rescor.net --template .env.example

# List variables
rescor env list --project asr.rescor.net
```

---

## DB2 Patterns

### GENERATED ALWAYS AS IDENTITY
ASR schema tables use `GENERATED ALWAYS AS IDENTITY` for PKs.
- **NEVER** include `id` in INSERT column list — DB2 raises SQL0798N

### SELECT FROM FINAL TABLE (preferred)
Retrieve inserted/updated row atomically in a single query:

```sql
SELECT *
FROM FINAL TABLE (
    INSERT INTO schema.TABLE (col1, col2) VALUES (val1, val2)
);
```

```javascript
const rows = await handle.query(
  `SELECT * FROM FINAL TABLE (
      INSERT INTO ${schema}.TABLE (COL1, COL2) VALUES (?, ?)
  )`,
  [val1, val2]
);
return rows[0];
```

Works for UPDATE too:
```sql
SELECT *
FROM FINAL TABLE (
    UPDATE schema.TABLE SET col = ? WHERE id = ?
);
```

Rules:
- Prefer this over post-write follow-up SELECT calls
- Do not send explicit `ID` values to auto-generating PK tables
- Let DB2 generate PK/default values and return authoritative row data via FINAL TABLE

### Null Guards for Numeric IDs
Use `id == null` not `!id` — avoids rejecting valid ID `0`.

---

## Complete Patterns

See **[core.rescor.net/docs/PROJECT-PATTERNS.md](../core.rescor.net/docs/PROJECT-PATTERNS.md)** for complete documentation on:
- All `rescor` CLI commands
- Database naming conventions
- Security principles
- Workflow examples

---

## References

- [Core Project Patterns](../core.rescor.net/docs/PROJECT-PATTERNS.md)
- [CLI Reference](../core.rescor.net/docs/CLI-REFERENCE.md)
- [ENV Normalization](../core.rescor.net/docs/ENV-NORMALIZATION.md)
