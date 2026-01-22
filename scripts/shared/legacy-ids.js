#!/usr/bin/env node

/**
 * Legacy IDs Definitions - Single Source of Truth
 * 
 * Este módulo centraliza todas las definiciones de IDs legacy V1
 * que deben ser bloqueadas en desarrollo V2.
 * 
 * Fuente autoritativa: docs/system-map-v2.yaml (sección legacy)
 * 
 * Issue: ROA-538
 * Fecha: 2025-01-22
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../src/utils/logger');

// Cache para evitar cargar múltiples veces
let cachedDefinitions = null;

/**
 * Carga definiciones legacy desde system-map-v2.yaml
 * o usa fallback hardcoded si no existe
 */
function loadLegacyDefinitions() {
  // Si ya están cacheadas, retornar
  if (cachedDefinitions) {
    return cachedDefinitions;
  }

  const systemMapPath = path.resolve(__dirname, '../../docs/system-map-v2.yaml');

  // Si existe system-map-v2.yaml, intentar cargarlo
  if (fs.existsSync(systemMapPath)) {
    try {
      // Cargar yaml (sin dependencia de js-yaml, parseo básico)
      const content = fs.readFileSync(systemMapPath, 'utf-8');
      
      // Parsear bloque legacy completo con todas las secciones
      // Captura: legacy:\n  workers:\n    - name: ...\n  services:\n    - name: ...\n  platforms:\n    - name: ...
      const legacyBlockMatch = content.match(/legacy:\s*\n((?:\s+(?:workers|services|platforms):\s*\n(?:\s+-\s+name:\s*.+\n)*)+)/);
      
      let workers = [];
      let services = [];
      let platforms = [];

      if (legacyBlockMatch) {
        const legacyBlock = legacyBlockMatch[0];

        // Parsear workers dentro del bloque legacy
        const workersMatch = legacyBlock.match(/workers:\s*\n((?:\s+-\s+name:\s*.+\n)+)/);
        if (workersMatch) {
          workers = workersMatch[1].match(/name:\s*([\w-]+)/g)?.map(m => m.replace('name:', '').trim()) || [];
        }

        // Parsear services dentro del bloque legacy
        const servicesMatch = legacyBlock.match(/services:\s*\n((?:\s+-\s+name:\s*.+\n)+)/);
        if (servicesMatch) {
          services = servicesMatch[1].match(/name:\s*([\w-]+)/g)?.map(m => m.replace('name:', '').trim()) || [];
        }

        // Parsear platforms dentro del bloque legacy
        const platformsMatch = legacyBlock.match(/platforms:\s*\n((?:\s+-\s+name:\s*.+\n)+)/);
        if (platformsMatch) {
          platforms = platformsMatch[1].match(/name:\s*([\w-]+)/g)?.map(m => m.replace('name:', '').trim()) || [];
        }
      }

      cachedDefinitions = {
        LEGACY_IDS: [
          'roast',
          'shield',
          'social-platforms',
          'frontend-dashboard',
          'plan-features',
          'persona',
        ],
        LEGACY_PLAN_IDS: ['free', 'basic', 'creator_plus'],
        LEGACY_BILLING_PROVIDERS: ['stripe'],
        LEGACY_WORKERS: workers.length > 0 ? workers : ['GenerateReplyWorker', 'PublisherWorker', 'BillingWorker'],
        LEGACY_SERVICES: services.length > 0 ? services : ['stripeService'],
        LEGACY_PLATFORMS: platforms.length > 0 ? platforms : ['instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'],
      };

      return cachedDefinitions;
    } catch (error) {
      // Si falla el parseo, usar fallback
      logger.warn(`⚠️  Error parseando system-map-v2.yaml: ${error.message}. Usando definiciones fallback.`);
    }
  }

  // Fallback hardcoded (si no existe system-map-v2.yaml o falla el parseo)
  cachedDefinitions = {
    LEGACY_IDS: [
      'roast',
      'shield',
      'social-platforms',
      'frontend-dashboard',
      'plan-features',
      'persona',
    ],
    LEGACY_PLAN_IDS: ['free', 'basic', 'creator_plus'],
    LEGACY_BILLING_PROVIDERS: ['stripe'],
    LEGACY_WORKERS: ['GenerateReplyWorker', 'PublisherWorker', 'BillingWorker'],
    LEGACY_SERVICES: ['stripeService'],
    LEGACY_PLATFORMS: ['instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'],
  };

  return cachedDefinitions;
}

/**
 * Obtiene IDs legacy
 */
function getLegacyIDs() {
  return loadLegacyDefinitions().LEGACY_IDS;
}

/**
 * Obtiene plan IDs legacy
 */
function getLegacyPlanIDs() {
  return loadLegacyDefinitions().LEGACY_PLAN_IDS;
}

/**
 * Obtiene billing providers legacy
 */
function getLegacyBillingProviders() {
  return loadLegacyDefinitions().LEGACY_BILLING_PROVIDERS;
}

/**
 * Obtiene workers legacy
 */
function getLegacyWorkers() {
  return loadLegacyDefinitions().LEGACY_WORKERS;
}

/**
 * Obtiene services legacy
 */
function getLegacyServices() {
  return loadLegacyDefinitions().LEGACY_SERVICES;
}

/**
 * Obtiene platforms legacy
 */
function getLegacyPlatforms() {
  return loadLegacyDefinitions().LEGACY_PLATFORMS;
}

/**
 * Obtiene todos los mappings en un solo objeto
 */
function getAllMappings() {
  const defs = loadLegacyDefinitions();
  return {
    ids: defs.LEGACY_IDS,
    planIds: defs.LEGACY_PLAN_IDS,
    billingProviders: defs.LEGACY_BILLING_PROVIDERS,
    workers: defs.LEGACY_WORKERS,
    services: defs.LEGACY_SERVICES,
    platforms: defs.LEGACY_PLATFORMS,
  };
}

/**
 * Resetea cache (útil para tests)
 */
function resetCache() {
  cachedDefinitions = null;
}

module.exports = {
  loadLegacyDefinitions,
  getLegacyIDs,
  getLegacyPlanIDs,
  getLegacyBillingProviders,
  getLegacyWorkers,
  getLegacyServices,
  getLegacyPlatforms,
  getAllMappings,
  resetCache,
  // Exportar también el array LEGACY_IDS directamente para compatibilidad
  LEGACY_IDS: getLegacyIDs,
};
