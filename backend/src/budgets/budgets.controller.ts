import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtPayload,
} from '../common/decorators/current-user.decorator';
import { BudgetsService } from './budgets.service';
import { SetBudgetDto } from './dto/set-budget.dto';

class BudgetStatusQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year?: number;
}

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  getStatus(@CurrentUser() user: JwtPayload, @Query() query: BudgetStatusQuery) {
    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();
    return this.budgetsService.getStatus(user.sub, month, year);
  }

  @Put(':categoryId')
  upsert(
    @CurrentUser() user: JwtPayload,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: SetBudgetDto,
  ) {
    return this.budgetsService.upsert(user.sub, categoryId, dto);
  }
}
