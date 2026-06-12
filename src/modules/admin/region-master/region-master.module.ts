import { Module } from '@nestjs/common';
import { RegionMasterService } from './region-master.service';
import { RegionMasterController } from './region-master.controller';

@Module({
  controllers: [RegionMasterController],
  providers: [RegionMasterService],
  exports: [RegionMasterService],
})
export class RegionMasterModule {}
