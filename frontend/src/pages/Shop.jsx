import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ShoppingBag, Star, Zap, Shield, Palette, Crown } from 'lucide-react';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

/**
 * Shop Page Component
 *
 * Página de tienda para addons y funcionalidades premium
 * Solo visible cuando el feature flag ENABLE_SHOP está activo
 */
export default function Shop() {
  const { flags = {}, loading: flagsLoading } = useFeatureFlags();

  // Determine if purchases are enabled based on feature flag
  const purchasesEnabled = flags.ENABLE_SHOP === true;

  const addons = [
    {
      id: 'premium-tones',
      name: 'Tonos Premium',
      description: 'Acceso a tonos exclusivos como "Intelectual", "Millennial" y "Gen Z"',
      price: '$4.99',
      period: '/mes',
      icon: Palette,
      features: [
        'Tono Intelectual con referencias culturales',
        'Tono Millennial con nostalgia de los 90s',
        'Tono Gen Z con jerga actual',
        'Personalización avanzada de tono'
      ],
      popular: false
    },
    {
      id: 'shield-pro',
      name: 'Shield Pro',
      description: 'Protección avanzada contra contenido inapropiado y filtros personalizables',
      price: '$9.99',
      period: '/mes',
      icon: Shield,
      features: [
        'Filtros de contenido personalizables',
        'Detección de contexto sensible',
        'Whitelist/blacklist de palabras',
        'Reportes de seguridad detallados'
      ],
      popular: true
    },
    {
      id: 'roast-boost',
      name: 'Roast Boost',
      description: 'Generación de roasts más rápida y con mayor creatividad',
      price: '$7.99',
      period: '/mes',
      icon: Zap,
      features: [
        'Generación 3x más rápida',
        'Algoritmos de creatividad mejorados',
        'Múltiples variaciones por roast',
        'Prioridad en la cola de procesamiento'
      ],
      popular: false
    },
    {
      id: 'analytics-pro',
      name: 'Analytics Pro',
      description: 'Métricas avanzadas y análisis de engagement de tus roasts',
      price: '$12.99',
      period: '/mes',
      icon: Star,
      features: [
        'Métricas de engagement detalladas',
        'Análisis de sentimiento de respuestas',
        'Reportes de rendimiento por plataforma',
        'Exportación de datos en CSV/PDF'
      ],
      popular: false
    }
  ];

  const handlePurchase = (addonId) => {
    // Purchase logic handled by backend API
    // Future implementation will redirect to checkout
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <ShoppingBag className="h-12 w-12 text-primary mr-3" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Roastr Shop</h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Potencia tu experiencia con Roastr con addons premium que llevan tus roasts al siguiente
          nivel
        </p>
      </div>

      {/* Beta Notice */}
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-3">
            <Crown className="h-6 w-6 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                🚧 Próximamente disponible
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                La tienda de Roastr está en desarrollo. Estos addons estarán disponibles pronto.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Addons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {addons.map((addon) => {
          const IconComponent = addon.icon;

          return (
            <Card
              key={addon.id}
              className={`relative ${addon.popular ? 'ring-2 ring-primary' : ''}`}
            >
              {addon.popular && (
                <Badge className="absolute -top-2 left-4 bg-primary text-primary-foreground">
                  Más popular
                </Badge>
              )}

              <CardHeader>
                <CardTitle className="flex items-center space-x-3">
                  <IconComponent className="h-6 w-6 text-primary" />
                  <span>{addon.name}</span>
                </CardTitle>
                <p className="text-muted-foreground">{addon.description}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Price */}
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {addon.price}
                  </span>
                  <span className="text-muted-foreground">{addon.period}</span>
                </div>

                {/* Features */}
                <ul className="space-y-2">
                  {addon.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Action Button */}
                <Button
                  onClick={() => handlePurchase(addon.id)}
                  className="w-full"
                  variant={addon.popular ? 'default' : 'outline'}
                  disabled={flagsLoading || !purchasesEnabled}
                >
                  {flagsLoading
                    ? 'Cargando...'
                    : purchasesEnabled
                      ? addon.popular
                        ? 'Obtener ahora'
                        : 'Comprar'
                      : 'Próximamente'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              ¿Tienes alguna sugerencia?
            </h3>
            <p className="text-sm text-muted-foreground">
              Estamos trabajando en nuevos addons. Si tienes ideas para funcionalidades premium,
              contáctanos en{' '}
              <a href="mailto:shop@roastr.ai" className="text-primary hover:underline">
                shop@roastr.ai
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
