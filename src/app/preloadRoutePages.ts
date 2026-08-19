import { routePageLoaders } from '@app/routePageModules'

export async function preloadRoutePages() {
  await Promise.allSettled(routePageLoaders.map((loadPage) => loadPage()))
}
