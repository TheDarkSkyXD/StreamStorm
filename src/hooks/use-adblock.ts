/**
 * Ad Block Hook
 *
 * React hook for managing ad blocking settings from the renderer.
 */

import { useCallback, useEffect, useState } from "react";

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
    try {
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
    } catch (error) {
      console.error("[useAdBlock] Failed to refresh adblock status:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (options: { network?: boolean; cosmetic?: boolean }) => {
      try {
        const result = await window.electronAPI.adblock.toggle(options);
        setState((prev) => ({
          ...prev,
          networkBlockingEnabled: result.networkBlockingEnabled,
          cosmeticFilteringEnabled: result.cosmeticFilteringEnabled,
        }));
        return result;
      } catch (error) {
        console.error("[useAdBlock] Failed to toggle adblock:", error);
        // Refresh state from main process to ensure UI stays consistent
        await refresh();
        throw error;
      }
    },
    [refresh]
  );

  return { ...state, toggle, refresh };
}
