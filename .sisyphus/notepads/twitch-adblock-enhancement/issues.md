# Issues - Twitch Ad-Block Enhancement

## 2026-01-11: Known Issues & Gotchas

### Technical Gotchas

1. **Client-Integrity Header**: May need periodic updates from VAFT project
   - Monitor: [TwitchAdSolutions issues](https://github.com/pixeltris/TwitchAdSolutions/issues)
   - Current service has partial implementation

2. **V2 API Detection**: Different SERVER-TIME format
   - V1: `SERVER-TIME="12345.67"`
   - V2: `#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE="..."`

3. **HEVC-Only Streams**: Some streams may not have 160p fallback
   - Need graceful handling when no AVC alternative exists

4. **Prefetch Disabling**: Must strip `#EXT-X-TWITCH-PREFETCH:` during ads
   - Otherwise player may prefetch and display ad segments

### Missing from Current Implementation

- `Client-Version` GQL header
- `Client-Session-Id` GQL header  
- `#EXT-X-DATERANGE` as primary detection (only uses `stitched`)
- `-CACHED` player type suffix support
- `AllSegmentsAreAdSegments` edge case flag

### Potential Breaking Points

- Twitch changes DATERANGE tag format (~monthly)
- GQL persisted query hash changes
- Backup player types start returning ads
