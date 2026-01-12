# Learnings

## UI Patterns
- **Player Controls**: Added ad-block status indicator to `TwitchLivePlayerControls`. Used `ShieldCheck` icon from `lucide-react`.
  - **Active State**: White/70% opacity when active but not blocking.
  - **Blocking State**: Green + Pulse animation when actively blocking ads (`isShowingAd`).
  - **Tooltip**: Provides context ("Ad-Block Active" vs "Blocking Ads...").
  - **Placement**: Left control group, after "Live" badge.

## TypeScript
- Updated `TwitchLivePlayerControlsProps` to include optional `adBlockStatus`.
- Passed `adBlockStatus` from `TwitchLivePlayer` to controls.
