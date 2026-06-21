import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { userId_name: { userId, name: dto.name } },
    });
    if (existing && existing.isActive) {
      throw new ConflictException('Ya existe una categoría con ese nombre');
    }
    if (existing && !existing.isActive) {
      return this.prisma.category.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    }
    return this.prisma.category.create({ data: { ...dto, userId } });
  }

  findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { userId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOwnedOrFail(userId, id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.findOwnedOrFail(userId, id);
    return this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async findOwnedOrFail(userId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, userId, isActive: true },
    });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }
}
