// ════════════════════════════════════════════════════════════════════
// ASR API Server
// ════════════════════════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Recorder } from '@rescor-llc/core-utils';
import { createConfiguration, createDatabase } from './database.mjs';
import { createConfigRouter } from './routes/config.mjs';
import { createReviewsRouter } from './routes/reviews.mjs';
import { createAnswersRouter } from './routes/answers.mjs';
import { createProposedChangesRouter } from './routes/proposedChanges.mjs';
import { createAuditorCommentsRouter } from './routes/auditorComments.mjs';
import { createAdminRouter } from './routes/admin.mjs';
import { createRemediationRouter } from './routes/remediation.mjs';
import { createQuestionnaireAdminRouter } from './routes/questionnaireAdmin.mjs';
import { createGateRouter } from './routes/gates.mjs';
import { createExportRouter } from './routes/exportDocuments.mjs';
import { StormService } from './StormService.mjs';
import { createAuthenticationMiddleware } from './middleware/authenticate.mjs';
import { authorize, initializeAuthorization } from './middleware/authorize.mjs';
import { authLimiter, apiLimiter } from './middleware/rateLimiter.mjs';
import { UserStore } from './persistence/UserStore.mjs';
import { AuthEventStore } from './persistence/AuthEventStore.mjs';
import { AuditEventStore } from './persistence/AuditEventStore.mjs';
import { TenantStore } from './persistence/TenantStore.mjs';
import { ServiceAccountStore } from './persistence/ServiceAccountStore.mjs';
import { createServiceAccountRouter } from './routes/serviceAccounts.mjs';
import { createTenantDataRouter } from './routes/tenantData.mjs';

const PORT = 3100;

// ────────────────────────────────────────────────────────────────────
// Bootstrap
// ────────────────────────────────────────────────────────────────────

async function bootstrap() {
  const recorder = new Recorder('asr-api.log', 'asr-api');
  recorder.clearErrorState;

  const application = express();
  application.set('trust proxy', 1);
  application.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  application.use(express.json());
  application.use('/api/auth', authLimiter);
  application.use('/api', apiLimiter);

  // Configuration-First: Infisical → Neo4j
  const configuration = await createConfiguration();

  // CORS — origin list from Infisical in production; open in dev (absent = allow all)
  const rawOrigins = await configuration.getConfig('server', 'corsAllowedOrigins') || null;
  const corsOptions = rawOrigins ? { origin: rawOrigins.split(',').map((s) => s.trim()) } : {};
  application.use(cors(corsOptions));

  const database = await createDatabase(configuration);
  const userStore = new UserStore(database);
  const authEventStore = new AuthEventStore(database);
  const auditEventStore = new AuditEventStore(database);
  const tenantStore = new TenantStore(database);
  const serviceAccountStore = new ServiceAccountStore(database);

  initializeAuthorization({ recorder, auditEventStore });

  const stormService = await StormService.create({ configuration });

  // Auth config from Infisical (optional — absent in dev = auth-optional)
  const tenantId = await configuration.getConfig('entra', 'tenantId') || null;
  const clientId = await configuration.getConfig('entra', 'clientId') || null;
  const allowedTenantsRaw = await configuration.getConfig('entra', 'allowedTenants') || '';
  const allowedTenants = allowedTenantsRaw ? allowedTenantsRaw.split(',').map((id) => id.trim()).filter(Boolean) : [];
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const authenticate = createAuthenticationMiddleware({ isDevelopment, tenantId, clientId, userStore, allowedTenants, authEventStore, serviceAccountStore });

  // Health check (unauthenticated)
  application.get('/api/health', (_request, response) => {
    response.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount authentication on all /api/* except health
  application.use('/api', authenticate);

  // ── Auth / user info ────────────────────────────────────────────
  application.get('/api/auth/me', (request, response) => {
    const user = request.user;
    response.json({
      sub: user.sub,
      preferred_username: user.preferred_username,
      email: user.email,
      displayName: user.displayName || null,
      roles: user.roles,
      tenantId: user.tenantId || null,
    });
  });

  // Mount routes — config is public (read), reviews + answers gated
  application.use('/api/config', createConfigRouter(database, recorder));
  application.use('/api/reviews', authorize('admin', 'reviewer', 'user', 'auditor'), createReviewsRouter(database, auditEventStore, recorder));
  application.use('/api/reviews', authorize('admin', 'reviewer', 'user', 'auditor'), createAnswersRouter(database, stormService, auditEventStore, recorder));
  application.use('/api/reviews', authorize('admin', 'reviewer', 'user'), createProposedChangesRouter(database, auditEventStore, recorder));
  application.use('/api/reviews', authorize('admin', 'auditor'), createAuditorCommentsRouter(database, auditEventStore, recorder));
  application.use('/api/reviews', authorize('admin', 'reviewer', 'user', 'auditor'), createRemediationRouter(database, auditEventStore, recorder));
  application.use('/api/admin', authorize('admin'), createAdminRouter(database, userStore, authEventStore, auditEventStore, tenantStore, recorder));
  application.use('/api/admin/service-accounts', authorize('admin'), createServiceAccountRouter(serviceAccountStore, auditEventStore, recorder));
  application.use('/api/admin/tenants', authorize('admin'), createTenantDataRouter(database, auditEventStore, recorder));
  application.use('/api/admin/questionnaire', authorize('admin'), createQuestionnaireAdminRouter(database, auditEventStore, recorder));
  application.use('/api', createGateRouter(database, stormService, auditEventStore, recorder));
  application.use('/api', createExportRouter(database, stormService, recorder));

  // ── Global error handler (must be last) ─────────────────────────
  application.use((error, request, response, next) => {
    if (response.headersSent) { next(error); return; }
    recorder.emit(9002, 'e', 'Unhandled route error', {
      method: request.method,
      path: request.path,
      error: error.message,
    });
    response.status(500).json({ error: 'Internal server error' });
  });

  application.listen(PORT, () => {
    recorder.emit(9000, 'i', `ASR API listening on port ${PORT}`);
  });

  return application;
}

bootstrap().catch((error) => {
  const recorder = new Recorder('asr-api.log', 'asr-api');
  recorder.emit(9001, 's', 'Failed to start ASR API', { error: error.message });
  process.exit(1);
});
