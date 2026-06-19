import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetBudgetDto } from './dto/set-budget.dto';
import { Decimal } from '@prisma/client/runtime/library';

export interface BudgetAlert {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  percentage: number;
  level: 'warning' | 'exceeded';
}

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, categoryId: string, dto: SetBudgetDto) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId, isActive: true },
    });
    if (!category) throw new NotFoundException('Categoría no encontrada');

    return this.prisma.budget.upsert({
      where: {
        categoryId_month_year: {
          categoryId,
          month: dto.month,
          year: dto.year,
        },
      },
      create: { categoryId, userId, amount: dto.amount, month: dto.month, year: dto.year },
      update: { amount: dto.amount },
    });
  }

  async getStatus(userId: string, month: number, year: number) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId, month, year },
      include: { category: true },
    });

    const results = await Promise.all(
      budgets.map(async (budget) => {
        const spent = await this.getSpentAmount(userId, budget.categoryId, month, year);
        const budgetAmount = Number(budget.amount);
        const percentage = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

        return {
          categoryId: budget.categoryId,
          categoryName: budget.category.name,
          budgetAmount,
          spentAmount: spent,
          percentage,
          status: this.resolveStatus(percentage),
        };
      }),
    );

    return results;
  }

  async checkAlert(
    userId: string,
    categoryId: string,
    month: number,
    year: number,
  ): Promise<BudgetAlert | null> {
    const budget = await this.prisma.budget.findUnique({
      where: { categoryId_month_year: { categoryId, month, year } },
      include: { category: true },
    });
    if (!budget || budget.userId !== userId) return null;

    const spent = await this.getSpentAmount(userId, categoryId, month, year);
    const budgetAmount = Number(budget.amount);
    const percentage = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

    if (percentage < 80) return null;

    return {
      categoryId,
      categoryName: budget.category.name,
      budgetAmount,
      spentAmount: spent,
      percentage,
      level: percentage >= 100 ? 'exceeded' : 'warning',
    };
  }

  private async getSpentAmount(
    userId: string,
    categoryId: string,
    month: number,
    year: number,
  ): Promise<number> {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);

    const result = await this.prisma.movement.aggregate({
      where: {
        userId,
        categoryId,
        type: 'expense',
        date: { gte: from, lt: to },
      },
      _sum: { amount: true },
    });

    return Number((result._sum.amount as Decimal | null) ?? 0);
  }

  private resolveStatus(percentage: number) {
    if (percentage >= 100) return 'exceeded';
    if (percentage >= 80) return 'warning';
    return 'ok';
  }
}
