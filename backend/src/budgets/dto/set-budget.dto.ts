import { IsNumber, IsPositive, IsInt, Min, Max } from 'class-validator';

export class SetBudgetDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2020)
  year: number;
}
