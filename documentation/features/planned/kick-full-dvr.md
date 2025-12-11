# Feature: Kick Full DVR Support

## Overview
Implement full "Server-Side DVR" for Kick live streams, allowing users to seek back to the beginning of a broadcast even if they joined while it was already in progress.

## Current Limitations
*   **Sliding Window Manifests**: The public HLS endpoints provided by Kick (`/channels/{slug}`) return a "Live" playlist with a short sliding window (typically roughly 30-60 seconds of segments).
*   **No History**: Once a segment falls out of this window, it is no longer accessible via the live manifest.

## Strategy: Wait for Official Support
**We have decided NOT to implement a "Local DVR" workaround (client-side caching).**
Storing video segments in memory to create a synthetic history is resource-intensive and provides an inconsistent experience (user can only rewind as far as they have watched).

**Conclusion:**
This feature is **BLOCKED** until Kick updates their API or streaming infrastructure to support DVR natively.

## Required Platform Changes (Dependency)
For this feature to be feasible:
*   **Kick/IVS Configuration**: Kick must enable DVR (HLS Playlist History) on their streaming infrastructure.
*   **API Update**: The HLS manifest URL must point to a playlist that contains the full stream history (or a significant window, e.g. 4 hours), rather than just the live edge.

## Future Implementation Steps
Once Kick provides a DVR-enabled HLS stream:
1.  Verify the HLS manifest contains older segments (not just sliding window).
2.  Enable the seek bar interaction in `KickProgressBar`.
3.  Ensure `KickLivePlayer` correctly calculates duration based on the static start time and dynamic end time of the manifest.

## Success Criteria
*   User opens a stream that has been live for 4 hours.
*   Progress bar shows full 4-hour duration.
*   User can click "0:00" and immediately play from the start of the stream without having watched it locally.
