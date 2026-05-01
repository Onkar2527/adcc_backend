import { Module } from '@nestjs/common';
import { KredpoolService } from './kredpool.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [KredpoolService],
  exports: [KredpoolService],
})
export class KredpoolModule {}
