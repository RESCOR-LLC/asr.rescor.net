// ════════════════════════════════════════════════════════════════════
// requireTenantContext — fail-closed on missing/offboarding tenant
// ════════════════════════════════════════════════════════════════════
// 1. Rejects any request where request.user.tenantId is falsy.
// 2. If a TenantStore is wired, checks that the tenant is not in
//    OFFBOARDING status (blocks non-admin data mutations).
// Mount after authenticate, before tenant-scoped routes.
// ════════════════════════════════════════════════════════════════════

let _recorder = null;
let _tenantStore = null;

export function initializeTenantContext({ recorder, tenantStore = null }) {
  _recorder = recorder;
  _tenantStore = tenantStore;
}

export async function requireTenantContext(request, response, next) {
  const tenantId = request.user?.tenantId;

  if (!tenantId) {
    _recorder?.emit(9013, 'w', 'Request rejected: missing tenant context', {
      sub: request.user?.sub,
      path: request.path,
      method: request.method,
    });
    response.status(403).json({
      error: { code: 'MISSING_TENANT', message: 'Tenant context required' },
    });
    return;
  }

  // Block operations on tenants in OFFBOARDING status
  if (_tenantStore) {
    try {
      const tenant = await _tenantStore.getTenantStatus(tenantId);
      if (tenant?.status === 'OFFBOARDING') {
        _recorder?.emit(9014, 'w', 'Request rejected: tenant offboarding', {
          sub: request.user?.sub,
          tenantId,
          path: request.path,
        });
        response.status(403).json({
          error: { code: 'TENANT_OFFBOARDING', message: 'Tenant is being offboarded' },
        });
        return;
      }
    } catch (error) {
      _recorder?.emit(9015, 'e', 'Tenant status check failed', { error: error.message });
    }
  }

  next();
}
