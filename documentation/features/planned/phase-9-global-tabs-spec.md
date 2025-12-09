# Phase 9: Global Tabs & Workspace Management

## 1. Overview
The goal of this phase is to implement a global tab system positioned **between the Title Bar and the Top Navigation Bar**. This feature enables a browser-like experience within the desktop application, where users can create, close, and switch between multiple tabs.

**Key Concept:**
- **Positioning:** The tab bar sits strictly below the custom Title Bar and above the application's Top Navigation Bar.
- **Workflow:** Users can open new tabs to create parallel "sessions". For example, watching a stream in one tab while browsing discovery or settings in another.
- **Browser-like:** Includes standard tab functionality: "+" button for new tabs, "x" to close, and click to switch.

## 2. Requirements

### 2.1 Core Components
- **GlobalTabBar Component**:
  - Located directly below the Title Bar.
  - Contains the list of open tabs and a "New Tab" (+) button.
  - **Tab Item**: Displays the title of the current page (e.g. "xQc", "Settings").
    - Includes a Close (X) button.
    - Click to switch context.
- **TabState (Zustand)**:
  - `tabs`: Array of objects `{ id, url, title }`.
  - `activeTabId`: ID of the currently visible tab.

### 2.2 Functional Requirements
- **Position**: The `GlobalTabBar` must reside structurally inside the `AppLayout`, specifically rendered after `TitleBar` but before `TopNavBar`.
- **Add Tab**: Custom "+" button. Opens a new tab (defaulting to Home `/`).
- **Switching**:
  - Unmounts the current `Outlet` (or hides it).
  - Mounts/Shows the content for the selected tab's URL.
  - **Crucially**: The Sidebar and TopNavBar are part of the "Layout" that is preserved or re-rendered per tab context so they reflect that tab's state.
  - *Refinement*: To keep it lightweight, the *Sidebar* itself might be global, but the *Main Content* changes. However, if the user wants to browse the sidebar in Tab B without affecting Tab A's selection, the internal state of the sidebar needs to sync with the active tab. For V1, we will assume the Sidebar is global, but the **active route** is per-tab.
- **Close Tab**: Removes the tab. If active, switches to the nearest neighbor.

### 2.3 Visual Design
- **Height**: ~30-36px.
- **Style**:
  - Dark background (slightly lighter than title bar).
  - Active Tab: High contrast (e.g., standard background color), distinguishable from inactive tabs.
  - Inactive Tabs: Dimmed.
  - Separators between tabs.

## 3. Implementation Plan

### 3.1 Store Updates (AppStore)
- [ ] Re-finalize the `Tab` interface.
- [ ] Ensure `addTab`, `removeTab` logic is solid.
- [ ] **No History**: We do not need a history stack. `updateTab` simply updates the `currentUrl` when navigation happens.

### 3.2 Component Architecture
- [ ] Create `components/layout/GlobalTabBar.tsx`.
- [ ] Modify `AppLayout.tsx`:
  ```tsx
  <div className="flex flex-col h-full">
    <TitleBar />       {/* Row 1: Window Controls */}
    <GlobalTabBar />   {/* Row 2: The New Feature */}
    <TopNavBar />      {/* Row 3: Search / User */}
    <div className="flex-1 flex ..."> 
      <Sidebar />
      <MainContent />
    </div>
  </div>
  ```

### 3.3 Router & Navigation Sync
- [ ] **The Challenge**: The Router (TanStack Router) drives the URL.
- [ ] **The Solution**:
  - We subscribe to router changes. When route changes, we update `activeTab.url` in the store.
  - When user clicks a Tab, we programmatically `navigate` to that tab's stored URL.
  - This effectively makes the Tabs a "Remote Control" for the Router.

## 4. Success Criteria
- [ ] Tabs appear strictly between Title Bar and Top Nav.
- [ ] Opening a new tab starts at Home (or separate default).
- [ ] Clicking Tab A shows Stream A. Clicking Tab B shows Stream B (or Settings).
- [ ] Closing a tab works instantly.
