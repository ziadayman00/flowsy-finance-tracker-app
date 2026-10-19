import * as dotenv from 'dotenv';
dotenv.config({ override: true });

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/database/prisma.service';
import { parseCorsOrigins, createCorsOptions } from '../src/config/cors.config';

describe('Flowsy Backend E2E - Critical User Journey', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let user1Token: string;
  let user1Id: string;
  let user2Token: string;

  const runId = Date.now();
  const user1Email = `e2e_user1_${runId}@flowsy.app`;
  const user2Email = `e2e_user2_${runId}@flowsy.app`;

  let user1AccountId: string;
  let user1CommitmentId: string;
  let user1TransactionId: string;

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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    const allowedOrigins = parseCorsOrigins(
      process.env.CORS_ORIGIN,
      process.env.NODE_ENV,
    );
    app.enableCors(createCorsOptions(allowedOrigins));

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Clean up test users
    try {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [user1Email, user2Email],
          },
        },
      });
    } catch (e) {
      // Ignore
    }
    await app.close();
  });

  describe('1. Health Check', () => {
    it('GET /api/v1/health should return ok and connected database', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.database.status).toBe('connected');
    });
  });

  describe('2. User Registration and Authentication', () => {
    it('POST /api/v1/auth/register should register User 1 with initial Cash account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user1Email,
          password: 'Password123!',
          displayName: 'المستخدم الأول',
        })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe(user1Email);

      user1Token = res.body.accessToken;
      user1Id = res.body.user.id;
    });

    it('POST /api/v1/auth/register should register User 2', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user2Email,
          password: 'Password123!',
          displayName: 'المستخدم الثاني',
        })
        .expect(201);

      user2Token = res.body.accessToken;
    });

    it('GET /api/v1/auth/me should return User 1 profile with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(res.body.id).toBe(user1Id);
      expect(res.body.email).toBe(user1Email);
    });

    it('GET /api/v1/auth/me should reject request without token with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });
  });

  describe('3. Financial Account Operations', () => {
    it('POST /api/v1/accounts should create a Bank account for User 1', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'حساب بنك مصر',
          type: 'BANK',
          initialBalance: 5000.0,
        })
        .expect(201);

      expect(res.body.name).toBe('حساب بنك مصر');
      expect(res.body.currentBalance).toBe('5000.00');
      user1AccountId = res.body.id;
    });

    it('GET /api/v1/accounts should list User 1 accounts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(2); // Cash + Bank
    });
  });

  describe('4. Transaction Operations (Income & Expense)', () => {
    it('POST /api/v1/transactions should record Income (+10,000 EGP)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'INCOME',
          amount: 10000.0,
          accountId: user1AccountId,
          note: 'راتب شهري',
        })
        .expect(201);

      expect(res.body.amount).toBe('10000.00');
      user1TransactionId = res.body.id;

      // Verify account balance increased: 5,000 + 10,000 = 15,000.00
      const accRes = await request(app.getHttpServer())
        .get(`/api/v1/accounts/${user1AccountId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(accRes.body.currentBalance).toBe('15000.00');
    });

    it('POST /api/v1/transactions should record Expense (-2,000 EGP)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'EXPENSE',
          amount: 2000.0,
          accountId: user1AccountId,
          note: 'تسوق ملابس',
        })
        .expect(201);

      // Verify account balance decreased: 15,000 - 2,000 = 13,000.00
      const accRes = await request(app.getHttpServer())
        .get(`/api/v1/accounts/${user1AccountId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(accRes.body.currentBalance).toBe('13000.00');
    });
  });

  describe('5. Commitments and Safe-to-Spend ("تقدر تصرف كام؟")', () => {
    it('POST /api/v1/commitments should create Rent commitment (4,000 EGP)', async () => {
      const futureDate = new Date();
      futureDate.setDate(25);

      const res = await request(app.getHttpServer())
        .post('/api/v1/commitments')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'إيجار شهري',
          amount: 4000.0,
          dueDate: futureDate.toISOString(),
          accountId: user1AccountId,
        })
        .expect(201);

      expect(res.body.amount).toBe('4000.00');
      expect(res.body.status).toBe('PENDING');
      user1CommitmentId = res.body.id;
    });

    it('GET /api/v1/dashboard/summary should compute Safe-to-Spend (13,000 - 4,000 = 9,000)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // Liquid balance = 13,000 (Bank) + 0 (Cash) = 13,000.00
      expect(res.body.totalLiquidBalance).toBe('13000.00');
      // Outstanding commitment = 4,000.00
      expect(res.body.safeToSpend.totalPendingCommitments).toBe('4000.00');
      // Safe to spend = 9,000.00
      expect(res.body.safeToSpend.safeToSpend).toBe('9000.00');
      expect(res.body.safeToSpend.isDeficit).toBe(false);
    });

    it('POST /api/v1/commitments/:id/pay should mark commitment PAID and deduct balance', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/commitments/${user1CommitmentId}/pay`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          accountId: user1AccountId,
          note: 'سداد الإيجار',
        })
        .expect(200);

      // Verify account balance is now: 13,000 - 4,000 = 9,000.00
      const accRes = await request(app.getHttpServer())
        .get(`/api/v1/accounts/${user1AccountId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(accRes.body.currentBalance).toBe('9000.00');
    });

    it('GET /api/v1/dashboard/summary should NOT double-deduct paid commitment', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // Liquid balance is now 9,000.00
      expect(res.body.totalLiquidBalance).toBe('9000.00');
      // Outstanding commitments should now be 0.00 (the 4,000 commitment was paid!)
      expect(res.body.safeToSpend.totalPendingCommitments).toBe('0.00');
      // Safe to spend should remain 9,000.00! NOT 9,000 - 4,000 = 5,000!
      expect(res.body.safeToSpend.safeToSpend).toBe('9000.00');
    });
  });

  describe('6. Cross-User Data Isolation', () => {
    it('User 2 cannot access User 1 account', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/accounts/${user1AccountId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);
    });

    it('User 2 cannot delete User 1 transaction', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/transactions/${user1TransactionId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);
    });

    it('User 2 cannot pay User 1 commitment', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/commitments/${user1CommitmentId}/pay`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ accountId: user1AccountId })
        .expect(404);
    });
  });

  describe('7. Audit Remediation Verification (FIN-01, FIN-03, CON-01)', () => {
    let raceCommitmentId: string;
    let paymentTxId: string;
    let usdAccountId: string;

    it('CON-01: Concurrent duplicate payments should allow only one to succeed', async () => {
      // Create a commitment for concurrency test
      const commRes = await request(app.getHttpServer())
        .post('/api/v1/commitments')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'فاتورة الكهرباء للتجربة',
          amount: 500,
          currency: 'EGP',
          dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
          recurrence: 'NONE',
        })
        .expect(201);

      raceCommitmentId = commRes.body.id;

      // Fire 2 concurrent payment requests simultaneously
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/commitments/${raceCommitmentId}/pay`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ accountId: user1AccountId, note: 'Payment attempt 1' }),
        request(app.getHttpServer())
          .post(`/api/v1/commitments/${raceCommitmentId}/pay`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ accountId: user1AccountId, note: 'Payment attempt 2' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 400]);

      // Capture the transaction ID of the successful payment
      const successRes = res1.status === 200 ? res1 : res2;
      paymentTxId = successRes.body.transactionId;
      expect(paymentTxId).toBeDefined();

      // Losing request should have error message indicating already paid
      const failureRes = res1.status === 400 ? res1 : res2;
      expect(failureRes.body.message).toContain('already been marked as paid');
    });

    it('FIN-01: Deleting a payment transaction should restore commitment to PENDING and refund balance', async () => {
      // Balance before reversal
      const accBefore = await request(app.getHttpServer())
        .get(`/api/v1/accounts/${user1AccountId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);
      const balanceBefore = parseFloat(accBefore.body.currentBalance);

      // Delete payment transaction (reversal)
      await request(app.getHttpServer())
        .delete(`/api/v1/transactions/${paymentTxId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // Verify balance was refunded (+500 EGP)
      const accAfter = await request(app.getHttpServer())
        .get(`/api/v1/accounts/${user1AccountId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);
      const balanceAfter = parseFloat(accAfter.body.currentBalance);
      expect(balanceAfter).toBeCloseTo(balanceBefore + 500, 2);

      // Verify commitment was restored to PENDING (due date is in the future)
      const commAfter = await request(app.getHttpServer())
        .get(`/api/v1/commitments/${raceCommitmentId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);
      expect(commAfter.body.status).toBe('PENDING');
      expect(commAfter.body.paidTransactionId).toBeNull();
    });

    it('FIN-03: Cross-currency transfer should be rejected without mutating account balances', async () => {
      // Create a USD account for User 1
      const usdRes = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'حساب دولاري E2E',
          type: 'BANK',
          currency: 'USD',
          initialBalance: 100,
        })
        .expect(201);
      usdAccountId = usdRes.body.id;

      // Attempt cross-currency transfer from EGP account to USD account
      const transferRes = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'TRANSFER',
          amount: 50,
          accountId: user1AccountId,
          destinationAccountId: usdAccountId,
          note: 'Invalid FX transfer',
        })
        .expect(400);

      expect(transferRes.body.message).toContain('Cross-currency transfers are not supported');

      // Verify USD balance remains 100.00
      const usdAcc = await request(app.getHttpServer())
        .get(`/api/v1/accounts/${usdAccountId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);
      expect(usdAcc.body.currentBalance).toBe('100.00');
    });
  });
});
