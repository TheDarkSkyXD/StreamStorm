/**
 * Tests for Twitch Ad-Block Zustand Store
 * 
 * Tests the adblock-store.ts state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAdBlockStore } from '@/store/adblock-store';

describe('adblock-store', () => {
  beforeEach(() => {
    // Reset store to default state
    useAdBlockStore.setState({ enableAdBlock: true });
  });

  describe('Initial State', () => {
    it('should have ad-block enabled by default', () => {
      const state = useAdBlockStore.getState();
      expect(state.enableAdBlock).toBe(true);
    });
  });

  describe('setEnableAdBlock', () => {
    it('should enable ad-block', () => {
      const { setEnableAdBlock } = useAdBlockStore.getState();
      
      setEnableAdBlock(true);
      
      expect(useAdBlockStore.getState().enableAdBlock).toBe(true);
    });

    it('should disable ad-block', () => {
      const { setEnableAdBlock } = useAdBlockStore.getState();
      
      setEnableAdBlock(false);
      
      expect(useAdBlockStore.getState().enableAdBlock).toBe(false);
    });
  });

  describe('toggleAdBlock', () => {
    it('should toggle from enabled to disabled', () => {
      useAdBlockStore.setState({ enableAdBlock: true });
      const { toggleAdBlock } = useAdBlockStore.getState();
      
      toggleAdBlock();
      
      expect(useAdBlockStore.getState().enableAdBlock).toBe(false);
    });

    it('should toggle from disabled to enabled', () => {
      useAdBlockStore.setState({ enableAdBlock: false });
      const { toggleAdBlock } = useAdBlockStore.getState();
      
      toggleAdBlock();
      
      expect(useAdBlockStore.getState().enableAdBlock).toBe(true);
    });

    it('should toggle multiple times correctly', () => {
      const { toggleAdBlock } = useAdBlockStore.getState();
      const initialState = useAdBlockStore.getState().enableAdBlock;
      
      toggleAdBlock();
      expect(useAdBlockStore.getState().enableAdBlock).toBe(!initialState);
      
      toggleAdBlock();
      expect(useAdBlockStore.getState().enableAdBlock).toBe(initialState);
      
      toggleAdBlock();
      expect(useAdBlockStore.getState().enableAdBlock).toBe(!initialState);
    });
  });

  describe('Selector Usage', () => {
    it('should allow selecting enableAdBlock state', () => {
      useAdBlockStore.setState({ enableAdBlock: true });
      
      // Simulate selector usage like in React components
      const enableAdBlock = useAdBlockStore.getState().enableAdBlock;
      
      expect(enableAdBlock).toBe(true);
    });

    it('should allow selecting actions', () => {
      const setEnableAdBlock = useAdBlockStore.getState().setEnableAdBlock;
      const toggleAdBlock = useAdBlockStore.getState().toggleAdBlock;
      
      expect(typeof setEnableAdBlock).toBe('function');
      expect(typeof toggleAdBlock).toBe('function');
    });
  });

  describe('State Isolation', () => {
    it('should maintain state after multiple operations', () => {
      const { setEnableAdBlock, toggleAdBlock } = useAdBlockStore.getState();
      
      setEnableAdBlock(true);
      expect(useAdBlockStore.getState().enableAdBlock).toBe(true);
      
      toggleAdBlock();
      expect(useAdBlockStore.getState().enableAdBlock).toBe(false);
      
      setEnableAdBlock(true);
      expect(useAdBlockStore.getState().enableAdBlock).toBe(true);
    });
  });
});
