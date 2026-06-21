import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator';
import { MovementsService } from './movements.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { UpdateMovementDto } from './dto/update-movement.dto';
import { FilterMovementsDto } from './dto/filter-movements.dto';

@Controller('movements')
@UseGuards(JwtAuthGuard)
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMovementDto) {
    return this.movementsService.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query() filters: FilterMovementsDto) {
    return this.movementsService.findAll(user.sub, filters);
  }

  @Get('summary')
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.movementsService.getSummary(user.sub);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.movementsService.findOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMovementDto,
  ) {
    return this.movementsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.movementsService.remove(user.sub, id);
  }
}
