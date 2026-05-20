import { Module } from '@nestjs/common';
import { AuditorDataService } from './auditor-data.component.service';
import { AuditorDataController } from './auditor-data.component.controller';
import { IdModule } from '../../core/id/id.module';

@Module({
  imports: [IdModule],
  controllers: [AuditorDataController],
  providers: [AuditorDataService],
  exports: [AuditorDataService],
})
export class AuditorDataModule {}
