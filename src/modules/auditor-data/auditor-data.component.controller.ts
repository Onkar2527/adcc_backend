import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { AuditorDataService } from './auditor-data.component.service';


@Controller('auditor-data')
export class AuditorDataController {
  constructor(private readonly branchesService: AuditorDataService) {}

  @Post()
  findAll(
  @Body('auditortId')
  auditortId:number
) {

  return this.branchesService
    .findAll(
      Number(auditortId)
    );

}

  }
