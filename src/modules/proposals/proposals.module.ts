import { Module } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { IdService } from '../../core/id/id.service';
import { PdfService } from '../../common/pdf/pdf.service';
import { BranchesModule } from '../branches/branches.module';
import { LoanTypesModule } from '../loan-types/loan-types.module';
import { KredpoolModule } from '../kredpool/kredpool.module';

@Module({
  imports: [BranchesModule, LoanTypesModule, KredpoolModule],
  controllers: [ProposalsController],
  providers: [ProposalsService, IdService, PdfService],
})
export class ProposalsModule {}
