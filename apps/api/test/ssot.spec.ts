import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SsotService } from '../src/shared/config/ssot.service';

describe('SsotService', () => {
  let service: SsotService;

  beforeEach(async () => {
    service = new SsotService();
    await service.onModuleInit();
  });

  it('loads default thresholds', () => {
    const t = service.getThresholds();
    expect(t.tau_low).toBe(0.25);
    expect(t.tau_shield).toBe(0.55);
    expect(t.tau_critical).toBe(0.85);
  });

  it('loads default weights', () => {
    const w = service.getWeights();
    expect(w.linea_roja).toBe(1.15);
    expect(w.identidad).toBe(1.1);
    expect(w.tolerancia).toBe(0.95);
  });

  it('returns feature flags', () => {
    expect(service.getFeatureFlag('shield_enabled')).toBe(true);
    expect(service.getFeatureFlag('roasting_enabled')).toBe(false);
  });

  it('returns plan limits', () => {
    expect(service.getPlanLimit('starter_monthly_analyses')).toBe(1000);
    expect(service.getPlanLimit('pro_monthly_analyses')).toBe(5000);
  });

  it('returns undefined for unknown keys', () => {
    expect(service.get('thresholds', 'nonexistent')).toBeUndefined();
  });

  it('returns stale value and triggers background refresh after TTL', async () => {
    vi.useFakeTimers();
    await service.refresh();

    expect(service.get('thresholds', 'tau_low')).toBe(0.25);

    vi.advanceTimersByTime(6 * 60 * 1000);
    expect(service.get('thresholds', 'tau_low')).toBe(0.25);

    vi.useRealTimers();
  });

  it('cache stats reflect loaded entries', () => {
    const stats = service.getCacheStats();
    expect(stats.size).toBeGreaterThan(0);
    expect(stats.ttlMs).toBe(5 * 60 * 1000);
  });
});
