import {
  IsEnum,
  IsUUID,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MovementType } from '@prisma/client';

export enum SortOrder {
  asc = 'asc',
  desc = 'desc',
}

export enum SortBy {
  date = 'date',
  amount = 'amount',
}

export class FilterMovementsDto {
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy = SortBy.date;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder = SortOrder.desc;
}
