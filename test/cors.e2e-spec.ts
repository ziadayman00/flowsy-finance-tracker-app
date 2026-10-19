import * as dotenv from 'dotenv';
dotenv.config({ override: true });

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { createCorsOptions } from '../src/config/cors.config';

describe('CORS HTTP Middleware & Security (E2E)', () => {
  let app: INestApplication;

  const configuredOrigins = [
    'http://localhost:3000',
    'https://app.flowsy.com',
    'https://admin.flowsy.com',
  ];

  beforeAll(async () => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Safeguard Violation: E2E tests cannot be executed when NODE_ENV is production.',
      );
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());

    // Explicit CORS configuration with multiple configured origins
    app.enableCors(createCorsOptions(configuredOrigins));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Approved Origins', () => {
    it('should allow simple GET from approved origin with proper CORS headers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['vary']).toContain('Origin');
    });

    it('should succeed on preflight OPTIONS from approved origin', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/v1/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization,content-type')
        .expect(204);

      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-methods']).toContain('GET');
    });
  });

  describe('2. Unapproved Origins', () => {
    it('should reject simple request from unapproved origin with 403 and omit allow-origin header', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', 'http://malicious-site.com')
        .expect(403);

      // Must NEVER reflect the unapproved origin
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.body.statusCode).toBe(403);
      expect(res.body.message).toContain('CORS policy violation');
    });

    it('should reject preflight OPTIONS from unapproved origin with 403', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/v1/health')
        .set('Origin', 'http://malicious-site.com')
        .set('Access-Control-Request-Method', 'POST')
        .expect(403);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('3. Native Clients (Missing Origin header)', () => {
    it('should succeed for native mobile clients sending no Origin header', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      // No CORS headers need to be sent when Origin header is absent
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('4. Multiple Configured Origins', () => {
    it('should allow secondary approved origin (https://app.flowsy.com)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', 'https://app.flowsy.com')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe(
        'https://app.flowsy.com',
      );
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should allow tertiary approved origin (https://admin.flowsy.com)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', 'https://admin.flowsy.com')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe(
        'https://admin.flowsy.com',
      );
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject unlisted subdomain origin (https://unauthorized.flowsy.com)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', 'https://unauthorized.flowsy.com')
        .expect(403);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
