import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { UpdateMovementDto } from './dto/update-movement.dto';
import { FilterMovementsDto } from './dto/filter-movements.dto';

@Injectable()
export class MovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgetsService: BudgetsService,
  ) {}

  async create(userId: string, dto: CreateMovementDto) {
    const movement = await this.prisma.movement.create({
      data: {
        ...dto,
        amount: dto.amount,
        date: new Date(dto.date),
        userId,
      },
      include: { category: true },
    });

    const date = new Date(dto.date);
    const budgetAlert = await this.budgetsService.checkAlert(
      userId,
      dto.categoryId,
      date.getMonth() + 1,
      date.getFullYear(),
    );

    return { movement, budgetAlert };
  }

  async findAll(userId: string, filters: FilterMovementsDto) {
    const { type, categoryId, dateFrom, dateTo, page = 1, limit = 20, sortBy = 'date', order = 'desc' } = filters;

    const where: Prisma.MovementWhereInput = {
      userId,
      ...(type && { type }),
      ...(categoryId && { categoryId }),
      ...((dateFrom ?? dateTo) && {
        date: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.movement.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.movement.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const movement = await this.prisma.movement.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!movement) throw new NotFoundException('Movimiento no encontrado');
    return movement;
  }

  async update(userId: string, id: string, dto: UpdateMovementDto) {
    await this.findOne(userId, id);
    return this.prisma.movement.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
      },
      include: { category: true },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.movement.delete({ where: { id } });
  }

  async getSummary(userId: string) {
    const result = await this.prisma.movement.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amount: true },
    });

    const income = result.find((r) => r.type === 'income')?._sum.amount ?? new Decimal(0);
    const expense = result.find((r) => r.type === 'expense')?._sum.amount ?? new Decimal(0);
    const balance = new Decimal(income).minus(expense);

    return {
      totalIncome: Number(income),
      totalExpense: Number(expense),
      balance: Number(balance),
    };
  }
}
