import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  IsNotEmpty,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { MovementType } from '@prisma/client';

export class CreateMovementDto {
  @IsEnum(MovementType)
  type: MovementType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @IsUUID()
  categoryId: string;

  @IsDateString()
  date: string;
}
