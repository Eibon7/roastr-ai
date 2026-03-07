import { describe, it, expect } from 'vitest';
import { FeatureFlagService } from '../src/modules/feature-flags/feature-flag.service';

describe('FeatureFlagService', () => {
  it('returns true for enabled flags', () => {
    const service = new FeatureFlagService();
    expect(service.isEnabled('shield_enabled')).toBe(true);
  });

  it('returns false for disabled flags', () => {
    const service = new FeatureFlagService();
    expect(service.isEnabled('roasting_enabled')).toBe(false);
  });

  it('returns false for unknown flags', () => {
    const service = new FeatureFlagService();
    expect(service.isEnabled('nonexistent_flag')).toBe(false);
  });

  it('setFlag overrides default', () => {
    const service = new FeatureFlagService();
    expect(service.isEnabled('roasting_enabled')).toBe(false);
    service.setFlag('roasting_enabled', true);
    expect(service.isEnabled('roasting_enabled')).toBe(true);
  });

  it('getAllFlags returns all defaults', () => {
    const service = new FeatureFlagService();
    const all = service.getAllFlags();
    expect(all.shield_enabled).toBe(true);
    expect(all.roasting_enabled).toBe(false);
  });
});
