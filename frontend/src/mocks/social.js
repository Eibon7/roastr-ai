/**
 * Social Networks Mock Data
 * Realistic dataset for multi-account social network management
 */

// Import tone configuration from centralized config
import { TONE_EXAMPLES, TONE_OPTIONS } from '../config/tones';

export const MOCK_ACCOUNTS = [
  {
    id: 'acc_tw_1',
    network: 'twitter',
    handle: '@handle_1',
    status: 'active',
    monthlyRoasts: 4000,
    settings: {
      autoApprove: true,
      shieldEnabled: true,
      shieldLevel: 95,
      defaultTone: 'Flanders',
    },
  },
  {
    id: 'acc_tw_2',
    network: 'twitter',
    handle: '@handle_2',
    status: 'active',
    monthlyRoasts: 300,
    settings: {
      autoApprove: false,
      shieldEnabled: true,
      shieldLevel: 98,
      defaultTone: 'Canalla',
    },
  },
  {
    id: 'acc_ig_3',
    network: 'instagram',
    handle: '@handle_3',
    status: 'inactive',
    monthlyRoasts: 26,
    settings: {
      autoApprove: true,
      shieldEnabled: false,
      shieldLevel: 100,
      defaultTone: 'Balanceado',
    },
  },
];

export const MOCK_ROASTS = {
  acc_tw_1: [
    {
      id: 'r1',
      original: 'Tu código es una basura',
      roast: 'Gracias por tu comentario, me encanta tu entusiasmo por la basura.',
      createdAt: '2025-08-01T10:00:00Z',
      status: 'approved',
    },
    {
      id: 'r2',
      original: 'Nadie usa tu app',
      roast: 'Correcto, solo la gente con gusto exquisito. Por eso no te vi ahí.',
      createdAt: '2025-08-02T14:22:00Z',
      status: 'approved',
    },
    {
      id: 'r4',
      original: 'Este proyecto no tiene futuro',
      roast: 'Tienes razón, mi futuro está en no responderte. Pero aquí estamos.',
      createdAt: '2025-08-01T08:30:00Z',
      status: 'approved',
    },
  ],
  acc_tw_2: [
    {
      id: 'r3',
      original: 'Esto es lamentable',
      roast: 'Lamentable sería que no te contestara. Aquí tienes tu momento.',
      createdAt: '2025-08-03T09:05:00Z',
      status: 'pending',
    },
    {
      id: 'r5',
      original: 'No sabes programar',
      roast: 'Me enseñaste tú con este comentario. Gracias por la masterclass.',
      createdAt: '2025-08-03T11:15:00Z',
      status: 'pending',
    },
  ],
  acc_ig_3: [],
};

export const MOCK_INTERCEPTED = {
  acc_tw_1: [
    {
      id: 's1',
      category: 'Insultos graves',
      action: 'Ocultar comentario',
      preview: '***censurado***',
      originalHidden: 'Eres un **** y tu proyecto también',
      createdAt: '2025-08-03T11:40:00Z',
    },
    {
      id: 's4',
      category: 'Otros',
      action: 'Silenciar autor',
      preview: 'spam detectado',
      originalHidden: 'COMPRA SEGUIDORES AQUÍ CLICK CLICK CLICK',
      createdAt: '2025-08-02T15:22:00Z',
    },
  ],
  acc_tw_2: [
    {
      id: 's2',
      category: 'Amenazas',
      action: 'Reportar',
      preview: '***amenaza detectada***',
      originalHidden: 'Te voy a *** si vuelves a publicar eso',
      createdAt: '2025-08-04T16:12:00Z',
    },
    {
      id: 's3',
      category: 'Otros',
      action: 'Silenciar autor',
      preview: 'troll insistente',
      originalHidden: 'Spam repetitivo en 10 hilos',
      createdAt: '2025-08-04T17:20:00Z',
    },
  ],
  acc_ig_3: [],
};

export const MOCK_AVAILABLE_NETWORKS = [
  { network: 'twitter', name: 'X', connectedCount: 2 },
  { network: 'instagram', name: 'Instagram', connectedCount: 1 },
  { network: 'facebook', name: 'Facebook', connectedCount: 0 },
  { network: 'youtube', name: 'YouTube', connectedCount: 0 },
  { network: 'tiktok', name: 'TikTok', connectedCount: 0 },
  { network: 'linkedin', name: 'LinkedIn', connectedCount: 0 },
];

// Re-export for backward compatibility
export { TONE_EXAMPLES, TONE_OPTIONS };

export const SHIELD_LEVELS = [
  { value: 90, label: '90% (Más laxo)' },
  { value: 95, label: '95%' },
  { value: 98, label: '98% (Más estricto)' },
  { value: 100, label: '100% (El más estricto)' },
];

// Network icon mappings
export const NETWORK_ICONS = {
  twitter: '𝕏',
  instagram: '📷',
  facebook: '📘',
  youtube: '📺',
  tiktok: '🎵',
  linkedin: '💼',
};

export const NETWORK_COLORS = {
  twitter: 'bg-black text-white',
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
  facebook: 'bg-blue-600 text-white',
  youtube: 'bg-red-600 text-white',
  tiktok: 'bg-black text-white',
  linkedin: 'bg-blue-700 text-white',
};