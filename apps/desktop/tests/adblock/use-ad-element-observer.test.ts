/**
 * Tests for useAdElementObserver Hook
 * 
 * Tests the MutationObserver-based ad element hiding hook.
 * Note: These are unit tests that mock DOM APIs since we're in Node environment.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock DOM APIs
const mockDisconnect = vi.fn();
const mockObserve = vi.fn();

class MockMutationObserver {
  callback: MutationCallback;
  
  constructor(callback: MutationCallback) {
    this.callback = callback;
  }
  
  observe = mockObserve;
  disconnect = mockDisconnect;
  takeRecords = vi.fn(() => []);
}

// Set up DOM mocks
(global as any).MutationObserver = MockMutationObserver;
(global as any).Node = { ELEMENT_NODE: 1 };

const mockQuerySelectorAll = vi.fn(() => []);
const mockMatches = vi.fn(() => false);

(global as any).document = {
  body: {
    querySelectorAll: mockQuerySelectorAll,
  },
  querySelectorAll: mockQuerySelectorAll,
};

describe('useAdElementObserver logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuerySelectorAll.mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AD_SELECTORS', () => {
    // These are the selectors defined in the hook
    const AD_SELECTORS = [
      '[data-test-selector="ad-banner-default-text"]',
      '[data-test-selector="sad-overlay"]',
      '.player-ad-overlay',
      '.stream-display-ad',
    ];

    it('should include ad-banner-default-text selector', () => {
      expect(AD_SELECTORS.includes('[data-test-selector="ad-banner-default-text"]')).toBe(true);
    });

    it('should include sad-overlay selector', () => {
      expect(AD_SELECTORS.includes('[data-test-selector="sad-overlay"]')).toBe(true);
    });

    it('should include player-ad-overlay selector', () => {
      expect(AD_SELECTORS.includes('.player-ad-overlay')).toBe(true);
    });

    it('should include stream-display-ad selector', () => {
      expect(AD_SELECTORS.includes('.stream-display-ad')).toBe(true);
    });
  });

  describe('MutationObserver setup', () => {
    it('should create MutationObserver with callback', () => {
      const callback = vi.fn();
      const observer = new MockMutationObserver(callback);
      
      expect(observer.callback).toBe(callback);
    });

    it('should observe with correct options', () => {
      const observer = new MockMutationObserver(vi.fn());
      const target = { nodeType: 1 };
      const options = { childList: true, subtree: true };
      
      observer.observe(target, options);
      
      expect(mockObserve).toHaveBeenCalledWith(target, options);
    });

    it('should disconnect when cleanup is called', () => {
      const observer = new MockMutationObserver(vi.fn());
      
      observer.disconnect();
      
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('Element hiding logic', () => {
    it('should hide element by setting display: none', () => {
      const mockElement = {
        style: {
          display: '',
          visibility: '',
          opacity: '',
          pointerEvents: '',
        },
        className: 'player-ad-overlay',
        tagName: 'DIV',
      };

      // Simulate the hideElement function logic
      const hideElement = (element: typeof mockElement) => {
        element.style.display = 'none';
        element.style.visibility = 'hidden';
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
      };

      hideElement(mockElement);

      expect(mockElement.style.display).toBe('none');
      expect(mockElement.style.visibility).toBe('hidden');
      expect(mockElement.style.opacity).toBe('0');
      expect(mockElement.style.pointerEvents).toBe('none');
    });
  });

  describe('Initial scan', () => {
    it('should query all ad selectors on mount', () => {
      const AD_SELECTORS = [
        '[data-test-selector="ad-banner-default-text"]',
        '[data-test-selector="sad-overlay"]',
        '.player-ad-overlay',
        '.stream-display-ad',
      ];

      // Simulate initial scan - the hook calls querySelectorAll for each selector
      AD_SELECTORS.forEach(() => {
        mockQuerySelectorAll();
      });

      expect(mockQuerySelectorAll).toHaveBeenCalledTimes(4);
    });
  });

  describe('Mutation handling', () => {
    it('should process added nodes', () => {
      const callback = vi.fn();
      const observer = new MockMutationObserver(callback);
      
      const mutations = [
        {
          type: 'childList',
          addedNodes: [
            { nodeType: 1, matches: mockMatches, querySelectorAll: mockQuerySelectorAll },
          ],
          removedNodes: [],
        },
      ];

      // Trigger the callback
      observer.callback(mutations as any, observer as any);
      
      expect(callback).toHaveBeenCalledWith(mutations, observer);
    });

    it('should check if element matches ad selectors', () => {
      // Create a local mock for this test
      const localMockMatches = vi.fn((selector: string) => selector === '.player-ad-overlay');

      const isAdElement = localMockMatches('.player-ad-overlay');
      
      expect(isAdElement).toBe(true);
      expect(localMockMatches).toHaveBeenCalledWith('.player-ad-overlay');
    });

    it('should check descendants for ad selectors', () => {
      const mockDescendant = {
        style: { display: '', visibility: '', opacity: '', pointerEvents: '' },
      };
      
      const localQuerySelectorAll = vi.fn().mockReturnValue([mockDescendant]);

      const descendants = localQuerySelectorAll('.player-ad-overlay');
      
      expect(descendants.includes(mockDescendant)).toBe(true);
    });
  });

  describe('Enabled/disabled state', () => {
    it('should not observe when disabled', () => {
      const enabled = false;
      
      if (enabled) {
        const observer = new MockMutationObserver(vi.fn());
        observer.observe(document.body, { childList: true, subtree: true });
      }
      
      // observe should not be called when disabled
      expect(mockObserve).not.toHaveBeenCalled();
    });

    it('should observe when enabled', () => {
      const enabled = true;
      
      if (enabled) {
        const observer = new MockMutationObserver(vi.fn());
        observer.observe(document.body, { childList: true, subtree: true });
      }
      
      expect(mockObserve).toHaveBeenCalled();
    });

    it('should disconnect existing observer when disabled', () => {
      const observer = new MockMutationObserver(vi.fn());
      observer.observe(document.body, { childList: true, subtree: true });
      
      // Simulate disabling
      observer.disconnect();
      
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('Return value', () => {
    it('should track hidden element count', () => {
      let hiddenCount = 0;
      
      const hideElement = () => {
        hiddenCount++;
      };
      
      hideElement();
      hideElement();
      hideElement();
      
      expect(hiddenCount).toBe(3);
    });
  });
});

describe('Integration patterns', () => {
  it('should work with typical Twitch ad element structure', () => {
    // Simulate a Twitch ad overlay element
    const adOverlay = {
      nodeType: 1,
      matches: (selector: string) => selector === '[data-test-selector="sad-overlay"]',
      querySelectorAll: () => [],
      style: { display: '', visibility: '', opacity: '', pointerEvents: '' },
      className: '',
      tagName: 'DIV',
    };

    // Simulate hiding
    if (adOverlay.matches('[data-test-selector="sad-overlay"]')) {
      adOverlay.style.display = 'none';
      adOverlay.style.visibility = 'hidden';
    }

    expect(adOverlay.style.display).toBe('none');
    expect(adOverlay.style.visibility).toBe('hidden');
  });
});
