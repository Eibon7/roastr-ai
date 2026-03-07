import { useState, useEffect } from "react";

type FeatureFlagResult = {
  enabled: boolean;
  loading: boolean;
};

const FLAG_CACHE_TTL = 5 * 60 * 1000;

const flagCache = new Map<string, { value: boolean; timestamp: number }>();

function getCached(flagName: string): boolean | null {
  const entry = flagCache.get(flagName);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > FLAG_CACHE_TTL) {
    flagCache.delete(flagName);
    return null;
  }
  return entry.value;
}

export function useFeatureFlag(flagName: string): FeatureFlagResult {
  const cached = getCached(flagName);

  const [enabled, setEnabled] = useState(cached ?? false);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    if (cached !== null) return;

    let cancelled = false;

    async function fetchFlag() {
      try {
        const res = await fetch(`/api/feature-flags/${flagName}`);
        if (!res.ok) throw new Error(res.statusText);
        const data: { enabled: boolean } = await res.json();

        flagCache.set(flagName, {
          value: data.enabled,
          timestamp: Date.now(),
        });

        if (!cancelled) {
          setEnabled(data.enabled);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setEnabled(false);
          setLoading(false);
        }
      }
    }

    fetchFlag();
    return () => {
      cancelled = true;
    };
  }, [flagName, cached]);

  return { enabled, loading };
}
