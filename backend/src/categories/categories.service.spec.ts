import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockPrisma } from '../prisma/prisma.service.mock';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const USER_ID = 'user-uuid';
  const CAT_ID = 'cat-uuid';
  const mockCategory = { id: CAT_ID, name: 'Comida', userId: USER_ID, isActive: true };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      mockPrisma.category.create.mockResolvedValue(mockCategory);

      const result = await service.create(USER_ID, { name: 'Comida' });

      expect(result).toEqual(mockCategory);
      expect(mockPrisma.category.create).toHaveBeenCalledWith({
        data: { name: 'Comida', userId: USER_ID },
      });
    });

    it('should throw ConflictException if active category exists', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);

      await expect(service.create(USER_ID, { name: 'Comida' })).rejects.toThrow(ConflictException);
    });

    it('should reactivate a soft-deleted category', async () => {
      const inactiveCat = { ...mockCategory, isActive: false };
      mockPrisma.category.findUnique.mockResolvedValue(inactiveCat);
      mockPrisma.category.update.mockResolvedValue({ ...inactiveCat, isActive: true });

      const result = await service.create(USER_ID, { name: 'Comida' });

      expect(mockPrisma.category.update).toHaveBeenCalledWith({
        where: { id: CAT_ID },
        data: { isActive: true },
      });
      expect(result.isActive).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should return active categories for user', async () => {
      mockPrisma.category.findMany.mockResolvedValue([mockCategory]);

      const result = await service.findAll(USER_ID);

      expect(result).toHaveLength(1);
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, isActive: true },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('update', () => {
    it('should update category name', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(mockCategory);
      mockPrisma.category.update.mockResolvedValue({ ...mockCategory, name: 'Alimentación' });

      const result = await service.update(USER_ID, CAT_ID, { name: 'Alimentación' });

      expect(result.name).toBe('Alimentación');
    });

    it('should throw NotFoundException if category does not belong to user', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(null);

      await expect(service.update(USER_ID, 'other-id', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft-delete category', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(mockCategory);
      mockPrisma.category.update.mockResolvedValue({ ...mockCategory, isActive: false });

      const result = await service.remove(USER_ID, CAT_ID);

      expect(mockPrisma.category.update).toHaveBeenCalledWith({
        where: { id: CAT_ID },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if category not found', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(null);

      await expect(service.remove(USER_ID, 'ghost-id')).rejects.toThrow(NotFoundException);
    });
  });
});
