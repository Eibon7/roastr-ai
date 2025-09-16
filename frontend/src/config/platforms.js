import {
  Twitter,
  Instagram,
  Youtube,
  Facebook,
  MessageCircle,
  Twitch,
  Users,
  PlayCircle
} from 'lucide-react';

// Platform icons mapping
export const platformIcons = {
  twitter: Twitter,
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  discord: MessageCircle,
  twitch: Twitch,
  reddit: Users,
  tiktok: PlayCircle,
  bluesky: Twitter // Using Twitter icon as placeholder for Bluesky
};

// Platform display names
export const platformNames = {
  twitter: 'X (Twitter)',
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  discord: 'Discord',
  twitch: 'Twitch',
  reddit: 'Reddit',
  tiktok: 'TikTok',
  bluesky: 'Bluesky'
};

// Available platforms list
export const allPlatforms = [
  'twitter',
  'instagram', 
  'youtube',
  'facebook',
  'discord',
  'twitch',
  'reddit',
  'tiktok',
  'bluesky'
];

// Get platform icon component
export const getPlatformIcon = (platform) => {
  return platformIcons[platform] || MessageCircle;
};

// Get platform display name
export const getPlatformName = (platform) => {
  return platformNames[platform] || platform;
};