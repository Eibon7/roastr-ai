import { BadRequestException, Injectable } from '@nestjs/common';
import { SsotService } from '../../shared/config/ssot.service';
import {
  FEATURE_FLAG_NAMES,
  type FeatureFlagName,
  isValidFeatureFlagName,
} from '@roastr/shared';

@Injectable()
export class FeatureFlagService {
  private overrides = new Map<FeatureFlagName, boolean>();

  constructor(private readonly ssot: SsotService) {}

  isEnabled(flagName: FeatureFlagName): boolean {
    const override = this.overrides.get(flagName);
    if (override !== undefined) return override;
    return this.ssot.getFeatureFlag(flagName);
  }

  getAllFlags(): Record<FeatureFlagName, boolean> {
    const result = {} as Record<FeatureFlagName, boolean>;
    for (const name of FEATURE_FLAG_NAMES) {
      const override = this.overrides.get(name);
      result[name] = override !== undefined ? override : this.ssot.getFeatureFlag(name);
    }
    return result;
  }

  setFlag(flagName: string, value: boolean): void {
    if (!isValidFeatureFlagName(flagName)) {
      throw new BadRequestException(
        `Unknown feature flag "${flagName}". Valid flags: ${FEATURE_FLAG_NAMES.join(', ')}`,
      );
    }
    this.overrides.set(flagName, value);
  }
}
