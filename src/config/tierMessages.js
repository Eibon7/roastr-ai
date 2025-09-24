/**
 * Tier Limit Messages - SPEC 10
 * User-facing error messages for tier limit violations
 */

const tierMessages = {
    // Analysis limit messages
    analysis: {
        free: {
            limit_exceeded: "Has alcanzado tu límite mensual de 100 análisis. Mejora a Starter para obtener 1,000 análisis mensuales.",
            near_limit: "Te quedan pocos análisis este mes. Mejora tu plan para obtener más análisis.",
            upgrade_cta: "Mejora a Starter por €5/mes para obtener 10x más análisis."
        },
        starter: {
            limit_exceeded: "Has alcanzado tu límite mensual de 1,000 análisis. Mejora a Pro para obtener 10,000 análisis mensuales.",
            near_limit: "Te quedan pocos análisis este mes. Mejora tu plan para obtener más análisis.",
            upgrade_cta: "Mejora a Pro por €15/mes para obtener 10x más análisis."
        },
        pro: {
            limit_exceeded: "Has alcanzado tu límite mensual de 10,000 análisis. Mejora a Plus para obtener 100,000 análisis mensuales.",
            near_limit: "Te quedan pocos análisis este mes. Mejora tu plan para obtener más análisis.",
            upgrade_cta: "Mejora a Plus por €50/mes para obtener 10x más análisis."
        },
        plus: {
            limit_exceeded: "Has alcanzado tu límite mensual de 100,000 análisis. Contacta con soporte para opciones enterprise.",
            near_limit: "Te quedan pocos análisis este mes.",
            upgrade_cta: "Contacta con soporte para opciones enterprise."
        }
    },

    // Roast limit messages
    roast: {
        free: {
            limit_exceeded: "Has alcanzado tu límite mensual de 10 roasts. Mejora a Starter para obtener 100 roasts mensuales.",
            near_limit: "Te quedan pocos roasts este mes. Mejora tu plan para obtener más roasts.",
            upgrade_cta: "Mejora a Starter por €5/mes para obtener 10x más roasts."
        },
        starter: {
            limit_exceeded: "Has alcanzado tu límite mensual de 100 roasts. Mejora a Pro para obtener 1,000 roasts mensuales.",
            near_limit: "Te quedan pocos roasts este mes. Mejora tu plan para obtener más roasts.",
            upgrade_cta: "Mejora a Pro por €15/mes para obtener 10x más roasts."
        },
        pro: {
            limit_exceeded: "Has alcanzado tu límite mensual de 1,000 roasts. Mejora a Plus para obtener 5,000 roasts mensuales.",
            near_limit: "Te quedan pocos roasts este mes. Mejora tu plan para obtener más roasts.",
            upgrade_cta: "Mejora a Plus por €50/mes para obtener 5x más roasts."
        },
        plus: {
            limit_exceeded: "Has alcanzado tu límite mensual de 5,000 roasts. Contacta con soporte para opciones enterprise.",
            near_limit: "Te quedan pocos roasts este mes.",
            upgrade_cta: "Contacta con soporte para opciones enterprise."
        }
    },

    // Platform limit messages
    platform: {
        free: {
            limit_exceeded: "Solo puedes conectar 1 cuenta por red social en el plan Free. Mejora a Pro para conectar 2 cuentas por red.",
            upgrade_cta: "Mejora a Pro por €15/mes para conectar múltiples cuentas."
        },
        starter: {
            limit_exceeded: "Solo puedes conectar 1 cuenta por red social en el plan Starter. Mejora a Pro para conectar 2 cuentas por red.",
            upgrade_cta: "Mejora a Pro por €15/mes para conectar múltiples cuentas."
        },
        pro: {
            limit_exceeded: "Has alcanzado el límite de 2 cuentas por red social en el plan Pro.",
            upgrade_cta: "Contacta con soporte para opciones enterprise si necesitas más cuentas."
        },
        plus: {
            limit_exceeded: "Has alcanzado el límite de 2 cuentas por red social en el plan Plus.",
            upgrade_cta: "Contacta con soporte para opciones enterprise si necesitas más cuentas."
        }
    },

    // Feature access messages
    features: {
        shield: {
            not_available: "Shield está disponible desde el plan Starter. Mejora tu plan para activar la protección automática.",
            upgrade_cta: "Mejora a Starter por €5/mes para activar Shield."
        },
        ENABLE_ORIGINAL_TONE: {
            not_available: "Original Tone está disponible desde el plan Pro. Mejora tu plan para personalizar completamente tus roasts.",
            upgrade_cta: "Mejora a Pro por €15/mes para activar Original Tone."
        },
        embedded_judge: {
            not_available: "Embedded Judge está disponible solo en el plan Plus. La función más avanzada de personalización.",
            upgrade_cta: "Mejora a Plus por €50/mes para activar Embedded Judge.",
            coming_soon: "Embedded Judge estará disponible próximamente en el plan Plus."
        }
    },

    // Plan change messages
    planChange: {
        upgrade: {
            success: "¡Upgrade completado! Tus límites se han reseteado inmediatamente.",
            processing: "Procesando tu upgrade. Los límites se aplicarán en unos segundos.",
            failed: "Error procesando el upgrade. Por favor, contacta con soporte."
        },
        downgrade: {
            scheduled: "Downgrade programado para el siguiente ciclo de facturación. Mantienes tu plan actual hasta entonces.",
            usage_exceeds: "No puedes hacer downgrade ahora porque tu uso actual excede los límites del nuevo plan. Inténtalo en el siguiente ciclo.",
            cancelled: "Downgrade pendiente cancelado exitosamente."
        }
    },

    // General upgrade CTAs by tier
    upgradeCtas: {
        free_to_starter: {
            title: "Mejora a Starter",
            price: "€5/mes",
            benefits: ["1,000 análisis mensuales", "100 roasts mensuales", "Shield activado"],
            cta: "Mejorar ahora"
        },
        starter_to_pro: {
            title: "Mejora a Pro", 
            price: "€15/mes",
            benefits: ["10,000 análisis mensuales", "1,000 roasts mensuales", "Original Tone", "2 cuentas por red"],
            cta: "Mejorar ahora"
        },
        pro_to_plus: {
            title: "Mejora a Plus",
            price: "€50/mes", 
            benefits: ["100,000 análisis mensuales", "5,000 roasts mensuales", "Embedded Judge", "Soporte dedicado"],
            cta: "Mejorar ahora"
        },
        to_enterprise: {
            title: "Contacta con ventas",
            price: "Personalizado",
            benefits: ["Límites personalizados", "Soporte 24/7", "Integraciones custom"],
            cta: "Contactar"
        }
    }
};

/**
 * Get appropriate message for tier limit
 * @param {string} limitType - Type of limit (analysis, roast, platform)
 * @param {string} currentTier - Current user tier
 * @param {string} messageType - Type of message (limit_exceeded, near_limit, upgrade_cta)
 * @returns {string} Localized message
 */
function getTierLimitMessage(limitType, currentTier, messageType = 'limit_exceeded') {
    const tierData = tierMessages[limitType]?.[currentTier];
    if (!tierData) {
        return `Límite de ${limitType} alcanzado. Mejora tu plan para obtener más acceso.`;
    }
    
    return tierData[messageType] || tierData.limit_exceeded;
}

/**
 * Get feature access message
 * @param {string} feature - Feature name
 * @param {string} messageType - Message type
 * @returns {string} Localized message
 */
function getFeatureMessage(feature, messageType = 'not_available') {
    const featureData = tierMessages.features[feature];
    if (!featureData) {
        return `Esta función no está disponible en tu plan actual.`;
    }
    
    return featureData[messageType] || featureData.not_available;
}

/**
 * Get upgrade CTA for current tier
 * @param {string} currentTier - Current tier
 * @param {string} targetTier - Target tier (optional)
 * @returns {Object} Upgrade CTA data
 */
function getUpgradeCta(currentTier, targetTier = null) {
    if (targetTier) {
        const ctaKey = `${currentTier}_to_${targetTier}`;
        return tierMessages.upgradeCtas[ctaKey] || tierMessages.upgradeCtas.to_enterprise;
    }
    
    // Default next tier upgrade
    const defaultUpgrades = {
        'free': tierMessages.upgradeCtas.free_to_starter,
        'starter': tierMessages.upgradeCtas.starter_to_pro,
        'pro': tierMessages.upgradeCtas.pro_to_plus,
        'plus': tierMessages.upgradeCtas.to_enterprise
    };
    
    return defaultUpgrades[currentTier] || tierMessages.upgradeCtas.to_enterprise;
}

/**
 * Get plan change message
 * @param {string} changeType - Change type (upgrade, downgrade)
 * @param {string} status - Status (success, processing, failed, scheduled, etc.)
 * @returns {string} Message
 */
function getPlanChangeMessage(changeType, status) {
    return tierMessages.planChange[changeType]?.[status] || 
           'Estado de cambio de plan desconocido.';
}

/**
 * Format usage warning message
 * @param {string} limitType - Limit type
 * @param {number} current - Current usage
 * @param {number} limit - Limit
 * @param {number} percentage - Usage percentage
 * @returns {Object} Formatted warning
 */
function formatUsageWarning(limitType, current, limit, percentage) {
    if (percentage >= 100) {
        return {
            level: 'error',
            message: `Has alcanzado tu límite de ${limitType} (${current}/${limit})`,
            action: 'upgrade_required'
        };
    } else if (percentage >= 80) {
        return {
            level: 'warning', 
            message: `Te queda poco uso de ${limitType} (${current}/${limit} - ${percentage}%)`,
            action: 'consider_upgrade'
        };
    } else if (percentage >= 60) {
        return {
            level: 'info',
            message: `Has usado ${percentage}% de tu límite de ${limitType} este mes`,
            action: 'monitor'
        };
    }
    
    return null;
}

module.exports = {
    tierMessages,
    getTierLimitMessage,
    getFeatureMessage,
    getUpgradeCta,
    getPlanChangeMessage,
    formatUsageWarning
};