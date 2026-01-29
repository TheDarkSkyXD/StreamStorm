/**
 * useUpdater Hook
 * 
 * React hook for interacting with the app auto-update system.
 * Provides check, download, install operations and subscribes to status changes.
 */

import { useCallback, useEffect } from 'react';

import { useUpdateStore } from '@/store/update-store';
import type { UpdateInfo, UpdateProgress, UpdateStatus } from '@/store/update-store';

interface UseUpdaterReturn {
  // State
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  allowPrerelease: boolean;
  isInitialized: boolean;

  // Computed
  isChecking: boolean;
  isDownloading: boolean;
  isUpdateAvailable: boolean;
  isUpdateDownloaded: boolean;
  hasError: boolean;

  // Actions
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  setAllowPrerelease: (allow: boolean) => Promise<void>;
}

export function useUpdater(): UseUpdaterReturn {
  const store = useUpdateStore();

  // Initialize on mount - get current status and subscribe to changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.updater) {
      return;
    }

    // Get initial status
    const initializeStatus = async () => {
      try {
        const status = await window.electronAPI.updater.getStatus();
        store.updateFromBackend(status);
        store.setInitialized(true);
      } catch (error) {
        console.error('[useUpdater] Failed to get initial status:', error);
      }
    };

    initializeStatus();

    // Subscribe to status changes
    const unsubscribeStatus = window.electronAPI.updater.onStatusChange((state) => {
      store.updateFromBackend(state);
    });

    // Subscribe to progress updates
    const unsubscribeProgress = window.electronAPI.updater.onProgress((progress) => {
      store.setProgress(progress);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeProgress();
    };
  }, []);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    if (!window.electronAPI?.updater) return;
    
    try {
      const result = await window.electronAPI.updater.check();
      store.updateFromBackend({
        ...result,
        progress: null,
      });
    } catch (error) {
      console.error('[useUpdater] Check failed:', error);
      store.setError(error instanceof Error ? error.message : 'Failed to check for updates');
      store.setStatus('error');
    }
  }, []);

  // Download update
  const downloadUpdate = useCallback(async () => {
    if (!window.electronAPI?.updater) return;
    
    try {
      const result = await window.electronAPI.updater.download();
      store.updateFromBackend({
        ...result,
        allowPrerelease: store.allowPrerelease,
      });
    } catch (error) {
      console.error('[useUpdater] Download failed:', error);
      store.setError(error instanceof Error ? error.message : 'Failed to download update');
      store.setStatus('error');
    }
  }, [store.allowPrerelease]);

  // Install update (quits and restarts app)
  const installUpdate = useCallback(async () => {
    if (!window.electronAPI?.updater) return;
    
    try {
      await window.electronAPI.updater.install();
    } catch (error) {
      console.error('[useUpdater] Install failed:', error);
      store.setError(error instanceof Error ? error.message : 'Failed to install update');
      store.setStatus('error');
    }
  }, []);

  // Set allow pre-release preference
  const setAllowPrerelease = useCallback(async (allow: boolean) => {
    if (!window.electronAPI?.updater) return;
    
    try {
      const result = await window.electronAPI.updater.setAllowPrerelease(allow);
      store.setAllowPrerelease(result.allowPrerelease);
    } catch (error) {
      console.error('[useUpdater] Failed to set prerelease preference:', error);
    }
  }, []);

  return {
    // State
    status: store.status,
    updateInfo: store.updateInfo,
    progress: store.progress,
    error: store.error,
    allowPrerelease: store.allowPrerelease,
    isInitialized: store.isInitialized,

    // Computed
    isChecking: store.status === 'checking',
    isDownloading: store.status === 'downloading',
    isUpdateAvailable: store.status === 'available',
    isUpdateDownloaded: store.status === 'downloaded',
    hasError: store.status === 'error',

    // Actions
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    setAllowPrerelease,
  };
}

/**
 * Hook for just the update settings (pre-release toggle)
 */
export function useUpdateSettings() {
  const allowPrerelease = useUpdateStore((s) => s.allowPrerelease);
  const setAllowPrerelease = useUpdateStore((s) => s.setAllowPrerelease);

  const togglePrerelease = useCallback(async (allow: boolean) => {
    if (!window.electronAPI?.updater) return;
    
    try {
      const result = await window.electronAPI.updater.setAllowPrerelease(allow);
      setAllowPrerelease(result.allowPrerelease);
    } catch (error) {
      console.error('[useUpdateSettings] Failed to set prerelease preference:', error);
    }
  }, [setAllowPrerelease]);

  return {
    allowPrerelease,
    setAllowPrerelease: togglePrerelease,
  };
}
