import { Injectable } from '@nestjs/common';

const DEFAULT_FLAGS: Record<string, boolean> = {
  roasting_enabled: false,
  shield_enabled: true,
  analysis_enabled: true,
  billing_enabled: true,
  admin_panel_enabled: false,
  persona_enabled: true,
  x_platform_enabled: true,
  youtube_platform_enabled: true,
};

@Injectable()
export class FeatureFlagService {
  // TODO: Replace with SsotService.getFlags() when SsotService is implemented
  private flags: Map<string, boolean>;

  constructor() {
    this.flags = new Map(Object.entries(DEFAULT_FLAGS));
  }

  isEnabled(flagName: string): boolean {
    return this.flags.get(flagName) ?? false;
  }

  getAllFlags(): Record<string, boolean> {
    return Object.fromEntries(this.flags);
  }

  setFlag(flagName: string, value: boolean): void {
    this.flags.set(flagName, value);
  }
}
