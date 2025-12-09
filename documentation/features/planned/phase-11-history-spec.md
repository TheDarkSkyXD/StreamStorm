# Phase 11: History & Watch Log

## 1. Overview

**Goal:** Implement a dedicated history page that tracks and displays the user's viewing history for VODs and Clips, allowing users to easily revisit content they have watched. This feature includes a search bar to filter history entries.

**Priority:** Medium
**Dependencies:** Phase 2 (Discovery), Phase 3 (Stream Viewing)

## 2. Feature Specification

### 2.1. Watch History Tracking
- **Functionality**: Automatically record VODs and Clips as they are viewed.
- **Data Capture**:
  - Content Type (VOD / Clip)
  - Platform (Twitch / Kick)
  - Streamer Name & Avatar
  - Content Title
  - Thumbnail URL
  - Link/ID
  - Timestamp (Date & Time watched)
  - Watch Progress (current timestamp)
  - Total Duration
- **Resume Capability**: When clicking a history item, playback MUST resume from the saved timestamp (if supported by the platform/player).

### 2.2. Storage
- **Mechanism**: Store history data locally using the existing hybrid storage solution (`better-sqlite3` or `electron-store`).
- **Retention**: Implement a reasonable limit (e.g., last 1000 items or 30 days) or allow user configuration.

### 2.3. History Page UI
- **Location**: Accessible via the Sidebar (Settings or dedicated "History" link) or User Profile menu.
- **Layout**:
  - **Header**: "Watch History" title.
  - **Controls**:
    - **Search Bar**: Filter history by streamer name or video title.
    - **Clear History Button**: Wipe all history data (with confirmation).
  - **Content Grid/List**: Display history items chronologically (newest first).
    - **Item Card**:
      - Thumbnail.
      - **Progress Bar / Tracker Line**: A red line (or accent color) overlay at the bottom of the thumbnail showing the percentage watched.
      - Title.
      - Streamer Name.
      - "Watched on [Date]" label.
      - Context Menu / Action Button: "Remove from History".

### 2.4. Search Functionality
- **Scope**: Search strictly within the stored watch history.
- **Filters**: Real-time filtering as the user types.

## 3. Technical Implementation

### 3.1. Data Model
```typescript
interface HistoryItem {
  id: string; // Unique ID (video ID)
  platform: 'twitch' | 'kick';
  type: 'vod' | 'clip';
  channelName: string;
  title: string;
  thumbnailUrl: string;
  url: string;
  lastWatchedAt: number; // Timestamp
  progressSeconds: number; // Where the user left off
  totalDurationSeconds: number; // Total length of the VOD
}
```

### 3.2. Integration Points
- **Player Component**: Trigger an "add to history" action when a video starts playing (or after a threshold, e.g., 30 seconds).
- **Navigation**: Add a route `/history`.

## 4. Acceptance Criteria
- [ ] User can view a list of recently watched VODs and Clips.
- [ ] History persists across app restarts.
- [ ] User can search their history by title or streamer.
- [ ] VODs show a progress bar (tracker line) indicating percentage watched.
- [ ] Clicking a partially watched VOD resumes playback from the last position.
- [ ] User can delete individual items or clear the entire history.
- [ ] UI matches the application's design aesthetic.
