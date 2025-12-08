/**
 * React hooks for Electron API integration
 * 
 * These hooks provide a React-friendly way to interact with
 * the Electron main process via the preload bridge.
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * Check if running in Electron environment
 */
export function useIsElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

/**
 * Get the app version from the main process
 */
export function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getVersion().then(setVersion);
    }
  }, []);

  return version;
}

/**
 * Get the system theme preference
 */
export function useSystemTheme(): 'light' | 'dark' | null {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSystemTheme().then(setTheme);
    }
  }, []);

  return theme;
}

/**
 * Window control hooks
 */
export function useWindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Get initial state
    window.electronAPI.isMaximized().then(setIsMaximized);

    // Listen for changes
    const unsubscribe = window.electronAPI.onMaximizeChange(setIsMaximized);
    return unsubscribe;
  }, []);

  const minimize = useCallback(() => {
    window.electronAPI?.minimizeWindow();
  }, []);

  const maximize = useCallback(() => {
    window.electronAPI?.maximizeWindow();
  }, []);

  const close = useCallback(() => {
    window.electronAPI?.closeWindow();
  }, []);

  return {
    isMaximized,
    minimize,
    maximize,
    close,
  };
}

/**
 * Open external URL in default browser
 */
export function useOpenExternal() {
  return useCallback((url: string) => {
    window.electronAPI?.openExternal(url);
  }, []);
}

/**
 * Show desktop notification
 */
export function useNotification() {
  return useCallback((title: string, body: string) => {
    window.electronAPI?.showNotification(title, body);
  }, []);
}

/**
 * Storage hook for persisting data via main process
 */
export function useElectronStore<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!window.electronAPI) {
      setIsLoading(false);
      return;
    }

    window.electronAPI.store.get<T>(key).then((stored) => {
      if (stored !== null) {
        setValue(stored);
      }
      setIsLoading(false);
    });
  }, [key]);

  const set = useCallback(
    (newValue: T) => {
      setValue(newValue);
      window.electronAPI?.store.set(key, newValue);
    },
    [key]
  );

  const remove = useCallback(() => {
    setValue(defaultValue);
    window.electronAPI?.store.delete(key);
  }, [key, defaultValue]);

  return { value, set, remove, isLoading };
}
