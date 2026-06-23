import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import {
  AuditTypeDto,
  AuditTypeQuestionSetupMappingDto,
} from './dto/audit-type.dto';
import { AuditTypeService } from './audit-type.service';

@Controller('audit-types')
export class AuditTypeController {
  constructor(private readonly service: AuditTypeService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: AuditTypeDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: AuditTypeDto) {
    return this.service.update(Number(id), dto);
  }

  @Put(':id/toggle-status')
  toggleStatus(@Param('id') id: string) {
    return this.service.toggleStatus(Number(id));
  }

  @Get(':id/question-setups')
  getQuestionSetups(@Param('id') id: string) {
    return this.service.getQuestionSetups(Number(id));
  }

  @Put(':id/question-setups')
  saveQuestionSetups(
    @Param('id') id: string,
    @Body() dto: AuditTypeQuestionSetupMappingDto,
  ) {
    return this.service.saveQuestionSetups(
      Number(id),
      dto.control_master_ids,
    );
  }
}
