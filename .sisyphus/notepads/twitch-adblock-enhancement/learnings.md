# Learnings - Twitch Ad-Block Enhancement

## 2026-01-11: Initial Analysis

### Discovered Patterns

1. **VAFT Signifier**: The primary ad detection uses `stitched` string in M3U8 playlists
2. **DATERANGE Tags**: `#EXT-X-DATERANGE` with `com.twitch.tv/ad` is 99% reliable for ad detection
3. **Backup Player Types**: Order is `embed` → `popout` → `autoplay` → `picture-by-picture` → `thunderdome`
4. **parent_domains Stripping**: CRITICAL - must delete from token JSON to bypass embed detection
5. **GQL Hash**: Access token uses `ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9`

### Successful Approaches

1. **HLS.js Custom Loaders**: Using `pLoader` and `fLoader` for manifest/segment interception works well
2. **Blank Video Data URL**: Minimal MP4 base64 prevents player errors when replacing ad segments
3. **HEVC/AVC Swap**: Creating modified M3U8 with AVC equivalents prevents codec errors

### Existing Infrastructure (Well-Implemented)

- `twitch-adblock-service.ts` (829 lines) - Core VAFT logic
- `twitch-adblock-loader.ts` (207 lines) - HLS.js integration
- `network-adblock-service.ts` (73 lines) - Domain blocking
- `adblock-types.ts` (188 lines) - Type definitions

### Project Conventions

- Service files in `src/backend/services/`
- Player components in `src/components/player/twitch/`
- Shared types in `src/shared/`
- Main process entry in `src/main.ts`
