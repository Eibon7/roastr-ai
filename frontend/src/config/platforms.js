/**
 * Platform Configuration for Roastr.ai
 *
 * This file contains all platform-specific configurations including:
 * - Icons and visual representation
 * - Display names and branding
 * - Platform colors and themes
 * - Character limits and constraints
 * - Connection status and availability
 *
 * @version 1.2.0
 * @author Roastr.ai Team
 */

import { normalizePlanId } from '../utils/planHelpers';
import {
  Twitter,
  Instagram,
  Youtube,
  Facebook,
  MessageCircle,
  Twitch,
  Users,
  PlayCircle,
  MessageSquare,
  Video,
  Hash
} from 'lucide-react';

// Platform icons mapping with platform-specific icons
export const platformIcons = {
  twitter: Twitter,
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  discord: MessageCircle, // TODO: Add Discord-specific icon when available
  twitch: Twitch, // Using platform-specific Twitch icon
  reddit: MessageSquare, // TODO: Add Reddit-specific icon when available
  tiktok: PlayCircle, // TODO: Add TikTok-specific icon when available
  bluesky: Hash, // TODO: Add Bluesky-specific icon when available
  linkedin: Users // Using Users icon for professional networking
};

// Platform display names with consistent branding
export const platformNames = {
  twitter: 'X (Twitter)',
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  discord: 'Discord',
  twitch: 'Twitch',
  reddit: 'Reddit',
  tiktok: 'TikTok',
  bluesky: 'Bluesky',
  linkedin: 'LinkedIn'
};

// Platform brand colors for UI consistency
export const platformColors = {
  twitter: '#1DA1F2', // Classic Twitter blue
  instagram: '#E4405F', // Instagram gradient primary
  youtube: '#FF0000', // YouTube red
  facebook: '#1877F2', // Facebook blue
  discord: '#5865F2', // Discord blurple
  twitch: '#9146FF', // Twitch purple
  reddit: '#FF4500', // Reddit orange
  tiktok: '#000000', // TikTok black
  bluesky: '#0085ff', // Bluesky blue
  linkedin: '#0077B5' // LinkedIn blue
};

// Platform-specific character limits for content optimization
export const platformLimits = {
  twitter: { post: 280, reply: 280 },
  instagram: { post: 2200, reply: 2200 },
  youtube: { comment: 10000 },
  facebook: { post: 63206, reply: 8000 },
  discord: { message: 2000 },
  twitch: { chat: 500 },
  reddit: { comment: 10000 },
  tiktok: { comment: 150 },
  bluesky: { post: 300 },
  linkedin: { post: 3000, comment: 1250 }
};

// Platform descriptions for user guidance
export const platformDescriptions = {
  twitter: 'Microblogging platform perfect for quick, witty responses',
  instagram: 'Visual social network focused on photos and stories',
  youtube: 'Video platform with comment-based community interaction',
  facebook: 'Social network with diverse content and community features',
  discord: 'Chat platform popular with gaming and tech communities',
  twitch: 'Live streaming platform with real-time chat engagement',
  reddit: 'Forum-based platform with topic-specific communities',
  tiktok: 'Short-form video platform with younger demographics',
  bluesky: 'Decentralized social network similar to Twitter',
  linkedin: 'Professional networking platform for business content'
};

// Available platforms list (ordered by popularity/priority)
export const allPlatforms = [
  'twitter',
  'instagram',
  'youtube',
  'facebook',
  'discord',
  'twitch',
  'reddit',
  'tiktok',
  'bluesky',
  'linkedin'
];

// Premium platforms that require Pro+ plans
export const premiumPlatforms = ['linkedin', 'bluesky'];

/**
 * Get platform icon component
 * @param {string} platform - Platform identifier (e.g., 'twitter', 'instagram')
 * @returns {React.Component} - Lucide React icon component
 */
export const getPlatformIcon = (platform) => {
  return platformIcons[platform] || MessageCircle;
};

/**
 * Get platform display name
 * @param {string} platform - Platform identifier
 * @returns {string} - Human-readable platform name
 */
export const getPlatformName = (platform) => {
  return platformNames[platform] || platform;
};

/**
 * Get platform brand color
 * @param {string} platform - Platform identifier
 * @returns {string} - Hex color code for platform branding
 */
export const getPlatformColor = (platform) => {
  return platformColors[platform] || '#6B7280'; // Default gray
};

/**
 * Get platform character limit for specific content type
 * @param {string} platform - Platform identifier
 * @param {string} type - Content type ('post', 'reply', 'comment', 'message')
 * @returns {number} - Character limit for the platform and content type
 */
export const getPlatformLimit = (platform, type = 'post') => {
  const limits = platformLimits[platform];
  if (!limits) return 280; // Default Twitter-like limit
  return limits[type] || limits.post || limits.message || 280;
};

/**
 * Get platform description
 * @param {string} platform - Platform identifier
 * @returns {string} - Platform description for user guidance
 */
export const getPlatformDescription = (platform) => {
  return platformDescriptions[platform] || 'Social media platform';
};

/**
 * Check if platform requires premium plan
 * @param {string} platform - Platform identifier
 * @returns {boolean} - True if platform requires premium subscription
 */
export const isPremiumPlatform = (platform) => {
  return premiumPlatforms.includes(platform);
};

/**
 * Get platforms available for a specific plan
 * @param {string} plan - Subscription plan ('starter_trial', 'starter', 'pro', 'plus')
 * @returns {string[]} - Array of platform identifiers available for the plan
 */
export const getPlatformsForPlan = (plan) => {
  const normalizedPlan = normalizePlanId(plan);

  const basePlatforms = ['twitter', 'instagram', 'youtube', 'facebook'];
  const standardPlatforms = [...basePlatforms, 'discord', 'twitch', 'reddit'];
  const premiumPlatformsAll = [...standardPlatforms, 'tiktok', 'bluesky', 'linkedin'];

  switch (normalizedPlan) {
    case 'starter_trial':
    case 'starter':
      return standardPlatforms;
    case 'pro':
      return standardPlatforms;
    case 'plus':
      return premiumPlatformsAll;
    default:
      return standardPlatforms; // Default to starter level
  }
};

// Platform configuration object for easy access
export const platformConfig = allPlatforms.reduce((config, platform) => {
  config[platform] = {
    name: getPlatformName(platform),
    icon: getPlatformIcon(platform),
    color: getPlatformColor(platform),
    description: getPlatformDescription(platform),
    limits: platformLimits[platform] || { post: 280 },
    isPremium: isPremiumPlatform(platform)
  };
  return config;
}, {});
