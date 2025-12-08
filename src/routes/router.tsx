import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  HomePage,
  FollowingPage,
  CategoriesPage,
  CategoryDetailPage,
  SearchPage,
  StreamPage,
  SettingsPage,
} from '@/pages';

// Root layout with AppLayout wrapper
const rootRoute = createRootRoute({
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});

// Home/Browse page
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

// Following page
const followingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/following',
  component: FollowingPage,
});

// Categories page
const categoriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/categories',
  component: CategoriesPage,
});

// Category detail page
const categoryDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/categories/$categoryId',
  component: CategoryDetailPage,
});

// Search page
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: SearchPage,
});

// Stream viewing page
const streamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stream/$platform/$channel',
  component: StreamPage,
});

// Settings page
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

// Build the route tree
const routeTree = rootRoute.addChildren([
  homeRoute,
  followingRoute,
  categoriesRoute,
  categoryDetailRoute,
  searchRoute,
  streamRoute,
  settingsRoute,
]);

// Create and export the router
export const router = createRouter({ routeTree });

// Type declarations for type-safe routing
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
