// ════════════════════════════════════════════════════════════════════
// ReviewStore — persistence helpers for Review access control
// ════════════════════════════════════════════════════════════════════

/**
 * Verify that a review belongs to the given tenant.
 *
 * Admins bypass the check (all reviews are accessible).
 * Non-admins receive null when the review does not exist OR belongs
 * to a different tenant — callers MUST respond 404 in both cases to
 * prevent cross-tenant enumeration.
 *
 * @param {object}  database  - SessionPerQueryWrapper instance
 * @param {string}  reviewId  - review UUID to check
 * @param {string}  tenantId  - tenant from request.user.tenantId
 * @param {boolean} isAdmin   - true if user holds the admin role
 * @returns {Promise<string|null>} reviewId when access is permitted, null otherwise
 */
export async function verifyReviewTenant(database, reviewId, tenantId, isAdmin, auditContext = null) {
  let answer = null;

  if (isAdmin) {
    answer = reviewId;
  } else {
    // Single query: detect whether the review exists at all vs. belongs to a different tenant.
    // The distinction is never leaked to callers (both yield null → 404), but informs audit logging.
    const result = await database.query(
      `MATCH (review:Review {reviewId: $reviewId})
       OPTIONAL MATCH (review)-[:SCOPED_TO]->(tenant:Tenant {tenantId: $tenantId})
       RETURN review.reviewId AS reviewId, tenant.tenantId AS matchedTenant`,
      { reviewId, tenantId }
    );

    if (result.length > 0) {
      if (result[0].matchedTenant !== null) {
        answer = result[0].reviewId;
      } else if (auditContext?.auditEventStore) {
        // Review exists but belongs to a different tenant — fire audit event, still return null
        auditContext.auditEventStore.logEvent({
          tenantId:     tenantId || null,
          sub:          auditContext.sub || null,
          action:       'review.cross_tenant_attempt',
          resourceType: 'Review',
          resourceId:   reviewId,
          ipAddress:    auditContext.ipAddress || null,
          userAgent:    auditContext.userAgent || null,
        });
      }
    }
    // result.length === 0: review does not exist — answer remains null, no audit event
  }

  return answer;
}
