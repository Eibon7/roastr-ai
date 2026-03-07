import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { isValidFeatureFlagName } from '@roastr/shared';

@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private flags: FeatureFlagService) {}

  @Get(':name')
  getFlag(@Param('name') name: string) {
    if (!isValidFeatureFlagName(name)) {
      throw new NotFoundException(`Unknown feature flag "${name}"`);
    }
    return { flag: name, enabled: this.flags.isEnabled(name) };
  }

  @Get()
  getAllFlags() {
    return this.flags.getAllFlags();
  }
}
