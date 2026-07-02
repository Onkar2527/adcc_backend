import { Controller, Get, Param, Query, Header } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('audit-status/lookups')
  getAuditStatusLookups() {
    return this.reportsService.getAuditStatusLookups();
  }

  @Get('audit-status')
  getAuditStatusReport(@Query() query: any) {
    return this.reportsService.getAuditStatusReport(query);
  }

  @Get(':reportSlug/definition')
  @Header('Cache-Control', 'no-store')
  getReportDefinition(
    @Param('reportSlug') reportSlug: string,
    @Query('freeFlow') freeFlow?: string,
  ) {
    const isFreeFlow = freeFlow === 'true' || freeFlow === '1';
    return this.reportsService.getReportDefinition(reportSlug, isFreeFlow);
  }

  @Get(':reportSlug/data')
  @Header('Cache-Control', 'no-store')
  getReportData(
    @Param('reportSlug') reportSlug: string,
    @Query() query: any,
  ) {
    return this.reportsService.getReportData(reportSlug, query);
  }
}
