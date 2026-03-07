import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureFlagService } from '../src/modules/feature-flags/feature-flag.service';
import { SsotService } from '../src/shared/config/ssot.service';

describe('FeatureFlagService', () => {
  let ssot: SsotService;
  let service: FeatureFlagService;

  beforeEach(async () => {
    ssot = new SsotService();
    await ssot.onModuleInit();
    service = new FeatureFlagService(ssot);
  });

  it('returns true for enabled flags', () => {
    expect(service.isEnabled('enable_shield')).toBe(true);
  });

  it('returns false for disabled flags', () => {
    expect(service.isEnabled('roasting_enabled')).toBe(false);
  });

  it('returns false for unknown flags', () => {
    // @ts-expect-error testing runtime behavior with invalid flag name
    expect(service.isEnabled('nonexistent_flag')).toBe(false);
  });

  it('setFlag overrides default', () => {
    expect(service.isEnabled('roasting_enabled')).toBe(false);
    service.setFlag('roasting_enabled', true);
    expect(service.isEnabled('roasting_enabled')).toBe(true);
  });

  it('getAllFlags returns all defaults', () => {
    const all = service.getAllFlags();
    expect(all.enable_shield).toBe(true);
    expect(all.roasting_enabled).toBe(false);
  });
});
