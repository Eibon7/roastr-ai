import { describe, it, expect } from "vitest";
import {
  getPlatformCapabilities,
  PLATFORM_CAPABILITIES,
} from "../src/platforms/platform-capabilities";
import type { Platform } from "../src/types/analysis";

const ALL_PLATFORMS: Platform[] = [
  "youtube",
  "x",
  "instagram",
  "tiktok",
  "facebook",
  "twitch",
  "reddit",
  "discord",
  "bluesky",
  "linkedin",
];

describe("getPlatformCapabilities", () => {
  it.each(ALL_PLATFORMS)("returns the exact capabilities entry for %s", (platform) => {
    expect(getPlatformCapabilities(platform)).toBe(PLATFORM_CAPABILITIES[platform]);
  });

  it("falls back to linkedin's (fully-locked-down) capabilities for an unknown platform", () => {
    const unknown = "myspace" as Platform;
    const result = getPlatformCapabilities(unknown);
    expect(result).toBe(PLATFORM_CAPABILITIES.linkedin);
    expect(result).toEqual({
      canHide: false,
      canReport: false,
      canBlock: false,
      canReply: false,
      rateLimits: { requestsPerMinute: 60, dailyQuota: null },
    });
  });

  it("youtube supports every moderation action and has a bounded daily quota", () => {
    const caps = getPlatformCapabilities("youtube");
    expect(caps.canHide && caps.canReport && caps.canBlock && caps.canReply).toBe(true);
    expect(caps.rateLimits.dailyQuota).toBe(10_000);
  });

  it("x cannot report and has no daily quota cap", () => {
    const caps = getPlatformCapabilities("x");
    expect(caps.canReport).toBe(false);
    expect(caps.rateLimits.dailyQuota).toBeNull();
  });

  it("instagram and tiktok cannot reply to comments", () => {
    expect(getPlatformCapabilities("instagram").canReply).toBe(false);
    expect(getPlatformCapabilities("tiktok").canReply).toBe(false);
  });
});
