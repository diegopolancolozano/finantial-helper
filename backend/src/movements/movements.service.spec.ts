import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MovementsService } from './movements.service';
import { BudgetsService } from '../budgets/budgets.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockPrisma } from '../prisma/prisma.service.mock';
import { Decimal } from '@prisma/client/runtime/library';

const mockBudgetsService = {
  checkAlert: jest.fn().mockResolvedValue(null),
};

describe('MovementsService', () => {
  let service: MovementsService;

  const USER_ID = 'user-uuid';
  const MOV_ID = 'mov-uuid';
  const CAT_ID = 'cat-uuid';

  const mockMovement = {
    id: MOV_ID,
    type: 'expense' as const,
    amount: new Decimal(50000),
    description: 'Almuerzo',
    date: new Date('2026-06-21'),
    userId: USER_ID,
    categoryId: CAT_ID,
    category: { id: CAT_ID, name: 'Alimentación' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BudgetsService, useValue: mockBudgetsService },
      ],
    }).compile();

    service = module.get<MovementsService>(MovementsService);
    jest.clearAllMocks();
    mockBudgetsService.checkAlert.mockResolvedValue(null);
  });

  describe('create', () => {
    it('should create a movement and return it with budgetAlert null', async () => {
      mockPrisma.movement.create.mockResolvedValue(mockMovement);

      const result = await service.create(USER_ID, {
        type: 'expense',
        amount: 50000,
        description: 'Almuerzo',
        categoryId: CAT_ID,
        date: '2026-06-21',
      });

      expect(result.movement).toEqual(mockMovement);
      expect(result.budgetAlert).toBeNull();
      expect(mockPrisma.movement.create).toHaveBeenCalled();
    });

    it('should return budgetAlert when threshold is exceeded', async () => {
      const alert = {
        level: 'warning',
        percentage: 84,
        categoryName: 'Alimentación',
        categoryId: CAT_ID,
        budgetAmount: 500000,
        spentAmount: 420000,
      };
      mockPrisma.movement.create.mockResolvedValue(mockMovement);
      mockBudgetsService.checkAlert.mockResolvedValue(alert);

      const result = await service.create(USER_ID, {
        type: 'expense',
        amount: 50000,
        description: 'Almuerzo',
        categoryId: CAT_ID,
        date: '2026-06-21',
      });

      expect(result.budgetAlert).toEqual(alert);
    });
  });

  describe('findAll', () => {
    it('should return paginated movements', async () => {
      mockPrisma.movement.findMany.mockResolvedValue([mockMovement]);
      mockPrisma.movement.count.mockResolvedValue(1);

      const result = await service.findAll(USER_ID, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by type', async () => {
      mockPrisma.movement.findMany.mockResolvedValue([mockMovement]);
      mockPrisma.movement.count.mockResolvedValue(1);

      await service.findAll(USER_ID, { type: 'expense' });

      expect(mockPrisma.movement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'expense' }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.movement.findMany.mockResolvedValue([]);
      mockPrisma.movement.count.mockResolvedValue(0);

      await service.findAll(USER_ID, { dateFrom: '2026-06-01', dateTo: '2026-06-30' });

      expect(mockPrisma.movement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: {
              gte: new Date('2026-06-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a movement by id', async () => {
      mockPrisma.movement.findFirst.mockResolvedValue(mockMovement);

      const result = await service.findOne(USER_ID, MOV_ID);

      expect(result).toEqual(mockMovement);
      expect(mockPrisma.movement.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: MOV_ID, userId: USER_ID } }),
      );
    });

    it('should throw NotFoundException if movement not found', async () => {
      mockPrisma.movement.findFirst.mockResolvedValue(null);

      await expect(service.findOne(USER_ID, 'ghost-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a movement', async () => {
      mockPrisma.movement.findFirst.mockResolvedValue(mockMovement);
      mockPrisma.movement.delete.mockResolvedValue(mockMovement);

      await service.remove(USER_ID, MOV_ID);

      expect(mockPrisma.movement.delete).toHaveBeenCalledWith({ where: { id: MOV_ID } });
    });

    it('should throw NotFoundException if movement not found', async () => {
      mockPrisma.movement.findFirst.mockResolvedValue(null);

      await expect(service.remove(USER_ID, 'ghost-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSummary', () => {
    it('should calculate balance correctly', async () => {
      mockPrisma.movement.groupBy.mockResolvedValue([
        { type: 'income', _sum: { amount: new Decimal(1000000) } },
        { type: 'expense', _sum: { amount: new Decimal(420000) } },
      ]);

      const result = await service.getSummary(USER_ID);

      expect(result.totalIncome).toBe(1000000);
      expect(result.totalExpense).toBe(420000);
      expect(result.balance).toBe(580000);
    });

    it('should return zero balance when no movements', async () => {
      mockPrisma.movement.groupBy.mockResolvedValue([]);

      const result = await service.getSummary(USER_ID);

      expect(result.totalIncome).toBe(0);
      expect(result.totalExpense).toBe(0);
      expect(result.balance).toBe(0);
    });
  });
});
