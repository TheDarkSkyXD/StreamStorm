/**
 * Tests for Cosmetic Injection Service
 * 
 * Tests the CSS/scriptlet injection functionality.
 * Note: This is a unit test without Electron - mocks ipcMain and BrowserWindow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Electron modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));

// Import after mocking
import { cosmeticInjectionService } from '@/backend/services/cosmetic-injection-service';
import { ipcMain } from 'electron';

describe('cosmetic-injection-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure service is enabled
    cosmeticInjectionService.enable();
  });

  describe('initialize', () => {
    it('should register IPC handler for inject-cosmetics', () => {
      cosmeticInjectionService.initialize();
      
      expect(ipcMain.handle).toHaveBeenCalledWith(
        'adblock:inject-cosmetics',
        expect.any(Function)
      );
    });

    it('should not throw when called multiple times', () => {
      expect(() => {
        cosmeticInjectionService.initialize();
        cosmeticInjectionService.initialize();
      }).not.toThrow();
    });
  });

  describe('enable/disable', () => {
    it('should enable the service', () => {
      cosmeticInjectionService.disable();
      cosmeticInjectionService.enable();
      
      expect(cosmeticInjectionService.isActive()).toBe(true);
    });

    it('should disable the service', () => {
      cosmeticInjectionService.enable();
      cosmeticInjectionService.disable();
      
      expect(cosmeticInjectionService.isActive()).toBe(false);
    });
  });

  describe('isActive', () => {
    it('should return true when enabled', () => {
      cosmeticInjectionService.enable();
      expect(cosmeticInjectionService.isActive()).toBe(true);
    });

    it('should return false when disabled', () => {
      cosmeticInjectionService.disable();
      expect(cosmeticInjectionService.isActive()).toBe(false);
    });
  });

  describe('injectIntoWindow', () => {
    it('should not throw when service is disabled', async () => {
      cosmeticInjectionService.disable();
      
      const mockWindow = {
        webContents: {
          insertCSS: vi.fn().mockResolvedValue('css-key'),
          executeJavaScript: vi.fn().mockResolvedValue(undefined),
        },
      } as any;
      
      await expect(
        cosmeticInjectionService.injectIntoWindow(mockWindow)
      ).resolves.not.toThrow();
      
      // Should not call insertCSS when disabled
      expect(mockWindow.webContents.insertCSS).not.toHaveBeenCalled();
    });

    it('should inject CSS and scripts when enabled', async () => {
      cosmeticInjectionService.enable();
      
      const mockWindow = {
        webContents: {
          insertCSS: vi.fn().mockResolvedValue('css-key'),
          executeJavaScript: vi.fn().mockResolvedValue(undefined),
        },
      } as any;
      
      await cosmeticInjectionService.injectIntoWindow(mockWindow);
      
      expect(mockWindow.webContents.insertCSS).toHaveBeenCalledWith(
        expect.stringContaining('display: none'),
        { cssOrigin: 'user' }
      );
      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('StreamStorm AdBlock'),
        true
      );
    });

    it('should only inject once per window', async () => {
      cosmeticInjectionService.enable();
      
      const mockWebContents = {
        insertCSS: vi.fn().mockResolvedValue('css-key'),
        executeJavaScript: vi.fn().mockResolvedValue(undefined),
      };
      
      const mockWindow = { webContents: mockWebContents } as any;
      
      // Inject twice
      await cosmeticInjectionService.injectIntoWindow(mockWindow);
      await cosmeticInjectionService.injectIntoWindow(mockWindow);
      
      // Should only be called once due to WeakSet tracking
      expect(mockWebContents.insertCSS).toHaveBeenCalledTimes(1);
      expect(mockWebContents.executeJavaScript).toHaveBeenCalledTimes(1);
    });

    it('should handle injection errors gracefully', async () => {
      cosmeticInjectionService.enable();
      
      const mockWindow = {
        webContents: {
          insertCSS: vi.fn().mockRejectedValue(new Error('Injection failed')),
          executeJavaScript: vi.fn().mockResolvedValue(undefined),
        },
      } as any;
      
      // Should not throw, just log error
      await expect(
        cosmeticInjectionService.injectIntoWindow(mockWindow)
      ).resolves.not.toThrow();
    });
  });

  describe('IPC Handler Behavior', () => {
    it('should return injected: false when disabled', async () => {
      cosmeticInjectionService.initialize();
      cosmeticInjectionService.disable();
      
      // Get the registered handler
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call: any[]) => call[0] === 'adblock:inject-cosmetics'
      );
      
      expect(handleCall).toBeDefined();
      
      const handler = handleCall[1];
      const mockEvent = {
        sender: {
          insertCSS: vi.fn().mockResolvedValue('key'),
          executeJavaScript: vi.fn().mockResolvedValue(undefined),
        },
      };
      
      const result = await handler(mockEvent);
      expect(result).toEqual({ injected: false });
    });
  });
});

describe('CSS Content', () => {
  it('should include selectors for Twitch ad elements', async () => {
    cosmeticInjectionService.enable();
    
    const mockWindow = {
      webContents: {
        insertCSS: vi.fn().mockResolvedValue('css-key'),
        executeJavaScript: vi.fn().mockResolvedValue(undefined),
      },
    } as any;
    
    await cosmeticInjectionService.injectIntoWindow(mockWindow);
    
    const cssArg = mockWindow.webContents.insertCSS.mock.calls[0][0];
    
    // Check for key selectors
    expect(cssArg).toContain('ad-banner-default-text');
    expect(cssArg).toContain('sad-overlay');
    expect(cssArg).toContain('player-ad-overlay');
    expect(cssArg).toContain('display: none');
    expect(cssArg).toContain('visibility: hidden');
  });

  it('should ensure video visibility', async () => {
    cosmeticInjectionService.enable();
    
    const mockWindow = {
      webContents: {
        insertCSS: vi.fn().mockResolvedValue('css-key'),
        executeJavaScript: vi.fn().mockResolvedValue(undefined),
      },
    } as any;
    
    await cosmeticInjectionService.injectIntoWindow(mockWindow);
    
    const cssArg = mockWindow.webContents.insertCSS.mock.calls[0][0];
    
    expect(cssArg).toContain('video');
    expect(cssArg).toContain('visibility: visible');
  });
});

describe('Scriptlet Content', () => {
  it('should include abort-on-property-read pattern', async () => {
    cosmeticInjectionService.enable();
    
    const mockWindow = {
      webContents: {
        insertCSS: vi.fn().mockResolvedValue('css-key'),
        executeJavaScript: vi.fn().mockResolvedValue(undefined),
      },
    } as any;
    
    await cosmeticInjectionService.injectIntoWindow(mockWindow);
    
    const scriptArg = mockWindow.webContents.executeJavaScript.mock.calls[0][0];
    
    expect(scriptArg).toContain('abortOnPropertyRead');
    expect(scriptArg).toContain('Object.defineProperty');
    expect(scriptArg).toContain('StreamStorm AdBlock');
  });
});
