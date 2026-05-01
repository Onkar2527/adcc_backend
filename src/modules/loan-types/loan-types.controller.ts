import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { LoanTypesService } from './loan-types.service';
import { CreateLoanTypeDto, UpdateLoanTypeDto } from './dto/loan-type.dto';

@Controller('loan-types')
export class LoanTypesController {
  constructor(private readonly loanTypesService: LoanTypesService) {}

  @Post()
  create(@Body() createLoanTypeDto: CreateLoanTypeDto) {
    return this.loanTypesService.create(createLoanTypeDto);
  }

  @Get()
  async findAll() {
    const data = await this.loanTypesService.findAll();
    return { data };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loanTypesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateLoanTypeDto: UpdateLoanTypeDto) {
    return this.loanTypesService.update(id, updateLoanTypeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.loanTypesService.remove(id);
  }
}
