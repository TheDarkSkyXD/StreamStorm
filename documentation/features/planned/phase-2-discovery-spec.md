# Phase 2: Stream Discovery & Browsing

**Document Name:** Stream Discovery Implementation Plan  
**Date:** December 7, 2025  
**Version:** 1.0  
**Status:** Planning  
**Priority:** High  
**Prerequisites:** Phase 1 Complete

---

## Executive Summary

This phase implements the stream discovery and browsing functionality for StreamStorm, allowing users to find and explore content from both Twitch and Kick. It includes the home feed, category browsing, search functionality, and the following system—creating a unified content discovery experience across both platforms.

---

## Architecture Overview

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │   Home   │  │Categories│  │  Search  │  │   Following   │   │
│  │   Feed   │  │  Browser │  │   Page   │  │     Page      │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬───────┘   │
│       │             │             │                │            │
│       └─────────────┴─────────────┴────────────────┘            │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │ TanStack Query    │                        │
│                    │ Data Layer        │                        │
│                    └─────────┬─────────┘                        │
└──────────────────────────────┼───────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
    ┌──────▼──────┐    ┌───────▼───────┐   ┌──────▼──────┐
    │ Twitch API  │    │   Kick API    │   │ Local Store │
    │   Client    │    │    Client     │   │  (Follows)  │
    └─────────────┘    └───────────────┘   └─────────────┘
```

### Component Structure

```
renderer/
├── pages/
│   ├── Home/
│   │   ├── HomePage.tsx
│   │   ├── FeaturedStreams.tsx
│   │   ├── LiveNowSection.tsx
│   │   └── RecommendedSection.tsx
│   ├── Categories/
│   │   ├── CategoriesPage.tsx
│   │   ├── CategoryGrid.tsx
│   │   └── CategoryDetail.tsx
│   ├── Search/
│   │   ├── SearchPage.tsx
│   │   ├── SearchResults.tsx
│   │   └── SearchFilters.tsx
│   └── Following/
│       ├── FollowingPage.tsx
│       ├── LiveChannels.tsx
│       └── OfflineChannels.tsx
├── components/
│   └── stream/
│       ├── StreamCard.tsx
│       ├── StreamGrid.tsx
│       ├── ChannelCard.tsx
│       └── CategoryCard.tsx
```

---

## Functional Requirements Covered

| Requirement | Description |
|-------------|-------------|
| FR-2.1 | Home Feed |
| FR-2.2 | Category/Game Browsing |
| FR-2.3 | Search Functionality |
| FR-2.4 | Following System |

---

## Implementation Phases

### Phase 2.1: API Data Layer (3 days)

#### Tasks

- [ ] **2.1.1** Create unified stream interfaces
  ```typescript
  // src/shared/types/stream.ts
  export interface UnifiedStream {
    id: string;
    platform: 'twitch' | 'kick';
    channelId: string;
    channelName: string;
    displayName: string;
    title: string;
    game: GameInfo;
    viewerCount: number;
    thumbnailUrl: string;
    profileImageUrl: string;
    startedAt: string;
    language: string;
    tags: string[];
    isMature: boolean;
  }
  
  export interface UnifiedCategory {
    id: string;
    platform: 'twitch' | 'kick';
    name: string;
    boxArtUrl: string;
    viewerCount: number;
    streamCount: number;
  }
  
  export interface UnifiedChannel {
    id: string;
    platform: 'twitch' | 'kick';
    username: string;
    displayName: string;
    description: string;
    profileImageUrl: string;
    bannerUrl: string;
    followerCount: number;
    isLive: boolean;
    currentStream?: UnifiedStream;
  }
  ```

- [ ] **2.1.2** Implement Twitch API endpoints
  ```typescript
  // src/backend/api/twitch/streams.ts
  export class TwitchStreamsApi {
    async getTopStreams(options?: StreamsOptions): Promise<TwitchStream[]>;
    async getStreamsByGame(gameId: string): Promise<TwitchStream[]>;
    async getStreamsByUserIds(userIds: string[]): Promise<TwitchStream[]>;
    async searchChannels(query: string): Promise<TwitchChannel[]>;
    async searchCategories(query: string): Promise<TwitchCategory[]>;
    async getTopGames(): Promise<TwitchGame[]>;
    async getGameById(gameId: string): Promise<TwitchGame>;
  }
  ```

- [ ] **2.1.3** Implement Kick API endpoints
  ```typescript
  // src/backend/api/kick/streams.ts
  export class KickStreamsApi {
    async getLivestreams(options?: StreamsOptions): Promise<KickStream[]>;
    async getCategories(): Promise<KickCategory[]>;
    async getCategoryStreams(categoryId: string): Promise<KickStream[]>;
    async getChannelBySlug(slug: string): Promise<KickChannel>;
    async searchChannels(query: string): Promise<KickChannel[]>;
  }
  ```

- [ ] **2.1.4** Create data transformation layer
  ```typescript
  // src/backend/api/transformers.ts
  export function transformTwitchStream(stream: TwitchStream): UnifiedStream;
  export function transformKickStream(stream: KickStream): UnifiedStream;
  export function transformTwitchCategory(category: TwitchCategory): UnifiedCategory;
  export function transformKickCategory(category: KickCategory): UnifiedCategory;
  ```

- [ ] **2.1.5** Set up IPC handlers for data fetching
  ```typescript
  // IPC Channels
  STREAMS_GET_TOP: 'streams:get-top',
  STREAMS_GET_BY_CATEGORY: 'streams:get-by-category',
  STREAMS_GET_BY_USER: 'streams:get-by-user',
  CATEGORIES_GET_TOP: 'categories:get-top',
  SEARCH_CHANNELS: 'search:channels',
  SEARCH_CATEGORIES: 'search:categories',
  ```

#### Verification

- [ ] API calls return correct data format
- [ ] Data transformation works correctly
- [ ] Error handling for API failures

---

### Phase 2.2: React Query Setup (2 days)

#### Tasks

- [ ] **2.2.1** Create query hooks for streams
  ```typescript
  // src/frontend/hooks/queries/useStreams.ts
  export function useTopStreams(platform?: Platform) {
    return useQuery({
      queryKey: ['streams', 'top', platform],
      queryFn: () => window.electronAPI.getTopStreams({ platform }),
      staleTime: 30_000, // 30 seconds
      refetchInterval: 60_000, // 1 minute
    });
  }
  
  export function useStreamsByCategory(categoryId: string, platform?: Platform) {
    return useQuery({
      queryKey: ['streams', 'category', categoryId, platform],
      queryFn: () => window.electronAPI.getStreamsByCategory({ categoryId, platform }),
      enabled: !!categoryId,
    });
  }
  ```

- [ ] **2.2.2** Create query hooks for categories
  ```typescript
  // src/frontend/hooks/queries/useCategories.ts
  export function useTopCategories(platform?: Platform) {
    return useQuery({
      queryKey: ['categories', 'top', platform],
      queryFn: () => window.electronAPI.getTopCategories({ platform }),
      staleTime: 60_000, // 1 minute
    });
  }
  ```

- [ ] **2.2.3** Create query hooks for search
  ```typescript
  // src/frontend/hooks/queries/useSearch.ts
  export function useSearchChannels(query: string, options?: SearchOptions) {
    return useQuery({
      queryKey: ['search', 'channels', query, options],
      queryFn: () => window.electronAPI.searchChannels({ query, ...options }),
      enabled: query.length >= 2,
    });
  }
  
  export function useSearchCategories(query: string) {
    return useQuery({
      queryKey: ['search', 'categories', query],
      queryFn: () => window.electronAPI.searchCategories({ query }),
      enabled: query.length >= 2,
    });
  }
  ```

- [ ] **2.2.4** Implement infinite scrolling support
  ```typescript
  // src/frontend/hooks/queries/useInfiniteStreams.ts
  export function useInfiniteStreams(categoryId?: string) {
    return useInfiniteQuery({
      queryKey: ['streams', 'infinite', categoryId],
      queryFn: ({ pageParam }) => 
        window.electronAPI.getStreams({ cursor: pageParam, categoryId }),
      getNextPageParam: (lastPage) => lastPage.cursor,
      initialPageParam: null,
    });
  }
  ```

- [ ] **2.2.5** Set up query prefetching
  ```typescript
  // Prefetch on hover for faster navigation
  export function usePrefetchCategory(categoryId: string) {
    const queryClient = useQueryClient();
    
    return () => {
      queryClient.prefetchQuery({
        queryKey: ['streams', 'category', categoryId],
        queryFn: () => window.electronAPI.getStreamsByCategory({ categoryId }),
      });
    };
  }
  ```

#### Verification

- [ ] Data fetching works correctly
- [ ] Caching reduces API calls
- [ ] Infinite scroll loads more content

---

### Phase 2.3: Home Page (2 days)

#### Tasks

- [ ] **2.3.1** Create HomePage component
  ```typescript
  // src/frontend/pages/Home/HomePage.tsx
  export function HomePage() {
    return (
      <div className="flex flex-col gap-8 p-6">
        <FeaturedStream />
        <LiveNowSection />
        <RecommendedSection />
        <TopCategoriesSection />
      </div>
    );
  }
  ```

- [ ] **2.3.2** Create FeaturedStream component
  ```typescript
  // Hero section with a featured stream
  // Large thumbnail with overlay info
  // "Watch Now" CTA button
  ```

- [ ] **2.3.3** Create LiveNowSection component
  ```typescript
  // Horizontal scroll of live streams
  // Mix of Twitch and Kick
  // Platform indicator badges
  ```

- [ ] **2.3.4** Create StreamCard component
  ```typescript
  // src/frontend/components/stream/StreamCard.tsx
  interface StreamCardProps {
    stream: UnifiedStream;
    variant?: 'default' | 'compact' | 'featured';
    onFollow?: () => void;
    onWatch?: () => void;
  }
  
  export function StreamCard({ stream, variant = 'default' }: StreamCardProps) {
    // Thumbnail with hover preview
    // Platform badge
    // Viewer count
    // Stream title (truncated)
    // Streamer name
    // Game/Category
    // Live duration
  }
  ```

- [ ] **2.3.5** Create StreamGrid component
  ```typescript
  // src/frontend/components/stream/StreamGrid.tsx
  // Responsive grid layout
  // Skeleton loading states
  // Empty state handling
  ```

#### Verification

- [ ] Home page loads and displays content
- [ ] Streams from both platforms appear
- [ ] Cards show correct information
- [ ] Click navigates to stream

---

### Phase 2.4: Categories Browser (2 days)

#### Tasks

- [ ] **2.4.1** Create CategoriesPage component
  ```typescript
  // src/frontend/pages/Categories/CategoriesPage.tsx
  export function CategoriesPage() {
    return (
      <div>
        <Header>
          <h1>Browse Categories</h1>
          <PlatformFilter />
          <SortOptions />
        </Header>
        <CategoryGrid categories={categories} />
      </div>
    );
  }
  ```

- [ ] **2.4.2** Create CategoryCard component
  ```typescript
  // src/frontend/components/stream/CategoryCard.tsx
  interface CategoryCardProps {
    category: UnifiedCategory;
    onClick?: () => void;
  }
  
  export function CategoryCard({ category }: CategoryCardProps) {
    // Box art image
    // Category name
    // Viewer count
    // Stream count
    // Platform indicator (if platform-specific)
  }
  ```

- [ ] **2.4.3** Create CategoryDetail page
  ```typescript
  // src/frontend/pages/Categories/CategoryDetail.tsx
  export function CategoryDetail() {
    const { categoryId } = useParams();
    const streams = useStreamsByCategory(categoryId);
    
    return (
      <div>
        <CategoryHeader category={category} />
        <StreamFilters />
        <StreamGrid streams={streams} />
      </div>
    );
  }
  ```

- [ ] **2.4.4** Implement category filtering and sorting
  ```typescript
  interface CategoryFilters {
    platform?: 'twitch' | 'kick' | 'all';
    sortBy: 'viewers' | 'streams' | 'name';
    language?: string;
  }
  ```

- [ ] **2.4.5** Add category cross-mapping
  ```typescript
  // Map equivalent categories between platforms
  // e.g., "Just Chatting" on Twitch = "IRL" on Kick
  export function getCrossplatformCategory(categoryId: string): CrossPlatformCategory;
  ```

#### Verification

- [ ] Categories display from both platforms
- [ ] Clicking category shows streams
- [ ] Filters and sorting work
- [ ] Pagination/infinite scroll works

---

### Phase 2.5: Search Functionality (2 days)

#### Tasks

- [ ] **2.5.1** Create SearchPage component
  ```typescript
  // src/frontend/pages/Search/SearchPage.tsx
  export function SearchPage() {
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, 300);
    
    return (
      <div>
        <SearchInput value={query} onChange={setQuery} />
        <SearchFilters />
        <SearchResults query={debouncedQuery} />
      </div>
    );
  }
  ```

- [ ] **2.5.2** Create SearchInput with suggestions
  ```typescript
  // src/frontend/components/search/SearchInput.tsx
  // Auto-complete suggestions
  // Recent searches
  // Clear button
  // Keyboard navigation
  ```

- [ ] **2.5.3** Create SearchResults component
  ```typescript
  // src/frontend/components/search/SearchResults.tsx
  export function SearchResults({ query }: { query: string }) {
    const channels = useSearchChannels(query);
    const categories = useSearchCategories(query);
    
    return (
      <Tabs>
        <TabPanel value="channels">
          <ChannelResults channels={channels.data} />
        </TabPanel>
        <TabPanel value="categories">
          <CategoryResults categories={categories.data} />
        </TabPanel>
        <TabPanel value="live">
          <LiveResults streams={liveStreams.data} />
        </TabPanel>
      </Tabs>
    );
  }
  ```

- [ ] **2.5.4** Implement search filters
  ```typescript
  interface SearchFilters {
    platform?: 'twitch' | 'kick' | 'all';
    type?: 'channels' | 'categories' | 'live';
    language?: string;
    sortBy?: 'relevance' | 'viewers' | 'followers';
  }
  ```

- [ ] **2.5.5** Create search history
  ```typescript
  // Store recent searches locally
  // Display as suggestions
  // Allow clearing history
  ```

#### Verification

- [ ] Search returns results from both platforms
- [ ] Debouncing prevents excessive API calls
- [ ] Filters narrow results correctly
- [ ] Recent searches are saved

---

### Phase 2.6: Following System (3 days)

#### Tasks

- [ ] **2.6.1** Create FollowingPage component
  ```typescript
  // src/frontend/pages/Following/FollowingPage.tsx
  export function FollowingPage() {
    const liveChannels = useFollowedLiveChannels();
    const offlineChannels = useFollowedOfflineChannels();
    
    return (
      <div>
        <Tabs>
          <TabPanel value="live">
            <LiveChannelsGrid channels={liveChannels} />
          </TabPanel>
          <TabPanel value="offline">
            <OfflineChannelsGrid channels={offlineChannels} />
          </TabPanel>
          <TabPanel value="all">
            <AllChannelsGrid channels={[...liveChannels, ...offlineChannels]} />
          </TabPanel>
        </Tabs>
      </div>
    );
  }
  ```

- [ ] **2.6.2** Create follows store
  ```typescript
  // src/frontend/store/follows-store.ts
  interface FollowsState {
    localFollows: LocalFollow[];
    twitchFollows: TwitchFollow[];
    kickFollows: KickFollow[];
    
    // Actions
    addLocalFollow: (channel: ChannelInfo) => void;
    removeLocalFollow: (channelId: string) => void;
    syncWithPlatform: (platform: Platform) => void;
    isFollowing: (channelId: string) => boolean;
  }
  ```

- [ ] **2.6.3** Create FollowButton component
  ```typescript
  // src/frontend/components/common/FollowButton.tsx
  export function FollowButton({ channel }: { channel: ChannelInfo }) {
    const isFollowing = useIsFollowing(channel.id);
    const { follow, unfollow } = useFollowActions();
    
    // Toggle follow state
    // Platform-specific vs local follow
    // Loading state during sync
  }
  ```

- [ ] **2.6.4** Create live status indicators
  ```typescript
  // Poll for live status of followed channels
  export function useFollowedChannelsLiveStatus() {
    const follows = useFollows();
    
    return useQuery({
      queryKey: ['follows', 'live-status'],
      queryFn: () => checkLiveStatus(follows.map(f => f.channelId)),
      refetchInterval: 60_000, // Check every minute
    });
  }
  ```

- [ ] **2.6.5** Implement sidebar follows section
  ```typescript
  // src/frontend/components/layout/Sidebar/FollowedChannels.tsx
  // List of followed channels
  // Live indicators
  // View count for live channels
  // Collapsible sections (live/offline)
  ```

- [ ] **2.6.6** Sync follows on auth
  ```typescript
  // When user logs in:
  // 1. Fetch platform follows
  // 2. Merge with local follows
  // 3. Offer to sync local to platform
  ```

#### Verification

- [ ] Can follow/unfollow channels
- [ ] Follows persist locally
- [ ] Platform follows sync correctly
- [ ] Live status updates automatically
- [ ] Sidebar shows followed channels

---

### Phase 2.7: UI Polish & Animations (2 days)

#### Tasks

- [ ] **2.7.1** Add loading skeletons
  ```typescript
  // src/frontend/components/common/Skeleton.tsx
  export function StreamCardSkeleton() {
    // Animated placeholder matching card layout
  }
  
  export function CategoryCardSkeleton() {
    // Animated placeholder matching category card
  }
  ```

- [ ] **2.7.2** Implement thumbnail hover previews
  ```typescript
  // On hover, show live preview (if available)
  // Fallback to animated thumbnail
  ```

- [ ] **2.7.3** Add transition animations
  ```typescript
  // Page transitions
  // Card hover effects
  // Follow button animations
  ```

- [ ] **2.7.4** Implement virtual scrolling for large lists
  ```typescript
  // Use tanstack/virtual for performance
  import { useVirtualizer } from '@tanstack/react-virtual';
  ```

- [ ] **2.7.5** Add empty and error states
  ```typescript
  <EmptyState
    icon={<SearchIcon />}
    title="No results found"
    description="Try different search terms or filters"
    action={<Button>Clear filters</Button>}
  />
  ```

#### Verification

- [ ] Loading states show smoothly
- [ ] Animations are performant
- [ ] Large lists scroll smoothly
- [ ] Error states are informative

---

## Testing & Verification

### Unit Tests

- [ ] Data transformers
- [ ] Query hooks
- [ ] Store actions
- [ ] Utility functions

### Integration Tests

- [ ] API calls with mock data
- [ ] Following persistence
- [ ] Search functionality

### E2E Tests

- [ ] Home page loads content
- [ ] Category navigation works
- [ ] Search returns results
- [ ] Following works correctly

### Performance Tests

- [ ] Page load time < 2s
- [ ] Scroll performance 60fps
- [ ] API response handling

---

## Security Considerations

### API Security

- Rate limit API requests client-side
- Validate all API responses
- Handle sensitive data appropriately

### Data Validation

- Sanitize search inputs
- Validate channel/category IDs
- Handle malformed API data

---

## Dependencies

```json
{
  "dependencies": {
    "@tanstack/react-virtual": "^3.x",
    "use-debounce": "^10.x"
  }
}
```

---

## Success Criteria

Phase 2 is complete when:

1. ✅ Home page displays content from both platforms
2. ✅ Categories can be browsed and filtered
3. ✅ Search works across both platforms
4. ✅ Following system works (local + platform)
5. ✅ Sidebar shows followed channels with live status
6. ✅ Performance is smooth with large data sets
7. ✅ UI is polished with loading states

---

## Next Phase

→ **[Phase 3: Stream Viewing](./phase-3-stream-viewing-spec.md)**

