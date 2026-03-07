import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Thresholds, Weights } from '@roastr/shared';

type SsotCategory = 'thresholds' | 'weights' | 'feature_flags' | 'plan_limits' | 'platform_config';

type SsotEntry = {
  category: SsotCategory;
  key: string;
  value: unknown;
  updated_at: string;
};

@Injectable()
export class SsotService implements OnModuleInit {
  private cache = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly TTL_MS = 5 * 60 * 1000;
  private refreshing = false;

  async onModuleInit() {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    // Fallback defaults until Supabase SSOT table is connected
    const defaults: SsotEntry[] = [
      { category: 'thresholds', key: 'tau_low', value: 0.25, updated_at: new Date().toISOString() },
      { category: 'thresholds', key: 'tau_shield', value: 0.55, updated_at: new Date().toISOString() },
      { category: 'thresholds', key: 'tau_critical', value: 0.85, updated_at: new Date().toISOString() },
      { category: 'weights', key: 'linea_roja', value: 1.15, updated_at: new Date().toISOString() },
      { category: 'weights', key: 'identidad', value: 1.1, updated_at: new Date().toISOString() },
      { category: 'weights', key: 'tolerancia', value: 0.95, updated_at: new Date().toISOString() },
      { category: 'feature_flags', key: 'roasting_enabled', value: false, updated_at: new Date().toISOString() },
      { category: 'feature_flags', key: 'shield_enabled', value: true, updated_at: new Date().toISOString() },
      { category: 'plan_limits', key: 'starter_monthly_analyses', value: 1000, updated_at: new Date().toISOString() },
      { category: 'plan_limits', key: 'pro_monthly_analyses', value: 5000, updated_at: new Date().toISOString() },
      { category: 'plan_limits', key: 'plus_monthly_analyses', value: 25000, updated_at: new Date().toISOString() },
    ];

    const now = Date.now();
    for (const entry of defaults) {
      const cacheKey = `${entry.category}:${entry.key}`;
      this.cache.set(cacheKey, { value: entry.value, expiresAt: now + this.TTL_MS });
    }
  }

  get<T = unknown>(category: SsotCategory, key: string): T | undefined {
    const entry = this.cache.get(`${category}:${key}`);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      if (!this.refreshing) {
        this.refreshing = true;
        this.refresh().finally(() => { this.refreshing = false; });
      }
    }
    return entry.value as T;
  }

  getThresholds(): Thresholds {
    return {
      tau_low: this.get<number>('thresholds', 'tau_low') ?? 0.25,
      tau_shield: this.get<number>('thresholds', 'tau_shield') ?? 0.55,
      tau_critical: this.get<number>('thresholds', 'tau_critical') ?? 0.85,
    };
  }

  getWeights(): Weights {
    return {
      linea_roja: this.get<number>('weights', 'linea_roja') ?? 1.15,
      identidad: this.get<number>('weights', 'identidad') ?? 1.1,
      tolerancia: this.get<number>('weights', 'tolerancia') ?? 0.95,
    };
  }

  getFeatureFlag(key: string): boolean {
    return this.get<boolean>('feature_flags', key) ?? false;
  }

  getPlanLimit(key: string): number {
    return this.get<number>('plan_limits', key) ?? 0;
  }

  getCacheStats(): { size: number; ttlMs: number } {
    return { size: this.cache.size, ttlMs: this.TTL_MS };
  }
}
