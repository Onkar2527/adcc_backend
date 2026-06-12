import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { RegionMasterService } from './region-master.service';
import { CreateRegionDto, UpdateRegionDto } from './dto/region-master.dto';

@Controller('regions')
export class RegionMasterController {
  constructor(private readonly service: RegionMasterService) {}

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Get('names')
  async findUniqueNames() {
    return this.service.findUniqueNames();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRegionDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRegionDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.service.toggleStatus(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.softDelete(id);
  }
}
