import { Controller, Get, Param } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';

@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private flags: FeatureFlagService) {}

  @Get(':name')
  getFlag(@Param('name') name: string) {
    return { flag: name, enabled: this.flags.isEnabled(name) };
  }

  @Get()
  getAllFlags() {
    return this.flags.getAllFlags();
  }
}
