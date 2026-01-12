# Decisions - Twitch Ad-Block Enhancement

## 2026-01-11: Architecture Decisions

### Decision 1: Dual-Layer Architecture
**Choice**: Main process proxy + renderer fallback
**Rationale**: 
- Main process can intercept before network reaches renderer
- Renderer layer provides backup if proxy fails
- Matches user's requirement for "network-transparent" blocking

### Decision 2: 160p Segment Replacement vs Blank Video
**Choice**: Use 160p content segments when available, blank video as fallback
**Rationale**:
- 160p provides visual continuity (brief quality dip vs black screen)
- Blank video is reliable fallback when 160p unavailable
- User specifically requested 160p replacement strategy

### Decision 3: Enhance Existing Service vs Rewrite
**Choice**: Enhance existing `twitch-adblock-service.ts`
**Rationale**:
- Existing service is 85-90% complete
- Adding DATERANGE detection is additive
- Minimizes risk of breaking working code

### Decision 4: Base64 Data URL Response
**Choice**: Return modified manifests as `data:application/vnd.apple.mpegurl;base64,...`
**Rationale**:
- Works with HLS.js without additional processing
- Avoids need for temporary file storage
- Matches VAFT pattern
