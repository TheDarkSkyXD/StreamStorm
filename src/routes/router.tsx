import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  createHashHistory,
} from '@tanstack/react-router';

import { AppLayout } from '@/components/layout/AppLayout';
import {
  HomePage,
  FollowingPage,
  CategoriesPage,
  CategoryDetailPage,
  SearchPage,
  StreamPage,
  VideoPage,
  SettingsPage,
  ClipPage,
  PopoutPage,
  MultiStreamPage,
} from '@/pages';

// Root layout (wraps everything)
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// App Layout Route (Pathless) - provides the sidebar/navbar
const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});

// Popout Route (Minimal layout)
const popoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/popout/$platform/$channel',
  component: PopoutPage,
});

// Home/Browse page
const homeRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/',
  component: HomePage,
});

// Following page
const followingRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/following',
  component: FollowingPage,
});

// Categories page
const categoriesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/categories',
  component: CategoriesPage,
});

// Category detail page
const categoryDetailRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/categories/$platform/$categoryId',
  component: CategoryDetailPage,
});

// Search page
const searchRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/search',
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search.q as string) || '',
  }),
  component: SearchPage,
});

// Stream viewing page
const streamRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/stream/$platform/$channel',
  validateSearch: (search: Record<string, unknown>): { tab: 'videos' | 'clips' } => ({
    tab: (search.tab as 'videos' | 'clips') || 'videos',
  }),
  component: StreamPage,
});

// Video viewing page (VOD)
const videoRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/video/$platform/$videoId',
  component: VideoPage,
});

// Clip viewing page
const clipRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/clip/$platform/$clipId',
  component: ClipPage,
});

// Settings page
const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/settings',
  component: SettingsPage,
});

// MultiStream page
const multiStreamRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/multistream',
  component: MultiStreamPage,
});

// Build the route tree
const routeTree = rootRoute.addChildren([
  appLayoutRoute.addChildren([
    homeRoute,
    followingRoute,
    categoriesRoute,
    categoryDetailRoute,
    searchRoute,
    streamRoute,
    videoRoute,
    clipRoute,
    settingsRoute,
    multiStreamRoute,
  ]),
  popoutRoute,
]);

// Create and export the router
export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

// Type declarations for type-safe routing
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
