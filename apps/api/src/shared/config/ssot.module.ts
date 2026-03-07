import { Module, Global } from '@nestjs/common';
import { SsotService } from './ssot.service';

@Global()
@Module({
  providers: [SsotService],
  exports: [SsotService],
})
export class SsotModule {}
