import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockPrisma } from '../prisma/prisma.service.mock';
import { Decimal } from '@prisma/client/runtime/library';

describe('BudgetsService', () => {
  let service: BudgetsService;

  const USER_ID = 'user-uuid';
  const CAT_ID = 'cat-uuid';

  const mockCategory = { id: CAT_ID, name: 'Alimentación', userId: USER_ID, isActive: true };
  const mockBudget = {
    id: 'budget-uuid',
    categoryId: CAT_ID,
    userId: USER_ID,
    amount: new Decimal(500000),
    month: 6,
    year: 2026,
    category: mockCategory,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
    jest.clearAllMocks();
  });

  describe('upsert', () => {
    it('should create or update a budget', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(mockCategory);
      mockPrisma.budget.upsert.mockResolvedValue(mockBudget);

      const result = await service.upsert(USER_ID, CAT_ID, {
        amount: 500000,
        month: 6,
        year: 2026,
      });

      expect(result).toEqual(mockBudget);
      expect(mockPrisma.budget.upsert).toHaveBeenCalled();
    });

    it('should throw NotFoundException if category not found', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.upsert(USER_ID, 'ghost-cat', { amount: 100000, month: 6, year: 2026 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkAlert', () => {
    it('should return null when no budget exists', async () => {
      mockPrisma.budget.findUnique.mockResolvedValue(null);

      const result = await service.checkAlert(USER_ID, CAT_ID, 6, 2026);

      expect(result).toBeNull();
    });

    it('should return null when spent < 80% of budget', async () => {
      mockPrisma.budget.findUnique.mockResolvedValue(mockBudget);
      mockPrisma.movement.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(300000) },
      });

      const result = await service.checkAlert(USER_ID, CAT_ID, 6, 2026);

      expect(result).toBeNull();
    });

    it('should return warning when spent >= 80% of budget', async () => {
      mockPrisma.budget.findUnique.mockResolvedValue(mockBudget);
      mockPrisma.movement.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(420000) },
      });

      const result = await service.checkAlert(USER_ID, CAT_ID, 6, 2026);

      expect(result).not.toBeNull();
      expect(result!.level).toBe('warning');
      expect(result!.percentage).toBe(84);
    });

    it('should return exceeded when spent >= 100% of budget', async () => {
      mockPrisma.budget.findUnique.mockResolvedValue(mockBudget);
      mockPrisma.movement.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(550000) },
      });

      const result = await service.checkAlert(USER_ID, CAT_ID, 6, 2026);

      expect(result).not.toBeNull();
      expect(result!.level).toBe('exceeded');
      expect(result!.percentage).toBe(110);
    });

    it('should return null if budget belongs to different user', async () => {
      mockPrisma.budget.findUnique.mockResolvedValue({
        ...mockBudget,
        userId: 'other-user',
      });

      const result = await service.checkAlert(USER_ID, CAT_ID, 6, 2026);

      expect(result).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('should return budget status for categories with expense movements', async () => {
      mockPrisma.budget.findMany.mockResolvedValue([mockBudget]);
      mockPrisma.movement.count.mockResolvedValue(3);
      mockPrisma.movement.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(250000) },
      });

      const result = await service.getStatus(USER_ID, 6, 2026);

      expect(result).toHaveLength(1);
      expect(result[0].categoryName).toBe('Alimentación');
      expect(result[0].percentage).toBe(50);
      expect(result[0].status).toBe('ok');
    });

    it('should exclude categories that only have income movements', async () => {
      mockPrisma.budget.findMany.mockResolvedValue([mockBudget]);
      mockPrisma.movement.count.mockResolvedValue(0);

      const result = await service.getStatus(USER_ID, 6, 2026);

      expect(result).toHaveLength(0);
    });
  });
});
