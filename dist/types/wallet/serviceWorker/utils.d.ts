/**
 * setupServiceWorker sets up the service worker.
 * @param path - the path to the service worker script
 * @example
 * ```typescript
 * const serviceWorker = await setupServiceWorker("/service-worker.js");
 * ```
 */
export declare function setupServiceWorker(path: string): Promise<ServiceWorker>;
