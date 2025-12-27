/**
 * Phase 4 Enhanced Features Tests
 *
 * Tests for:
 * - HEVC codec detection and swapping
 * - Ad segment stripping
 * - Visibility spoofing helpers (basic unit tests, no DOM)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    detectHevcCodec,
    filterHevcVariants,
    findAvcAlternative,
    analyzePlaylistCodecs,
    swapHevcToAvc,
} from '../src/backend/adblock/hevc-handler';
import {
    stripAdSegments,
    AdSegmentCache,
    PLACEHOLDER_VIDEO_URL,
    shouldUsePlaceholder,
} from '../src/backend/adblock/ad-segment-stripper';
import type { ResolutionInfo } from '../src/shared/adblock-types';

describe('HEVC Handler', () => {
    describe('detectHevcCodec', () => {
        it('should detect HEVC codec from hvc1', () => {
            const result = detectHevcCodec('hvc1.1.6.L93.B0');
            expect(result.isHevc).toBe(true);
            expect(result.codecType).toBe('hevc');
        });

        it('should detect HEVC codec from hev1', () => {
            const result = detectHevcCodec('hev1.1.6.L93.B0');
            expect(result.isHevc).toBe(true);
            expect(result.codecType).toBe('hevc');
        });

        it('should detect AVC codec', () => {
            const result = detectHevcCodec('avc1.4D401F');
            expect(result.isHevc).toBe(false);
            expect(result.codecType).toBe('avc');
        });

        it('should detect VP9 codec', () => {
            const result = detectHevcCodec('vp09.00.10.08');
            expect(result.isHevc).toBe(false);
            expect(result.codecType).toBe('vp9');
        });

        it('should detect AV1 codec', () => {
            const result = detectHevcCodec('av01.0.08M.08');
            expect(result.isHevc).toBe(false);
            expect(result.codecType).toBe('av1');
        });

        it('should return unknown for undefined codecs', () => {
            const result = detectHevcCodec(undefined);
            expect(result.isHevc).toBe(false);
            expect(result.codecType).toBe('unknown');
        });

        it('should return unknown for unrecognized codecs', () => {
            const result = detectHevcCodec('some-unknown-codec');
            expect(result.isHevc).toBe(false);
            expect(result.codecType).toBe('unknown');
        });
    });

    describe('filterHevcVariants', () => {
        const variants: ResolutionInfo[] = [
            { resolution: '1920x1080', width: 1920, height: 1080, frameRate: 60, codecs: 'avc1.4D401F', url: 'avc_1080p.m3u8' },
            { resolution: '1920x1080', width: 1920, height: 1080, frameRate: 60, codecs: 'hvc1.1.6.L93.B0', url: 'hevc_1080p.m3u8' },
            { resolution: '1280x720', width: 1280, height: 720, frameRate: 30, codecs: 'avc1.4D401F', url: 'avc_720p.m3u8' },
        ];

        it('should return all variants when preferAvc is false', () => {
            const result = filterHevcVariants(variants, false);
            expect(result).toHaveLength(3);
        });

        it('should filter out HEVC when preferAvc is true', () => {
            const result = filterHevcVariants(variants, true);
            expect(result).toHaveLength(2);
            expect(result.every(v => !detectHevcCodec(v.codecs).isHevc)).toBe(true);
        });

        it('should return HEVC variants if no AVC available', () => {
            const hevcOnly: ResolutionInfo[] = [
                { resolution: '1920x1080', width: 1920, height: 1080, frameRate: 60, codecs: 'hvc1.1.6.L93.B0', url: 'hevc_1080p.m3u8' },
            ];
            const result = filterHevcVariants(hevcOnly, true);
            expect(result).toHaveLength(1);
        });
    });

    describe('findAvcAlternative', () => {
        const variants: ResolutionInfo[] = [
            { resolution: '1920x1080', width: 1920, height: 1080, frameRate: 60, codecs: 'avc1.4D401F', url: 'avc_1080p.m3u8' },
            { resolution: '1920x1080', width: 1920, height: 1080, frameRate: 60, codecs: 'hvc1.1.6.L93.B0', url: 'hevc_1080p.m3u8' },
            { resolution: '1280x720', width: 1280, height: 720, frameRate: 30, codecs: 'avc1.4D401F', url: 'avc_720p.m3u8' },
        ];

        it('should find matching AVC variant for HEVC', () => {
            const hevcVariant = variants[1];
            const result = findAvcAlternative(hevcVariant, variants);
            expect(result).not.toBeNull();
            expect(result?.url).toBe('avc_1080p.m3u8');
        });

        it('should find closest resolution if no exact match', () => {
            const hevcVariant: ResolutionInfo = {
                resolution: '3840x2160',
                width: 3840,
                height: 2160,
                frameRate: 60,
                codecs: 'hvc1.1.6.L150.B0',
                url: 'hevc_4k.m3u8'
            };
            const result = findAvcAlternative(hevcVariant, variants);
            expect(result).not.toBeNull();
            // Should pick 1080p as closest
            expect(result?.url).toBe('avc_1080p.m3u8');
        });

        it('should return null if no AVC variants exist', () => {
            const hevcOnly: ResolutionInfo[] = [
                { resolution: '1920x1080', width: 1920, height: 1080, frameRate: 60, codecs: 'hvc1.1.6.L93.B0', url: 'hevc_1080p.m3u8' },
            ];
            const result = findAvcAlternative(hevcOnly[0], hevcOnly);
            expect(result).toBeNull();
        });
    });

    describe('analyzePlaylistCodecs', () => {
        it('should correctly count HEVC and AVC variants', () => {
            const variants: ResolutionInfo[] = [
                { resolution: '1920x1080', width: 1920, height: 1080, frameRate: 60, codecs: 'avc1.4D401F', url: 'avc_1080p.m3u8' },
                { resolution: '1920x1080', width: 1920, height: 1080, frameRate: 60, codecs: 'hvc1.1.6.L93.B0', url: 'hevc_1080p.m3u8' },
                { resolution: '1280x720', width: 1280, height: 720, frameRate: 30, codecs: 'avc1.4D401F', url: 'avc_720p.m3u8' },
            ];
            const result = analyzePlaylistCodecs(variants);
            expect(result.hasHevc).toBe(true);
            expect(result.hasAvc).toBe(true);
            expect(result.hevcCount).toBe(1);
            expect(result.avcCount).toBe(2);
        });

        it('should handle playlist with only AVC', () => {
            const variants: ResolutionInfo[] = [
                { resolution: '1920x1080', width: 1920, height: 1080, frameRate: 60, codecs: 'avc1.4D401F', url: 'avc_1080p.m3u8' },
            ];
            const result = analyzePlaylistCodecs(variants);
            expect(result.hasHevc).toBe(false);
            expect(result.hasAvc).toBe(true);
        });
    });
});

describe('Ad Segment Stripper', () => {
    describe('AdSegmentCache', () => {
        let cache: AdSegmentCache;

        beforeEach(() => {
            cache = new AdSegmentCache(5);
        });

        it('should add and check segments', () => {
            cache.add('segment1.ts');
            expect(cache.has('segment1.ts')).toBe(true);
            expect(cache.has('segment2.ts')).toBe(false);
        });

        it('should track size', () => {
            cache.add('segment1.ts');
            cache.add('segment2.ts');
            expect(cache.size).toBe(2);
        });

        it('should clear all entries', () => {
            cache.add('segment1.ts');
            cache.add('segment2.ts');
            cache.clear();
            expect(cache.size).toBe(0);
        });

        it('should cleanup old entries when max size reached', () => {
            for (let i = 0; i < 6; i++) {
                cache.add(`segment${i}.ts`);
            }
            // Should have cleaned up some old entries
            expect(cache.size).toBeLessThanOrEqual(5);
        });
    });

    describe('stripAdSegments', () => {
        const livePlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:12345
#EXTINF:2.000,live
https://video-weaver.cdnwatch.com/segment12345.ts
#EXTINF:2.000,live
https://video-weaver.cdnwatch.com/segment12346.ts
`;

        const adPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:12345
#EXTINF:2.000,Amazon
https://ads.cdnwatch.com/ad-segment1.ts
#EXTINF:2.000,Amazon
https://ads.cdnwatch.com/ad-segment2.ts
#EXTINF:2.000,live
https://video-weaver.cdnwatch.com/segment12345.ts
`;

        const mixedPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:12345
#EXTINF:2.000,live
https://video-weaver.cdnwatch.com/segment12345.ts
#EXTINF:2.000,DCM
https://ads.cdnwatch.com/ad-segment1.ts
#EXTINF:2.000,live
https://video-weaver.cdnwatch.com/segment12346.ts
`;

        it('should not modify playlist without ads', () => {
            const result = stripAdSegments(livePlaylist);
            expect(result.modified).toBe(false);
            expect(result.strippedCount).toBe(0);
            expect(result.liveCount).toBe(2);
        });

        it('should strip ad segments and replace with placeholder', () => {
            const result = stripAdSegments(adPlaylist, undefined, true);
            expect(result.modified).toBe(true);
            expect(result.strippedCount).toBe(2);
            expect(result.liveCount).toBe(1);
            expect(result.content).toContain(PLACEHOLDER_VIDEO_URL);
            expect(result.strippedUrls).toContain('https://ads.cdnwatch.com/ad-segment1.ts');
        });

        it('should handle mixed content', () => {
            const result = stripAdSegments(mixedPlaylist);
            expect(result.strippedCount).toBe(1);
            expect(result.liveCount).toBe(2);
        });

        it('should add stripped URLs to cache if provided', () => {
            const cache = new AdSegmentCache();
            stripAdSegments(adPlaylist, cache);
            expect(cache.has('https://ads.cdnwatch.com/ad-segment1.ts')).toBe(true);
            expect(cache.has('https://ads.cdnwatch.com/ad-segment2.ts')).toBe(true);
        });
    });

    describe('shouldUsePlaceholder', () => {
        let cache: AdSegmentCache;

        beforeEach(() => {
            cache = new AdSegmentCache();
        });

        it('should return true for cached ad segments', () => {
            cache.add('https://ads.cdnwatch.com/ad-segment1.ts');
            const result = shouldUsePlaceholder('https://ads.cdnwatch.com/ad-segment1.ts', cache);
            expect(result.usePlaceholder).toBe(true);
            expect(result.reason).toBe('cached_ad_segment');
        });

        it('should return true for known ad URL patterns', () => {
            const result = shouldUsePlaceholder('https://amazon-adsystem.com/segment.ts', cache);
            expect(result.usePlaceholder).toBe(true);
            expect(result.reason).toContain('url_pattern');
        });

        it('should return false for live segments', () => {
            const result = shouldUsePlaceholder('https://video-weaver.cdnwatch.com/live-segment.ts', cache);
            expect(result.usePlaceholder).toBe(false);
            expect(result.reason).toBe('live_segment');
        });
    });
});

describe('Integration Tests', () => {
    describe('HEVC to AVC swapping in master playlist', () => {
        const masterPlaylist = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,CODECS="hvc1.1.6.L93.B0",FRAME-RATE=60
hevc_1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080,CODECS="avc1.4D401F",FRAME-RATE=60
avc_1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,CODECS="avc1.4D401F",FRAME-RATE=30
avc_720p.m3u8
`;

        it('should swap HEVC URLs to AVC alternatives when forceAvc is true', () => {
            const variants: ResolutionInfo[] = [
                { resolution: '1920x1080', width: 1920, height: 1080, frameRate: 60, codecs: 'hvc1.1.6.L93.B0', url: 'hevc_1080p.m3u8' },
                { resolution: '1920x1080', width: 1920, height: 1080, frameRate: 60, codecs: 'avc1.4D401F', url: 'avc_1080p.m3u8' },
                { resolution: '1280x720', width: 1280, height: 720, frameRate: 30, codecs: 'avc1.4D401F', url: 'avc_720p.m3u8' },
            ];

            const result = swapHevcToAvc(masterPlaylist, variants, true);
            expect(result.swapped).toBe(true);
            expect(result.swapCount).toBe(1);
            // The HEVC URL should be replaced with AVC URL
            expect(result.content).not.toContain('hevc_1080p.m3u8');
            // Both instances of avc_1080p.m3u8 should exist (original + replacement)
            expect((result.content.match(/avc_1080p\.m3u8/g) || []).length).toBe(2);
        });

        it('should not modify playlist when forceAvc is false', () => {
            const variants: ResolutionInfo[] = [
                { resolution: '1920x1080', width: 1920, height: 1080, frameRate: 60, codecs: 'hvc1.1.6.L93.B0', url: 'hevc_1080p.m3u8' },
                { resolution: '1920x1080', width: 1920, height: 1080, frameRate: 60, codecs: 'avc1.4D401F', url: 'avc_1080p.m3u8' },
            ];

            const result = swapHevcToAvc(masterPlaylist, variants, false);
            expect(result.swapped).toBe(false);
            expect(result.content).toBe(masterPlaylist);
        });
    });
});
