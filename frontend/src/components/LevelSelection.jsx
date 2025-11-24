/**
 * LevelSelection Component (Issue #597)
 * Roast and Shield level selector with plan-based validation
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert } from './ui/alert';
import { Flame, Shield, Lock, Info, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import apiClient from '../api/apiClient';
import { supabase } from '../lib/supabaseClient';

const LevelSelection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableLevels, setAvailableLevels] = useState(null);
  const [currentLevels, setCurrentLevels] = useState({ roast_level: 3, shield_level: 3 });
  const [planInfo, setPlanInfo] = useState({
    plan: 'starter_trial',
    maxRoastLevel: 3,
    maxShieldLevel: 3
  });

  useEffect(() => {
    loadAvailableLevels();
    loadCurrentLevels();
  }, [user]);

  const loadAvailableLevels = async () => {
    if (!user) return;

    try {
      const response = await apiClient.get('/config/levels/available');

      if (response.data.success) {
        setAvailableLevels(response.data.data);
        setPlanInfo({
          plan: response.data.data.plan,
          maxRoastLevel: response.data.data.roast.maxLevel,
          maxShieldLevel: response.data.data.shield.maxLevel
        });
      }
    } catch (error) {
      console.error('Error loading available levels:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available levels',
        variant: 'destructive'
      });
    }
  };

  const loadCurrentLevels = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', user.organization_id)
        .single();

      if (error) throw error;

      if (data?.settings) {
        setCurrentLevels({
          roast_level: data.settings.roast_level || 3,
          shield_level: data.settings.shield_level || 3
        });
      }
    } catch (error) {
      console.error('Error loading current levels:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLevel = async (type, level) => {
    if (!user) return;

    try {
      setSaving(true);

      // Validate access
      const response = await apiClient.post('/config/validate-levels', {
        roast_level: type === 'roast' ? level : currentLevels.roast_level,
        shield_level: type === 'shield' ? level : currentLevels.shield_level
      });

      if (!response.data.allowed) {
        toast({
          title: 'Upgrade Required',
          description: response.data.message,
          variant: 'warning'
        });
        return;
      }

      // Update in database
      const { error } = await supabase
        .from('organizations')
        .update({
          settings: {
            ...currentLevels,
            [type + '_level']: level
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', user.organization_id);

      if (error) throw error;

      setCurrentLevels((prev) => ({
        ...prev,
        [type + '_level']: level
      }));

      toast({
        title: 'Success',
        description: `${type === 'roast' ? 'Roast' : 'Shield'} level updated to ${level}`,
        variant: 'default'
      });
    } catch (error) {
      console.error('Error updating level:', error);
      toast({
        title: 'Error',
        description: 'Failed to update level',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const LevelButton = ({ level, type, currentLevel, maxLevel, config }) => {
    const isLocked = level > maxLevel;
    const isActive = level === currentLevel;

    return (
      <button
        onClick={() => !isLocked && updateLevel(type, level)}
        disabled={saving || isLocked}
        className={`
          relative p-4 border-2 rounded-lg transition-all
          ${isActive ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}
          ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {isLocked && (
          <div className="absolute top-2 right-2">
            <Lock className="w-4 h-4 text-gray-400" />
          </div>
        )}
        {isActive && (
          <Badge className="absolute top-2 left-2" variant="default">
            Active
          </Badge>
        )}
        <div className="text-lg font-bold mt-2">{config.name}</div>
        <div className="text-xs text-gray-500 mt-1">{config.description}</div>
        {isLocked && (
          <div className="mt-2 text-xs text-orange-500 font-medium flex items-center gap-1">
            <Crown className="w-3 h-3" />
            Requires upgrade
          </div>
        )}
      </button>
    );
  };

  if (loading || !availableLevels) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Level Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Info */}
      <Alert>
        <Info className="w-4 h-4" />
        <div className="ml-2 text-sm">
          <strong>Your Plan: {planInfo.plan.toUpperCase()}</strong>
          <br />
          Access levels 1-{planInfo.maxRoastLevel} for roasting and 1-{planInfo.maxShieldLevel} for
          shield. Upgrade to unlock higher levels.
        </div>
      </Alert>

      {/* Roast Levels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Roast Level
          </CardTitle>
          <CardDescription>
            Control the tone of generated roasts (Flanders, Balanceado, Canalla)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(availableLevels.roast.available).map(([level, config]) => (
              <LevelButton
                key={level}
                level={parseInt(level)}
                type="roast"
                currentLevel={currentLevels.roast_level}
                maxLevel={planInfo.maxRoastLevel}
                config={config}
              />
            ))}
            {/* Show locked levels */}
            {[...Array(5 - Object.keys(availableLevels.roast.available).length)].map((_, i) => {
              const level = Object.keys(availableLevels.roast.available).length + i + 1;
              const allLevels = {
                1: { name: 'Mild', description: 'Gentle' },
                2: { name: 'Neutral', description: 'Balanced' },
                3: { name: 'Moderate', description: 'Intense' },
                4: { name: 'Aggressive', description: 'Very intense' },
                5: { name: 'Caustic', description: 'Maximum' }
              };
              return (
                <LevelButton
                  key={level}
                  level={level}
                  type="roast"
                  currentLevel={currentLevels.roast_level}
                  maxLevel={planInfo.maxRoastLevel}
                  config={allLevels[level]}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Shield Levels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            Shield Level
          </CardTitle>
          <CardDescription>Configure toxicity detection sensitivity and moderation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(availableLevels.shield.available).map(([level, config]) => (
              <LevelButton
                key={level}
                level={parseInt(level)}
                type="shield"
                currentLevel={currentLevels.shield_level}
                maxLevel={planInfo.maxShieldLevel}
                config={config}
              />
            ))}
            {/* Show locked levels */}
            {[...Array(5 - Object.keys(availableLevels.shield.available).length)].map((_, i) => {
              const level = Object.keys(availableLevels.shield.available).length + i + 1;
              const allLevels = {
                1: { name: 'Tolerant', description: 'High threshold' },
                2: { name: 'Balanced-Tolerant', description: 'Moderate' },
                3: { name: 'Balanced', description: 'Standard' },
                4: { name: 'Balanced-Strict', description: 'Strict bias' },
                5: { name: 'Strict', description: 'Very strict' }
              };
              return (
                <LevelButton
                  key={level}
                  level={level}
                  type="shield"
                  currentLevel={currentLevels.shield_level}
                  maxLevel={planInfo.maxShieldLevel}
                  config={allLevels[level]}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LevelSelection;
