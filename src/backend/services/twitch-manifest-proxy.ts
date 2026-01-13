/**
 * Twitch Manifest Proxy Service
 * 
 * Intercepts HLS manifest requests at the Electron session level
 * and processes them through VAFT-style ad removal before they
 * reach the renderer. This provides network-transparent ad blocking.
 * 
 * @see https://github.com/pixeltris/TwitchAdSolutions
 */

import { session } from 'electron';

import { DEFAULT_DATERANGE_PATTERNS } from '@shared/adblock-types';

import { vaftPatternService } from './vaft-pattern-service';

/**
 * Resolution info for a stream quality level
 */
interface ResolutionInfo {
    resolution: string;
    bandwidth: number;
    codecs: string;
    frameRate: number;
}

/**
 * Stream state tracking for the proxy
 */
interface ProxyStreamInfo {
    channelName: string;
    encodingsM3u8: string | null;
    last160pSegment: string | null;
    baseline160pUrl: string | null;
    isInAdBreak: boolean;
    usherParams: string;
    resolutions: Map<string, ResolutionInfo>;
    lastKnownBitrate: number | null;
}

/**
 * Proxy statistics
 */
interface ProxyStats {
    manifestsProcessed: number;
    adsDetected: number;
    backupsFetched: number;
    segmentsReplaced: number;
}

/**
 * Player types to try for ad-free backup streams
 */
const BACKUP_PLAYER_TYPES = ['embed', 'popout', 'autoplay', 'picture-by-picture', 'thunderdome'] as const;
type PlayerType = typeof BACKUP_PLAYER_TYPES[number];

/**
 * Twitch GQL Client ID
 */
const GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

/**
 * GQL Persisted Query Hash for PlaybackAccessToken
 */
const ACCESS_TOKEN_HASH = 'ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9';

class TwitchManifestProxyService {
    private streamInfos = new Map<string, ProxyStreamInfo>();
    private isEnabled = true;
    private isRegistered = false;
    private stats: ProxyStats = {
        manifestsProcessed: 0,
        adsDetected: 0,
        backupsFetched: 0,
        segmentsReplaced: 0,
    };

    /**
     * Clear stream info and cleanup resources for a channel
     * Called when stream processing completes or on error
     */
    clearStreamInfo(channelName: string): void {
        this.streamInfos.delete(channelName.toLowerCase());
    }

    /**
     * Clear all stream infos (called on cleanup)
     */
    clearAllStreamInfos(): void {
        this.streamInfos.clear();
    }

    /**
     * Register the manifest interceptor with Electron's session
     */
    registerInterceptor(): void {
        if (this.isRegistered) {
            console.debug('[ManifestProxy] Already registered');
            return;
        }

        session.defaultSession.webRequest.onBeforeRequest(
            {
                urls: [
                    // Match all ttvnw.net subdomains with m3u8 files
                    // Electron doesn't support wildcards in the middle of hostnames
                    // so we use broader patterns and filter in the handler
                    '*://*.ttvnw.net/*.m3u8*',
                ],
            },
            (details, callback) => {
                if (!this.isEnabled) {
                    callback({});
                    return;
                }

                // Filter to only process relevant Twitch HLS manifest URLs
                const url = details.url;
                const isRelevantUrl =
                    url.includes('usher.ttvnw.net') ||
                    url.includes('video-weaver') ||
                    url.includes('.hls.ttvnw.net');

                if (!isRelevantUrl) {
                    callback({});
                    return;
                }

                // Use Promise chain instead of async/await to satisfy Electron's callback contract
                fetch(details.url)
                    .then((response) => {
                        if (!response.ok) {
                            callback({});
                            return null;
                        }
                        return response.text();
                    })
                    .then((originalText) => {
                        if (originalText === null) {
                            return; // Already called callback above
                        }
                        return this.processManifest(details.url, originalText).then((processedText) => {
                            // Return as Base64 data URL
                            const base64 = Buffer.from(processedText).toString('base64');
                            callback({
                                redirectURL: `data:application/vnd.apple.mpegurl;base64,${base64}`,
                            });
                            this.stats.manifestsProcessed++;
                        });
                    })
                    .catch((error) => {
                        console.error('[ManifestProxy] Error:', error);
                        callback({});
                    });
            }
        );

        this.isRegistered = true;
        console.debug('[ManifestProxy] Registered manifest interceptor');
    }

    /**
     * Process a manifest (master or media playlist)
     */
    private async processManifest(url: string, text: string): Promise<string> {
        if (this.isMasterPlaylist(url)) {
            return this.processMasterPlaylist(url, text);
        } else {
            return this.processMediaPlaylist(url, text);
        }
    }

    /**
     * Check if URL is a master playlist (usher.ttvnw.net)
     */
    private isMasterPlaylist(url: string): boolean {
        return url.includes('usher.ttvnw.net');
    }

    /**
     * Process master playlist - extract resolution info and identify 160p stream
     */
    private processMasterPlaylist(url: string, text: string): string {
        const channelName = this.extractChannelName(url);
        if (!channelName) return text;

        const urlObj = new URL(url);
        const streamInfo: ProxyStreamInfo = {
            channelName,
            encodingsM3u8: text,
            last160pSegment: null,
            baseline160pUrl: null,
            isInAdBreak: false,
            usherParams: urlObj.search,
            resolutions: new Map(),
            lastKnownBitrate: null,
        };

        // Parse resolutions and find 160p stream
        const lines = text.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
            if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                const attrs = this.parseAttributes(lines[i]);
                const resolution = attrs['RESOLUTION'];
                const bandwidth = parseInt(attrs['BANDWIDTH'], 10);

                if (resolution) {
                    const streamUrl = lines[i + 1].trim();
                    streamInfo.resolutions.set(streamUrl, {
                        resolution,
                        bandwidth,
                        codecs: attrs['CODECS'] || '',
                        frameRate: parseFloat(attrs['FRAME-RATE']) || 30,
                    });

                    // Identify 160p stream (BANDWIDTH ~160000-400000)
                    if (bandwidth >= 160000 && bandwidth <= 400000) {
                        streamInfo.baseline160pUrl = streamUrl;
                    }
                }
            }
        }

        this.streamInfos.set(channelName, streamInfo);
        console.debug(`[ManifestProxy] Registered stream: ${channelName} (${streamInfo.resolutions.size} qualities)`);
        
        return text;
    }

    /**
     * Process media playlist - detect ads and apply replacement
     */
    private async processMediaPlaylist(url: string, text: string): Promise<string> {
        const streamInfo = this.findStreamInfoByUrl(url);
        if (!streamInfo) return text;

        // Neutralize tracking URLs first
        text = this.neutralizeTrackingUrls(text);

        // Detect ads using multiple heuristics
        const hasAd = this.detectAds(text);

        if (hasAd) {
            this.stats.adsDetected++;
            
            if (!streamInfo.isInAdBreak) {
                streamInfo.isInAdBreak = true;
                console.debug(`[ManifestProxy] Ad detected on ${streamInfo.channelName}`);
            }

            // Try backup stream first
            const backupText = await this.tryGetBackupStream(streamInfo, url);
            if (backupText && !this.detectAds(backupText)) {
                this.stats.backupsFetched++;
                return backupText;
            }

            // Fallback: Strip ad segments and replace with 160p
            return this.replaceAdSegments(text, streamInfo);
        } else if (streamInfo.isInAdBreak) {
            streamInfo.isInAdBreak = false;
            console.debug(`[ManifestProxy] Ad ended on ${streamInfo.channelName}`);
        }

        // Store last valid 160p segment for replacement
        this.updateBaseline160pSegment(text, streamInfo);

        return text;
    }

    /**
     * Detect ads using multiple heuristics
     * Uses dynamic patterns from VAFT pattern service when available
     */
    private detectAds(text: string): boolean {
        // Get patterns from VAFT pattern service (auto-updated)
        let dateRangePatterns: readonly string[];
        let adSignifiers: string[];
        
        try {
            dateRangePatterns = vaftPatternService.getDateRangePatterns();
            adSignifiers = vaftPatternService.getAdSignifiers();
        } catch {
            // Fallback to defaults if service not initialized
            dateRangePatterns = DEFAULT_DATERANGE_PATTERNS;
            adSignifiers = ['stitched'];
        }

        // Primary: DATERANGE tags with ad indicators
        if (text.includes('#EXT-X-DATERANGE')) {
            for (const pattern of dateRangePatterns) {
                if (text.includes(pattern)) {
                    return true;
                }
            }
        }

        // Secondary: ad signifiers (e.g., 'stitched')
        for (const signifier of adSignifiers) {
            if (text.includes(signifier)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Neutralize ad tracking URLs
     */
    private neutralizeTrackingUrls(text: string): string {
        const safeUrl = 'https://twitch.tv';
        return text
            .replace(/(X-TV-TWITCH-AD-URL=")[^"]*(")/g, `$1${safeUrl}$2`)
            .replace(/(X-TV-TWITCH-AD-CLICK-TRACKING-URL=")[^"]*(")/g, `$1${safeUrl}$2`)
            .replace(/(X-TV-TWITCH-AD-ROLL-TYPE=")[^"]*(")/g, `$1$2`);
    }

    /**
     * Replace ad segments with 160p content
     */
    private replaceAdSegments(text: string, streamInfo: ProxyStreamInfo): string {
        if (!streamInfo.last160pSegment) {
            // No 160p cached - just strip ad segments
            return this.stripAdSegmentsMinimal(text);
        }

        const lines = text.split('\n');
        const result: string[] = [];
        let segmentsReplaced = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Detect ad segment
            if (line.startsWith('#EXTINF') && i + 1 < lines.length) {
                const segmentUrl = lines[i + 1];
                const isAdSegment = !line.includes(',live') || this.isKnownAdSegment(segmentUrl);

                if (isAdSegment) {
                    // Keep EXTINF but replace segment URL with 160p
                    result.push(line);
                    result.push(streamInfo.last160pSegment);
                    segmentsReplaced++;
                    i++; // Skip original segment URL
                    continue;
                }
            }

            // Remove prefetch during ads
            if (streamInfo.isInAdBreak && line.startsWith('#EXT-X-TWITCH-PREFETCH:')) {
                continue;
            }

            result.push(line);
        }

        this.stats.segmentsReplaced += segmentsReplaced;
        return result.join('\n');
    }

    /**
     * Strip ad segments minimally (when no 160p available)
     */
    private stripAdSegmentsMinimal(text: string): string {
        const lines = text.split('\n');
        const result: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Skip DATERANGE ad markers
            if (line.startsWith('#EXT-X-DATERANGE') && 
                (line.includes('stitched-ad') || line.includes('amazon-ad'))) {
                continue;
            }

            // Skip prefetch during ads
            if (line.startsWith('#EXT-X-TWITCH-PREFETCH:')) {
                continue;
            }

            result.push(line);
        }

        return result.join('\n');
    }

    /**
     * Update baseline 160p segment from clean playlist
     */
    private updateBaseline160pSegment(text: string, streamInfo: ProxyStreamInfo): void {
        // Only update from clean (non-ad) playlists
        if (this.detectAds(text)) return;

        const lines = text.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].startsWith('#EXTINF') && lines[i].includes(',live')) {
                const segmentUrl = lines[i + 1]?.trim();
                if (segmentUrl && segmentUrl.startsWith('https://')) {
                    streamInfo.last160pSegment = segmentUrl;
                    break;
                }
            }
        }
    }

    /**
     * Try to get backup stream without ads
     */
    private async tryGetBackupStream(
        streamInfo: ProxyStreamInfo,
        originalUrl: string
    ): Promise<string | null> {
        for (const playerType of BACKUP_PLAYER_TYPES) {
            try {
                const token = await this.getAccessToken(streamInfo.channelName, playerType);
                if (!token) continue;

                const usherUrl = this.buildUsherUrl(streamInfo, token);
                const encodingsResponse = await fetch(usherUrl);
                if (!encodingsResponse.ok) continue;

                const encodingsM3u8 = await encodingsResponse.text();
                const streamUrl = this.getMatchingStreamUrl(encodingsM3u8, originalUrl, streamInfo);
                if (!streamUrl) continue;

                const mediaResponse = await fetch(streamUrl);
                if (!mediaResponse.ok) continue;

                const mediaText = await mediaResponse.text();

                // Check if backup is clean
                if (!this.detectAds(mediaText)) {
                    console.debug(`[ManifestProxy] Using backup (${playerType})`);
                    return mediaText;
                }
            } catch (error) {
                // Continue to next player type
                console.debug(`[ManifestProxy] Backup failed for ${playerType}:`, error);
            }
        }

        return null;
    }

    /**
     * Get access token with parent_domains stripped
     * 
     * IMPORTANT DOCUMENTATION:
     * -------------------------
     * This method strips `parent_domains` and `parent_referrer_domains` from Twitch
     * playback tokens to bypass embed detection. This is necessary because:
     * 
     * 1. Business Need: Twitch uses parent_domains to detect if the player is embedded
     *    on a third-party site and serves additional ads to embedded players. Stripping
     *    these fields makes the request appear to come from twitch.tv directly.
     * 
     * 2. Legal/TOS Implications: This may violate Twitch's Terms of Service. Use at
     *    your own risk. This is intended for personal ad-blocking purposes only.
     * 
     * 3. Known Risks:
     *    - Twitch may detect this bypass and block/ban accounts
     *    - Twitch may change their API to require these fields
     *    - This may stop working at any time without notice
     * 
     * TODO: Explore official alternatives:
     * - Twitch OAuth2/Helix APIs for authorized playback
     * - Official Twitch embed flows with ad support
     * - See: https://dev.twitch.tv/docs/embed/
     * 
     * ACCEPTANCE OF RISK: By using this functionality, you acknowledge the risks
     * and accept responsibility for any consequences.
     */
    private async getAccessToken(
        channelName: string,
        playerType: PlayerType
    ): Promise<{ signature: string; value: string } | null> {
        const body = {
            operationName: 'PlaybackAccessToken',
            variables: {
                isLive: true,
                login: channelName,
                isVod: false,
                vodID: '',
                playerType,
                platform: playerType === 'autoplay' ? 'android' : 'web',
            },
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: ACCESS_TOKEN_HASH,
                },
            },
        };

        try {
            const response = await fetch('https://gql.twitch.tv/gql', {
                method: 'POST',
                headers: {
                    'Client-ID': GQL_CLIENT_ID,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                console.debug(`[ManifestProxy] GQL request failed with status ${response.status} for ${playerType}`);
                return null;
            }

            const data = await response.json();
            const token = data.data?.streamPlaybackAccessToken;

            if (!token) return null;

            // Strip parent_domains to bypass embed detection (see method documentation above)
            try {
                const tokenValue = JSON.parse(token.value);
                delete tokenValue.parent_domains;
                delete tokenValue.parent_referrer_domains;
                return {
                    signature: token.signature,
                    value: JSON.stringify(tokenValue),
                };
            } catch {
                return token;
            }
        } catch (error) {
            console.debug(`[ManifestProxy] GQL request exception for ${playerType}:`, error);
            return null;
        }
    }

    /**
     * Build usher URL for backup stream
     */
    private buildUsherUrl(
        streamInfo: ProxyStreamInfo,
        accessToken: { signature: string; value: string }
    ): string {
        const baseUrl = `https://usher.ttvnw.net/api/channel/hls/${streamInfo.channelName}.m3u8`;
        const url = new URL(baseUrl + streamInfo.usherParams);
        url.searchParams.set('sig', accessToken.signature);
        url.searchParams.set('token', accessToken.value);

        // Strip tracking params
        url.searchParams.delete('parent_domains');
        url.searchParams.delete('referrer');

        return url.href;
    }

    /**
     * Get matching stream URL from backup encodings
     */
    private getMatchingStreamUrl(
        encodingsM3u8: string,
        originalUrl: string,
        streamInfo: ProxyStreamInfo
    ): string | null {
        const originalRes = streamInfo.resolutions.get(originalUrl);
        if (!originalRes) return null;

        const lines = encodingsM3u8.split('\n');
        let bestMatch: { url: string; score: number } | null = null;

        for (let i = 0; i < lines.length - 1; i++) {
            if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                const attrs = this.parseAttributes(lines[i]);
                const resolution = attrs['RESOLUTION'];
                const bandwidth = parseInt(attrs['BANDWIDTH'], 10);
                const streamUrl = lines[i + 1].trim();

                // Calculate match score
                const resMatch = resolution === originalRes.resolution ? 1000 : 0;
                const bwDiff = Math.abs(bandwidth - originalRes.bandwidth);
                const score = resMatch - bwDiff / 1000;

                if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { url: streamUrl, score };
                }
            }
        }

        return bestMatch?.url || null;
    }

    /**
     * Check if segment URL is a known ad segment
     */
    private isKnownAdSegment(url: string): boolean {
        return url.includes('cloudfront.net') && url.includes('/ad/') ||
               url.includes('amazon-ad') ||
               url.includes('stitched-ad');
    }

    /**
     * Parse #EXT-X-STREAM-INF attributes
     */
    private parseAttributes(line: string): Record<string, string> {
        const attrs: Record<string, string> = {};
        const matches = line.matchAll(/([A-Z-]+)=("[^"]*"|[^,\s]*)/g);
        for (const match of matches) {
            attrs[match[1]] = match[2].replace(/"/g, '');
        }
        return attrs;
    }

    /**
     * Extract channel name from URL
     */
    private extractChannelName(url: string): string | null {
        const match = url.match(/\/hls\/([^./]+)/);
        return match ? match[1].toLowerCase() : null;
    }

    /**
     * Find stream info by media playlist URL
     */
    private findStreamInfoByUrl(url: string): ProxyStreamInfo | null {
        for (const streamInfo of this.streamInfos.values()) {
            for (const streamUrl of streamInfo.resolutions.keys()) {
                if (url.includes(streamUrl) || streamUrl.includes(url)) {
                    return streamInfo;
                }
            }
        }
        return null;
    }

    // ========== Public API ==========

    enable(): void {
        this.isEnabled = true;
        console.debug('[ManifestProxy] Enabled');
    }

    disable(): void {
        this.isEnabled = false;
        console.debug('[ManifestProxy] Disabled');
    }

    isActive(): boolean {
        return this.isEnabled && this.isRegistered;
    }

    getStats(): ProxyStats {
        return { ...this.stats };
    }
}

export const twitchManifestProxy = new TwitchManifestProxyService();
