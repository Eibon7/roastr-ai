import type { Platform } from "../types/analysis.js";
import type { PlatformCapabilities } from "../types/accounts.js";

export const PLATFORM_CAPABILITIES: Record<Platform, PlatformCapabilities> = {
  youtube: {
    canHide: true,
    canReport: true,
    canBlock: true,
    canReply: true,
    rateLimits: { requestsPerMinute: 60, dailyQuota: 10_000 },
  },
  x: {
    canHide: true,
    canReport: false,
    canBlock: true,
    canReply: true,
    rateLimits: { requestsPerMinute: 20, dailyQuota: null },
  },
  instagram: {
    canHide: true,
    canReport: false,
    canBlock: true,
    canReply: false,
    rateLimits: { requestsPerMinute: 60, dailyQuota: null },
  },
  tiktok: {
    canHide: true,
    canReport: false,
    canBlock: true,
    canReply: false,
    rateLimits: { requestsPerMinute: 60, dailyQuota: null },
  },
  facebook: {
    canHide: true,
    canReport: false,
    canBlock: true,
    canReply: true,
    rateLimits: { requestsPerMinute: 60, dailyQuota: null },
  },
  twitch: {
    canHide: true,
    canReport: false,
    canBlock: true,
    canReply: true,
    rateLimits: { requestsPerMinute: 20, dailyQuota: null },
  },
  reddit: {
    canHide: true,
    canReport: true,
    canBlock: true,
    canReply: true,
    rateLimits: { requestsPerMinute: 60, dailyQuota: null },
  },
  discord: {
    canHide: true,
    canReport: false,
    canBlock: true,
    canReply: true,
    rateLimits: { requestsPerMinute: 50, dailyQuota: null },
  },
  bluesky: {
    canHide: true,
    canReport: true,
    canBlock: true,
    canReply: true,
    rateLimits: { requestsPerMinute: 60, dailyQuota: null },
  },
  linkedin: {
    canHide: false,
    canReport: false,
    canBlock: false,
    canReply: false,
    rateLimits: { requestsPerMinute: 60, dailyQuota: null },
  },
};

export function getPlatformCapabilities(platform: Platform): PlatformCapabilities {
  return PLATFORM_CAPABILITIES[platform] ?? PLATFORM_CAPABILITIES.linkedin;
}
