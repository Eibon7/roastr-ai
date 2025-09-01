import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  ShoppingCart, 
  Zap, 
  BarChart3, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  CreditCard
} from 'lucide-react';
import { apiClient } from '../services/api';

const ShopSettings = ({ user, onNotification }) => {
  const [shopData, setShopData] = useState({
    addons: {},
    categories: {},
    isLoading: true
  });
  
  const [userAddons, setUserAddons] = useState({
    credits: { roasts: 0, analysis: 0 },
    features: { rqc_enabled: false },
    recentPurchases: [],
    isLoading: true
  });

  const [purchaseState, setPurchaseState] = useState({
    loading: false,
    error: null,
    success: null
  });

  // Create addon lookup map for performance optimization
  const addonLookupMap = useMemo(() => {
    const map = new Map();
    if (shopData.addons) {
      Object.values(shopData.addons).forEach(category => {
        if (Array.isArray(category)) {
          category.forEach(addon => {
            if (addon.key && addon.name) {
              map.set(addon.key, addon.name);
            }
          });
        }
      });
    }
    return map;
  }, [shopData.addons]);

  useEffect(() => {
    loadShopData();
    loadUserAddons();
  }, []);

  const loadShopData = async () => {
    try {
      const result = await apiClient.get('/shop/addons');
      if (result.success) {
        setShopData({
          addons: result.data.addons,
          categories: result.data.categories,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('Failed to load shop data:', error);
      setShopData(prev => ({ ...prev, isLoading: false }));
      onNotification?.('Error al cargar la tienda', 'error');
    }
  };

  const loadUserAddons = async () => {
    try {
      const result = await apiClient.get('/shop/user/addons');
      if (result.success) {
        setUserAddons({
          ...result.data,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('Failed to load user addons:', error);
      setUserAddons(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handlePurchase = async (addonKey) => {
    setPurchaseState({ loading: true, error: null, success: null });
    
    try {
      const result = await apiClient.post('/shop/checkout', { addonKey });
      
      if (result.success && result.data.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      setPurchaseState({
        loading: false,
        error: 'No se pudo completar la compra. Inténtalo de nuevo.',
        success: null
      });
      onNotification?.('Error en la compra', 'error');
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'roasts': return <Zap className="h-5 w-5" />;
      case 'analysis': return <BarChart3 className="h-5 w-5" />;
      case 'features': return <Shield className="h-5 w-5" />;
      default: return <ShoppingCart className="h-5 w-5" />;
    }
  };

  const renderAddonCard = (addon, category) => (
    <Card key={addon.key} className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            {getCategoryIcon(category)}
            <CardTitle className="text-lg">{addon.name}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-lg font-bold">
            {addon.price.formatted}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {addon.description}
        </p>
        
        {addon.type === 'credits' && (
          <div className="flex items-center space-x-2 mb-4">
            <Badge variant="outline">
              +{addon.creditAmount.toLocaleString()} créditos
            </Badge>
          </div>
        )}

        <Button 
          onClick={() => handlePurchase(addon.key)}
          disabled={purchaseState.loading}
          className="w-full"
        >
          {purchaseState.loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Comprar
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );

  const renderCurrentCredits = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5" />
          <span>Tus Créditos Actuales</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-primary">
              {userAddons.credits.roasts.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Roasts Extra</div>
          </div>
          
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-primary">
              {userAddons.credits.analysis.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Análisis Extra</div>
          </div>
          
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold">
              {userAddons.features.rqc_enabled ? (
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">RQC Activo</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (shopData.isLoading || userAddons.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ShoppingCart className="h-5 w-5" />
            <span>Shop</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div 
              className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
              role="status"
              aria-busy="true"
              aria-label="Cargando"
            ></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ShoppingCart className="h-5 w-5" />
            <span>Shop</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Mejora tu experiencia en Roastr con addons puntuales. Elige lo que necesitas y actívalo al instante.
          </p>
        </CardContent>
      </Card>

      {/* Error/Success Messages */}
      {purchaseState.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{purchaseState.error}</AlertDescription>
        </Alert>
      )}

      {purchaseState.success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{purchaseState.success}</AlertDescription>
        </Alert>
      )}

      {/* Current Credits */}
      {renderCurrentCredits()}

      {/* Shop Categories */}
      {Object.entries(shopData.addons).map(([category, addons]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {getCategoryIcon(category)}
              <span>{shopData.categories[category]}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {addons.map(addon => renderAddonCard(addon, category))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Recent Purchases */}
      {userAddons.recentPurchases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Compras Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {userAddons.recentPurchases.slice(0, 5).map((purchase, index) => {
                // Helper functions for formatting
                const formatAddonName = (addonKey) => {
                  // Use the optimized lookup map for O(1) performance
                  const addonName = addonLookupMap.get(addonKey);
                  if (addonName) return addonName;

                  // Fallback: convert addon_key to title case
                  return addonKey
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
                };

                const formatCurrency = (amountCents) => {
                  return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(amountCents / 100);
                };

                const formatDate = (dateString) => {
                  return new Date(dateString).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });
                };

                const formatStatus = (status) => {
                  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
                };

                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <div className="text-sm font-medium" aria-label={`Addon: ${formatAddonName(purchase.addon_key)}`}>
                        {formatAddonName(purchase.addon_key)}
                      </div>
                      {purchase.created_at && (
                        <div className="text-xs text-muted-foreground mt-1" aria-label={`Purchase date: ${formatDate(purchase.created_at)}`}>
                          {formatDate(purchase.created_at)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold" aria-label={`Amount: ${formatCurrency(purchase.amount_cents)}`}>
                        {formatCurrency(purchase.amount_cents)}
                      </span>
                      <Badge
                        variant={purchase.status === 'completed' ? 'default' : 'secondary'}
                        className="text-xs"
                        aria-label={`Status: ${formatStatus(purchase.status)}`}
                      >
                        {formatStatus(purchase.status)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShopSettings;
