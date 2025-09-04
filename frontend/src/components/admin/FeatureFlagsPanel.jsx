/**
 * Feature Flags Panel Component
 * Issue #294: Kill Switch global y panel de control de feature flags para administradores
 * 
 * Provides comprehensive feature flag management for administrators
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent 
} from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { 
  Settings, 
  Search, 
  Filter,
  Eye,
  EyeOff,
  Clock,
  User,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../../services/adminApi';

const FeatureFlagsPanel = () => {
  const [flags, setFlags] = useState([]);
  const [flagsByCategory, setFlagsByCategory] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [updatingFlags, setUpdatingFlags] = useState(new Set());

  useEffect(() => {
    loadFeatureFlags();
  }, []);

  const loadFeatureFlags = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getFeatureFlags();
      setFlags(response.data.flags);
      setFlagsByCategory(response.data.flagsByCategory);
      
      // Expand all categories by default
      const categories = Object.keys(response.data.flagsByCategory);
      const expanded = categories.reduce((acc, cat) => {
        acc[cat] = true;
        return acc;
      }, {});
      setExpandedCategories(expanded);
      
    } catch (error) {
      console.error('Failed to load feature flags:', error);
      toast.error('Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  const handleFlagToggle = async (flagKey, currentEnabled) => {
    try {
      setUpdatingFlags(prev => new Set(prev).add(flagKey));
      
      await adminApi.updateFeatureFlag(flagKey, {
        is_enabled: !currentEnabled
      });
      
      // Update local state
      setFlags(prevFlags => 
        prevFlags.map(flag => 
          flag.flag_key === flagKey 
            ? { ...flag, is_enabled: !currentEnabled }
            : flag
        )
      );
      
      // Update categorized flags
      setFlagsByCategory(prevCategorized => {
        const newCategorized = { ...prevCategorized };
        Object.keys(newCategorized).forEach(category => {
          newCategorized[category] = newCategorized[category].map(flag =>
            flag.flag_key === flagKey 
              ? { ...flag, is_enabled: !currentEnabled }
              : flag
          );
        });
        return newCategorized;
      });
      
      toast.success(`Feature flag ${!currentEnabled ? 'enabled' : 'disabled'}`);
      
    } catch (error) {
      console.error('Failed to update feature flag:', error);
      toast.error('Failed to update feature flag');
    } finally {
      setUpdatingFlags(prev => {
        const newSet = new Set(prev);
        newSet.delete(flagKey);
        return newSet;
      });
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const filteredFlags = flags.filter(flag => {
    const matchesSearch = flag.flag_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         flag.flag_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (flag.description && flag.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || flag.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryBadgeColor = (category) => {
    const colors = {
      system: 'bg-red-100 text-red-800',
      autopost: 'bg-blue-100 text-blue-800',
      ui: 'bg-green-100 text-green-800',
      experimental: 'bg-purple-100 text-purple-800',
      general: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.general;
  };

  const getFlagIcon = (flagKey) => {
    if (flagKey.includes('KILL_SWITCH')) return '🚨';
    if (flagKey.includes('AUTOPOST')) return '🤖';
    if (flagKey.includes('ENABLE')) return '⚡';
    if (flagKey.includes('SHIELD')) return '🛡️';
    return '🏁';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Feature Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Feature Flags
          </div>
          <Badge variant="outline">
            {flags.length} flags
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter Controls */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search flags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="all">All Categories</option>
            <option value="system">System</option>
            <option value="autopost">Autopost</option>
            <option value="ui">UI</option>
            <option value="experimental">Experimental</option>
            <option value="general">General</option>
          </select>
        </div>

        {/* Flags by Category */}
        <div className="space-y-4">
          {Object.entries(flagsByCategory).map(([category, categoryFlags]) => {
            const visibleFlags = categoryFlags.filter(flag => 
              filteredFlags.some(f => f.flag_key === flag.flag_key)
            );
            
            if (visibleFlags.length === 0) return null;
            
            return (
              <div key={category} className="border rounded-lg">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {expandedCategories[category] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <h3 className="font-medium capitalize">{category}</h3>
                    <Badge className={getCategoryBadgeColor(category)}>
                      {visibleFlags.length}
                    </Badge>
                  </div>
                </button>
                
                {expandedCategories[category] && (
                  <div className="border-t">
                    {visibleFlags.map((flag) => (
                      <div key={flag.flag_key} className="p-4 border-b last:border-b-0">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{getFlagIcon(flag.flag_key)}</span>
                              <h4 className="font-medium">{flag.flag_name}</h4>
                              <Badge 
                                variant={flag.is_enabled ? 'success' : 'secondary'}
                                className="text-xs"
                              >
                                {flag.is_enabled ? 'ON' : 'OFF'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {flag.description || 'No description available'}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>Key: {flag.flag_key}</span>
                              {flag.updated_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(flag.updated_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <Switch
                            checked={flag.is_enabled}
                            onCheckedChange={() => handleFlagToggle(flag.flag_key, flag.is_enabled)}
                            disabled={updatingFlags.has(flag.flag_key)}
                            className="ml-4"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredFlags.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No feature flags match your search criteria
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FeatureFlagsPanel;
