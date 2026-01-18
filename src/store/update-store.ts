import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Update status types
 */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

// Valid status values for runtime validation
const UPDATE_STATUSES: UpdateStatus[] = [
  'idle',
  'checking',
  'available',
  'not-available',
  'downloading',
  'downloaded',
  'error',
];

// Type guard for UpdateStatus validation
const isUpdateStatus = (value: string): value is UpdateStatus =>
  UPDATE_STATUSES.includes(value as UpdateStatus);

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string | null;
  releaseName: string | null;
}

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

/**
 * Update store state for app auto-updates
 */
interface UpdateState {
  // State
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  allowPrerelease: boolean;
  isInitialized: boolean;

  // Actions
  setStatus: (status: UpdateStatus) => void;
  setUpdateInfo: (info: UpdateInfo | null) => void;
  setProgress: (progress: UpdateProgress | null) => void;
  setError: (error: string | null) => void;
  setAllowPrerelease: (allow: boolean) => void;
  setInitialized: (initialized: boolean) => void;

  // Bulk update from backend state
  updateFromBackend: (state: {
    status: string;
    updateInfo: UpdateInfo | null;
    progress: UpdateProgress | null;
    error: string | null;
    allowPrerelease: boolean;
  }) => void;

  // Reset state
  reset: () => void;
}

const initialState = {
  status: 'idle' as UpdateStatus,
  updateInfo: null,
  progress: null,
  error: null,
  allowPrerelease: false,
  isInitialized: false,
};

export const useUpdateStore = create<UpdateState>()(
  persist(
    (set) => ({
      ...initialState,

      setStatus: (status) => set({ status }),
      setUpdateInfo: (updateInfo) => set({ updateInfo }),
      setProgress: (progress) => set({ progress }),
      setError: (error) => set({ error }),
      setAllowPrerelease: (allowPrerelease) => set({ allowPrerelease }),
      setInitialized: (isInitialized) => set({ isInitialized }),

      updateFromBackend: (state) =>
        set({
          // Validate status and fall back to 'error' if invalid
          status: isUpdateStatus(state.status) ? state.status : 'error',
          updateInfo: state.updateInfo,
          progress: state.progress,
          error: state.error,
          allowPrerelease: state.allowPrerelease,
        }),

      reset: () => set(initialState),
    }),
    {
      name: 'update-store',
      // Only persist allowPrerelease preference - other state is ephemeral
      partialize: (state) => ({ allowPrerelease: state.allowPrerelease }),
    }
  )
);
