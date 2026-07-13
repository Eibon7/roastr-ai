import { describe, it, expect, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { FeatureFlagsController } from '../src/modules/feature-flags/feature-flags.controller';
import { FeatureFlagService } from '../src/modules/feature-flags/feature-flag.service';
import { SsotService } from '../src/shared/config/ssot.service';

describe('FeatureFlagsController', () => {
  let ssot: SsotService;
  let service: FeatureFlagService;
  let controller: FeatureFlagsController;

  beforeEach(async () => {
    ssot = new SsotService();
    await ssot.onModuleInit();
    service = new FeatureFlagService(ssot);
    controller = new FeatureFlagsController(service);
  });

  it('returns the flag state for a known flag name', () => {
    expect(controller.getFlag('enable_shield')).toEqual({
      flag: 'enable_shield',
      enabled: true,
    });
  });

  it('throws NotFoundException for an unknown flag name', () => {
    expect(() => controller.getFlag('not_a_real_flag')).toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException with a message naming the unknown flag', () => {
    expect(() => controller.getFlag('bogus')).toThrow('Unknown feature flag "bogus"');
  });

  it('getAllFlags returns every configured flag', () => {
    const all = controller.getAllFlags();
    expect(all.enable_shield).toBe(true);
    expect(all.roasting_enabled).toBe(false);
  });
});
