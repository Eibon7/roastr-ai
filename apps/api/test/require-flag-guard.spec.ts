import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequireFlagGuard } from '../src/modules/feature-flags/require-flag.guard';
import { FeatureFlagService } from '../src/modules/feature-flags/feature-flag.service';
import { SsotService } from '../src/shared/config/ssot.service';

function makeContext() {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('RequireFlagGuard', () => {
  let ssot: SsotService;
  let flags: FeatureFlagService;
  let reflector: Reflector;
  let guard: RequireFlagGuard;

  beforeEach(async () => {
    ssot = new SsotService();
    await ssot.onModuleInit();
    flags = new FeatureFlagService(ssot);
    reflector = new Reflector();
    guard = new RequireFlagGuard(reflector, flags);
  });

  it('allows access when no flag metadata is set on the route', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('allows access when the required flag is enabled', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('enable_shield');
    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('throws ForbiddenException when the required flag is disabled', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('roasting_enabled');
    await expect(guard.canActivate(makeContext())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('ForbiddenException message names the disabled flag', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('roasting_enabled');
    await expect(guard.canActivate(makeContext())).rejects.toThrow(
      'Feature "roasting_enabled" is not enabled',
    );
  });
});
