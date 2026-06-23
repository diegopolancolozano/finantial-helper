import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from '../../src/categories/categories.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('CategoriesService (integration)', () => {
  let service: CategoriesService;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [CategoriesService, PrismaService],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();

    const user = await prisma.user.create({
      data: { email: 'cats@cat.int', passwordHash: 'irrelevant' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.onModuleDestroy();
  });

  it('create — persiste la categoría en base de datos', async () => {
    const cat = await service.create(userId, { name: 'Alimentación' });
    expect(cat.name).toBe('Alimentación');
    expect(cat.isActive).toBe(true);
    expect(cat.userId).toBe(userId);
  });

  it('create — lanza ConflictException si ya existe una categoría activa con ese nombre', async () => {
    await service.create(userId, { name: 'Transporte' });
    await expect(service.create(userId, { name: 'Transporte' })).rejects.toThrow(ConflictException);
  });

  it('findAll — devuelve solo categorías activas del usuario', async () => {
    const before = await service.findAll(userId);
    const cat = await service.create(userId, { name: 'Temporal' });
    await service.remove(userId, cat.id);
    const after = await service.findAll(userId);
    expect(after.find((c) => c.id === cat.id)).toBeUndefined();
    expect(after.length).toBe(before.length);
  });

  it('remove — hace soft delete (isActive = false) sin eliminar el registro', async () => {
    const cat = await service.create(userId, { name: 'SoftDelete' });
    await service.remove(userId, cat.id);

    const raw = await prisma.category.findUnique({ where: { id: cat.id } });
    expect(raw).not.toBeNull();
    expect(raw?.isActive).toBe(false);
  });

  it('create — reactiva una categoría previamente eliminada (mismo nombre)', async () => {
    const original = await service.create(userId, { name: 'Reactivar' });
    await service.remove(userId, original.id);

    const reactivated = await service.create(userId, { name: 'Reactivar' });
    expect(reactivated.id).toBe(original.id);
    expect(reactivated.isActive).toBe(true);
  });

  it('update — modifica el nombre correctamente', async () => {
    const cat = await service.create(userId, { name: 'OldName' });
    const updated = await service.update(userId, cat.id, { name: 'NewName' });
    expect(updated.name).toBe('NewName');
  });

  it('remove — lanza NotFoundException para una categoría de otro usuario', async () => {
    const cat = await service.create(userId, { name: 'Private' });
    await expect(service.remove('other-user-id', cat.id)).rejects.toThrow(NotFoundException);
  });
});
