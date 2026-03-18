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
export async function verifyReviewTenant(database, reviewId, tenantId, isAdmin) {
  let answer = null;

  if (isAdmin) {
    answer = reviewId;
  } else {
    const result = await database.query(
      `MATCH (review:Review {reviewId: $reviewId})-[:SCOPED_TO]->(tenant:Tenant {tenantId: $tenantId})
       RETURN review.reviewId AS reviewId`,
      { reviewId, tenantId }
    );
    answer = result.length > 0 ? result[0].reviewId : null;
  }

  return answer;
}
