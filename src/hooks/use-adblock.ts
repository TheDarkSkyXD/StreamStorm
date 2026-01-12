/**
 * Ad Block Hook
 * 
 * React hook for managing ad blocking settings from the renderer.
 */

import { useState, useEffect, useCallback } from 'react';

interface AdBlockState {
  networkBlockingEnabled: boolean;
  cosmeticFilteringEnabled: boolean;
  stats: {
    totalBlocked: number;
    byCategory: Record<string, number>;
  } | null;
  isLoading: boolean;
}

export function useAdBlock() {
  const [state, setState] = useState<AdBlockState>({
    networkBlockingEnabled: true,
    cosmeticFilteringEnabled: true,
    stats: null,
    isLoading: true,
  });

  const refresh = useCallback(async () => {
    const [status, stats] = await Promise.all([
      window.electronAPI.adblock.getStatus(),
      window.electronAPI.adblock.getStats(),
    ]);
    setState({
      networkBlockingEnabled: status.networkBlockingEnabled,
      cosmeticFilteringEnabled: status.cosmeticFilteringEnabled,
      stats,
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(async (options: { network?: boolean; cosmetic?: boolean }) => {
    const result = await window.electronAPI.adblock.toggle(options);
    setState(prev => ({
      ...prev,
      networkBlockingEnabled: result.networkBlockingEnabled,
      cosmeticFilteringEnabled: result.cosmeticFilteringEnabled,
    }));
    return result;
  }, []);

  return { ...state, toggle, refresh };
}
