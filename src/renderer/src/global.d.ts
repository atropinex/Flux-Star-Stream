import type { ElectronApi } from '../../shared/types';

// Tells TypeScript about window.api, which the preload script adds.
declare global {
  interface Window {
    api: ElectronApi;
  }
}

export {};
