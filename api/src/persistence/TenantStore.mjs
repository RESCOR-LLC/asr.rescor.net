// ════════════════════════════════════════════════════════════════════
// TenantStore — tenant lifecycle management
// ════════════════════════════════════════════════════════════════════

export class TenantStore {
  constructor(database) {
    this.database = database;
  }

  /**
   * Provision a new tenant:
   * 1. MERGE Tenant node
   * 2. Clone default ScoringConfig for the tenant
   * 3. Clone the active Questionnaire's current snapshot for the tenant
   */
  async createTenant({ tenantId, name, domain }) {
    const now = new Date().toISOString();

    // 1. Tenant node
    await this.database.query(
      `MERGE (t:Tenant {tenantId: $tenantId})
       SET t.name    = $name,
           t.domain  = $domain,
           t.active  = true,
           t.created = $now`,
      { tenantId, name, domain: domain || null, now }
    );

    // 2. Clone ScoringConfig from default — idempotent via MERGE
    await this.database.query(
      `MATCH (src:ScoringConfig {configId: 'default'})
       MERGE (dst:ScoringConfig {tenantId: $tenantId})
       ON CREATE SET dst.dampingFactor    = src.dampingFactor,
                     dst.rawMax           = src.rawMax,
                     dst.ratingThresholds = src.ratingThresholds,
                     dst.ratingLabels     = src.ratingLabels,
                     dst.configId         = $tenantId`,
      { tenantId }
    );

    // 3. Clone current QuestionnaireSnapshot — idempotent via MERGE
    await this.database.query(
      `MATCH (q:Questionnaire {active: true})-[:CURRENT_VERSION]->(snap:QuestionnaireSnapshot)
       MERGE (copy:QuestionnaireSnapshot {version: snap.version, tenantId: $tenantId})
       ON CREATE SET copy.label   = snap.label,
                     copy.data    = snap.data,
                     copy.created = snap.created`,
      { tenantId }
    );
  }

  /**
   * List all tenants with user counts.
   */
  async listTenants() {
    const rows = await this.database.query(
      `MATCH (t:Tenant)
       OPTIONAL MATCH (u:User)-[:BELONGS_TO]->(t)
       RETURN t.tenantId AS tenantId,
              t.name     AS name,
              t.domain   AS domain,
              t.active   AS active,
              t.created  AS created,
              count(u)   AS userCount
       ORDER BY t.name`
    );

    return rows.map((row) => ({
      tenantId:  row.tenantId,
      name:      row.name,
      domain:    row.domain,
      active:    row.active,
      created:   row.created,
      userCount: typeof row.userCount === 'object' && row.userCount?.toNumber
        ? row.userCount.toNumber()
        : Number(row.userCount ?? 0),
    }));
  }

  /**
   * Soft-delete a tenant.  Reviews and data are preserved.
   */
  async deactivateTenant(tenantId) {
    const result = await this.database.query(
      `MATCH (t:Tenant {tenantId: $tenantId})
       SET t.active = false
       RETURN t`,
      { tenantId }
    );

    return result.length > 0 ? (result[0].t || result[0]) : null;
  }

  /**
   * Hard purge all data for a tenant:
   *   1. Delete Reviews and all child nodes (Answers, ProposedChanges,
   *      AuditorComments, Remediations, GateDecisions) + relationships
   *   2. Delete tenant-scoped ScoringConfig
   *   3. Delete tenant-scoped QuestionnaireSnapshots
   *   4. Delete tenant-scoped ComplianceTagConfig
   *   5. Delete Users belonging to the tenant
   *   6. Delete AuditEvent / AuthEvent nodes tied to the tenant
   *   7. Delete the Tenant node itself
   *
   * Returns { deleted: true, counts } or null if tenant not found.
   * CAUTION: irreversible — caller must verify authorization and intent.
   */
  async purgeTenant(tenantId) {
    const tenantCheck = await this.database.query(
      `MATCH (t:Tenant {tenantId: $tenantId}) RETURN t.name AS name`,
      { tenantId },
    );
    if (tenantCheck.length === 0) return null;

    // 1. Reviews + all child nodes
    const reviewResult = await this.database.query(
      `MATCH (r:Review)-[:SCOPED_TO]->(:Tenant {tenantId: $tenantId})
       OPTIONAL MATCH (r)-[*1..2]->(child)
       DETACH DELETE child, r
       RETURN count(DISTINCT r) AS reviewsDeleted`,
      { tenantId },
    );

    // 2. ScoringConfig
    await this.database.query(
      `MATCH (sc:ScoringConfig {tenantId: $tenantId}) DETACH DELETE sc`,
      { tenantId },
    );

    // 3. QuestionnaireSnapshots
    await this.database.query(
      `MATCH (qs:QuestionnaireSnapshot {tenantId: $tenantId}) DETACH DELETE qs`,
      { tenantId },
    );

    // 4. ComplianceTagConfig
    await this.database.query(
      `MATCH (ctc:ComplianceTagConfig {tenantId: $tenantId}) DETACH DELETE ctc`,
      { tenantId },
    );

    // 5. Users
    const userResult = await this.database.query(
      `MATCH (u:User)-[:BELONGS_TO]->(:Tenant {tenantId: $tenantId})
       OPTIONAL MATCH (u)-[rel]-()
       DELETE rel, u
       RETURN count(DISTINCT u) AS usersDeleted`,
      { tenantId },
    );

    // 6. AuditEvent + AuthEvent
    await this.database.query(
      `MATCH (ae:AuditEvent {tenantId: $tenantId}) DETACH DELETE ae`,
      { tenantId },
    );
    await this.database.query(
      `MATCH (ae:AuthEvent {tenantId: $tenantId}) DETACH DELETE ae`,
      { tenantId },
    );

    // 7. Tenant node
    await this.database.query(
      `MATCH (t:Tenant {tenantId: $tenantId}) DETACH DELETE t`,
      { tenantId },
    );

    const reviewsDeleted = reviewResult[0]?.reviewsDeleted;
    const usersDeleted = userResult[0]?.usersDeleted;

    return {
      deleted: true,
      counts: {
        reviews: typeof reviewsDeleted?.toNumber === 'function' ? reviewsDeleted.toNumber() : Number(reviewsDeleted ?? 0),
        users: typeof usersDeleted?.toNumber === 'function' ? usersDeleted.toNumber() : Number(usersDeleted ?? 0),
      },
    };
  }
}
