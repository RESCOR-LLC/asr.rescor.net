// ════════════════════════════════════════════════════════════════════
// Authorization Middleware — RBAC role check
// ════════════════════════════════════════════════════════════════════

let _recorder = null;
let _auditEventStore = null;

export function initializeAuthorization({ recorder, auditEventStore }) {
  _recorder = recorder;
  _auditEventStore = auditEventStore;
}

export function authorize(...requiredRoles) {
  return function checkAuthorization(request, response, next) {
    const userRoles = request.user?.roles || [];
    const isAdmin = userRoles.includes('admin');
    const hasRequiredRole = requiredRoles.some((role) => userRoles.includes(role));

    if (isAdmin || hasRequiredRole) {
      next();
      return;
    }

    _recorder?.emit(9010, 'w', 'Authorization denied: insufficient roles', {
      sub: request.user?.sub,
      tenantId: request.user?.tenantId,
      required: requiredRoles,
      actual: userRoles,
      path: request.path,
      method: request.method,
    });

    _auditEventStore?.logEvent({
      tenantId: request.user?.tenantId,
      sub: request.user?.sub,
      action: 'authorization.denied',
      resourceType: 'route',
      resourceId: `${request.method} ${request.path}`,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      meta: { requiredRoles, userRoles },
    });

    response.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      },
    });
  };
}

export function requireOwnershipOrAdmin(database) {
  return async function checkOwnership(request, response, next) {
    const userRoles = request.user?.roles || [];

    if (userRoles.includes('admin')) {
      next();
      return;
    }

    const reviewId = request.params.reviewId;
    if (!reviewId) {
      response.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing reviewId' } });
      return;
    }

    try {
      const tenantId = request.user?.tenantId || null;
      const result = await database.query(
        `MATCH (review:Review {reviewId: $reviewId})-[:SCOPED_TO]->(:Tenant {tenantId: $tenantId})
         RETURN review.createdBy AS createdBy`,
        { reviewId, tenantId }
      );

      if (result.length === 0) {
        response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Review not found' } });
        return;
      }

      const createdBy = result[0].createdBy;
      const username = request.user?.preferred_username;

      if (createdBy === username) {
        next();
        return;
      }

      _recorder?.emit(9011, 'w', 'Authorization denied: not review owner', {
        sub: request.user?.sub,
        reviewId,
        tenantId,
      });

      _auditEventStore?.logEvent({
        tenantId,
        sub: request.user?.sub,
        action: 'authorization.ownership_denied',
        resourceType: 'review',
        resourceId: reviewId,
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      });

      response.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not own this review' },
      });
    } catch (error) {
      _recorder?.emit(9012, 'e', 'Ownership check failed', { error: error.message });
      response.status(500).json({ error: 'Internal server error' });
    }
  };
}
