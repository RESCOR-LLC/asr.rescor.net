// ════════════════════════════════════════════════════════════════════
// Security Tests — Security headers and fingerprint suppression
// ════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, '..', 'src', 'server.mjs');
const nginxPath = join(__dirname, '..', '..', 'deployment', 'docker', 'nginx-frontend.conf');

describe('security headers — Express (helmet)', () => {
  const source = readFileSync(serverPath, 'utf-8');

  it('helmet middleware is imported and used', () => {
    expect(source).toContain("import helmet from 'helmet'");
    expect(source).toContain('application.use(helmet(');
  });

  it('trust proxy is configured for rate limiter accuracy', () => {
    expect(source).toContain("application.set('trust proxy'");
  });
});

describe('security headers — nginx', () => {
  const exists = existsSync(nginxPath);

  it('nginx config exists', () => {
    expect(exists).toBe(true);
  });

  if (exists) {
    const nginx = readFileSync(nginxPath, 'utf-8');

    it('server_tokens is off (suppress nginx version)', () => {
      expect(nginx).toContain('server_tokens off');
    });

    it('Strict-Transport-Security header is set', () => {
      expect(nginx).toContain('Strict-Transport-Security');
    });

    it('Content-Security-Policy header is set', () => {
      expect(nginx).toContain('Content-Security-Policy');
    });

    it('Permissions-Policy header is set', () => {
      expect(nginx).toContain('Permissions-Policy');
    });

    it('X-Frame-Options header is set', () => {
      expect(nginx).toContain('X-Frame-Options');
    });
  }
});

describe('rate limiting', () => {
  it('rate limiter middleware exists and is configured', () => {
    const rateLimiterPath = join(__dirname, '..', 'src', 'middleware', 'rateLimiter.mjs');
    const source = readFileSync(rateLimiterPath, 'utf-8');

    expect(source).toContain('authLimiter');
    expect(source).toContain('apiLimiter');
    expect(source).toContain('ipKeyGenerator');
  });
});
