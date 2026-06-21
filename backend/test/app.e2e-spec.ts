import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Financial Helper (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let categoryId: string;
  let movementId: string;

  const EMAIL = 'e2e@fintech.test';
  const PASS = 'Test1234!';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.movement.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('Auth', () => {
    it('POST /api/auth/register → 201 con accessToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: EMAIL, password: PASS })
        .expect(201);
      expect(res.body).toHaveProperty('accessToken');
      token = res.body.accessToken;
    });

    it('POST /api/auth/register → 409 en email duplicado', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: EMAIL, password: PASS })
        .expect(409);
    });

    it('POST /api/auth/login → 200 con accessToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: EMAIL, password: PASS })
        .expect(200);
      expect(res.body).toHaveProperty('accessToken');
      token = res.body.accessToken;
    });

    it('GET /api/categories → 401 sin token', () => {
      return request(app.getHttpServer()).get('/api/categories').expect(401);
    });
  });

  describe('Categories', () => {
    it('POST /api/categories → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Alimentación' })
        .expect(201);
      expect(res.body).toHaveProperty('id');
      categoryId = res.body.id;
    });

    it('POST /api/categories → 409 en nombre duplicado', () => {
      return request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Alimentación' })
        .expect(409);
    });

    it('GET /api/categories → lista con una categoría', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Alimentación');
    });
  });

  describe('Movements', () => {
    it('POST /api/movements → 201 sin alerta (sin presupuesto)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/movements')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'expense',
          amount: 50000,
          description: 'Almuerzo',
          categoryId,
          date: '2026-06-21',
        })
        .expect(201);
      expect(res.body.movement).toHaveProperty('id');
      expect(res.body.budgetAlert).toBeNull();
      movementId = res.body.movement.id;
    });

    it('GET /api/movements → lista paginada', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/movements')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toHaveProperty('total', 1);
    });

    it('GET /api/movements/summary → totales correctos', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/movements/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.totalExpense).toBe(50000);
      expect(res.body.balance).toBe(-50000);
    });

    it('GET /api/movements/:id → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/movements/${movementId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.id).toBe(movementId);
    });

    it('DELETE /api/movements/:id → 200', async () => {
      await request(app.getHttpServer())
        .delete(`/api/movements/${movementId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });
  });

  describe('Budgets', () => {
    it('PUT /api/budgets/:categoryId → 200', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/budgets/${categoryId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 100000, month: 6, year: 2026 })
        .expect(200);
      expect(res.body).toHaveProperty('id');
    });

    it('GET /api/budgets?month=6&year=2026 → estado de presupuestos', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/budgets?month=6&year=2026')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].categoryName).toBe('Alimentación');
    });

    it('POST /api/movements → alerta warning al 85%', async () => {
      // Presupuesto: 100 000 COP. Gasto: 85 000 → 85 % → warning
      const res = await request(app.getHttpServer())
        .post('/api/movements')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'expense',
          amount: 85000,
          description: 'Mercado',
          categoryId,
          date: '2026-06-22',
        })
        .expect(201);
      expect(res.body.budgetAlert).not.toBeNull();
      expect(res.body.budgetAlert.level).toBe('warning');
    });
  });

  describe('Auth → logout', () => {
    it('POST /api/auth/logout → 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.message).toBe('Sesión cerrada');
    });
  });
});
