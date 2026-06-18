import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CreateSpecialAuditDto,
  UpdateSpecialAuditDto,
} from './dto/special-audit.dto';
import { SpecialAuditService } from './special-audit.service';

@Controller('special-audit')
export class SpecialAuditController {
  constructor(private readonly service: SpecialAuditService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('lookups')
  lookups() {
    return this.service.lookups();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: CreateSpecialAuditDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateSpecialAuditDto,
  ) {
    return this.service.update(id, body);
  }
}
