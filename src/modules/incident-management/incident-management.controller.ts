import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IncidentManagementService } from './incident-management.service';
import { CreateIncidentDto, UpdateIncidentDto } from './dto/incident.dto';

@Controller('incident-management')
export class IncidentManagementController {
  constructor(private readonly service: IncidentManagementService) {}

  @Post()
  create(
    @Body() dto: CreateIncidentDto,
    @Query('employeeId', ParseIntPipe) employeeId: number,
  ) {
    return this.service.create(dto, employeeId);
  }

  @Get()
  findAll(@Query('employeeId', ParseIntPipe) employeeId: number) {
    return this.service.findAll(employeeId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
