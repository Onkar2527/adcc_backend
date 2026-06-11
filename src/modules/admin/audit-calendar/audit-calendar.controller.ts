import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { AuditCalendarService } from './audit-calendar.service';
import { CreateAuditCalendarDto, UpdateAuditCalendarDto } from './dto/audit-calendar.dto';

@Controller('audit-calendar')
export class AuditCalendarController {
  constructor(private readonly service: AuditCalendarService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('scheduling')
  getSchedulingData() {
    return this.service.getSchedulingData();
  }

  @Post('set-frequencies')
  setFrequencies(@Body() body: { frequencies: Record<string, number> }) {
    return this.service.setFrequencies(body);
  }

  @Get('risk-frequencies')
  getRiskFrequencies() {
    return this.service.getRiskFrequencies();
  }

  @Post('risk-frequencies')
  updateRiskFrequencies(@Body() body: { frequencies: { risk_type_id: number; frequency: number }[] }) {
    return this.service.updateRiskFrequencies(body);
  }

  @Get('lookups')
  getLookups() {
    return this.service.getLookups();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAuditCalendarDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAuditCalendarDto,
  ) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.service.toggleStatus(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
