import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { MovementsService } from '../../src/movements/movements.service';
import { BudgetsService } from '../../src/budgets/budgets.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('MovementsService (integration)', () => {
  let movementsService: MovementsService;
  let budgetsService: BudgetsService;
  let prisma: PrismaService;
  let userId: string;
  let categoryId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [MovementsService, BudgetsService, PrismaService],
    }).compile();

    movementsService = module.get<MovementsService>(MovementsService);
    budgetsService = module.get<BudgetsService>(BudgetsService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();

    const user = await prisma.user.create({
      data: { email: 'movs@mov.int', passwordHash: 'irrelevant' },
    });
    userId = user.id;

    const category = await prisma.category.create({
      data: { name: 'Alimentación', userId },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.budget.deleteMany({ where: { userId } });
    await prisma.movement.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.onModuleDestroy();
  });

  it('create — persiste el movimiento y devuelve budgetAlert null sin presupuesto', async () => {
    const { movement, budgetAlert } = await movementsService.create(userId, {
      type: 'expense',
      amount: 50000,
      description: 'Supermercado',
      date: '2026-01-15',
      categoryId,
    });

    expect(movement.id).toBeDefined();
    expect(Number(movement.amount)).toBe(50000);
    expect(movement.userId).toBe(userId);
    expect(budgetAlert).toBeNull();
  });

  it('create — devuelve budgetAlert warning al superar el 80% del presupuesto', async () => {
    const now = new Date();
    await budgetsService.upsert(userId, categoryId, {
      amount: 100000,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });

    const { budgetAlert } = await movementsService.create(userId, {
      type: 'expense',
      amount: 85000,
      description: 'Compras del mes',
      date: now.toISOString(),
      categoryId,
    });

    expect(budgetAlert).not.toBeNull();
    expect(budgetAlert?.level).toBe('warning');
    expect(budgetAlert?.percentage).toBeGreaterThanOrEqual(80);
  });

  it('findAll — filtra movimientos por tipo y devuelve solo los del usuario', async () => {
    const result = await movementsService.findAll(userId, { type: 'expense' });
    expect(result.data.every((m) => m.type === 'expense')).toBe(true);
    expect(result.data.every((m) => m.userId === userId)).toBe(true);
    expect(result.meta.total).toBeGreaterThan(0);
  });

  it('findAll — filtra por rango de fechas', async () => {
    const result = await movementsService.findAll(userId, {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
    expect(result.data.length).toBeGreaterThan(0);
    result.data.forEach((m) => {
      const date = new Date(m.date);
      expect(date >= new Date('2026-01-01')).toBe(true);
      expect(date <= new Date('2026-01-31')).toBe(true);
    });
  });

  it('getSummary — calcula ingresos, egresos y balance correctamente', async () => {
    await movementsService.create(userId, {
      type: 'income',
      amount: 1000000,
      description: 'Salario',
      date: '2026-01-01',
      categoryId,
    });

    const summary = await movementsService.getSummary(userId);
    expect(summary.totalIncome).toBeGreaterThan(0);
    expect(summary.totalExpense).toBeGreaterThan(0);
    expect(summary.balance).toBe(summary.totalIncome - summary.totalExpense);
  });

  it('findOne — lanza NotFoundException para un movimiento de otro usuario', async () => {
    const { movement } = await movementsService.create(userId, {
      type: 'income',
      amount: 1,
      description: 'Test',
      date: '2026-01-01',
      categoryId,
    });
    await expect(movementsService.findOne('other-user-id', movement.id)).rejects.toThrow(
      NotFoundException,
    );
  });
});
