/**
 * Service Worker Registration and Management
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[Service Worker] Registered successfully:', registration.scope);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('[Service Worker] New version available');
              // Optionally show update notification to user
            }
          });
        }
      });

      return registration;
    } catch (error) {
      console.error('[Service Worker] Registration failed:', error);
      return null;
    }
  }
  return null;
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const unregistered = await registration.unregister();
      console.log('[Service Worker] Unregistered:', unregistered);
      return unregistered;
    } catch (error) {
      console.error('[Service Worker] Unregistration failed:', error);
      return false;
    }
  }
  return false;
}

/**
 * Request background sync
 */
export async function requestBackgroundSync(tag: string): Promise<boolean> {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register(tag);
      console.log('[Service Worker] Background sync registered:', tag);
      return true;
    } catch (error) {
      console.error('[Service Worker] Background sync failed:', error);
      return false;
    }
  }
  return false;
}

/**
 * Check if service worker is supported
 */
export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}
