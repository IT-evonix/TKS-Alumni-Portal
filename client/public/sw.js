/**
 * Service Worker for Offline Support and Caching
 * Provides offline functionality, asset caching, and background sync
 */

const CACHE_NAME = 'tks-alumni-portal-v1';
const RUNTIME_CACHE = 'tks-runtime-v1';
const STATIC_CACHE = 'tks-static-v1';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
];

// API routes to cache (with network-first strategy)
const API_CACHE_PATTERNS = [
    /^\/api\/posts/,
    /^\/api\/notifications/,
    /^\/api\/alumni/,
    /^\/api\/events/,
    /^\/api\/connections/,
    /^\/api\/messages/,
    /^\/api\/forums/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('[Service Worker] Caching static assets');
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[Service Worker] Failed to cache some assets:', err);
            });
        })
    );
    self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => {
                        return name !== STATIC_CACHE && name !== RUNTIME_CACHE && name !== CACHE_NAME;
                    })
                    .map((name) => {
                        console.log('[Service Worker] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    return self.clients.claim(); // Take control of all pages
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Handle API requests with network-first strategy
    if (API_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
        event.respondWith(
            networkFirstStrategy(request).catch((error) => {
                console.error('[Service Worker] Unhandled error in networkFirstStrategy:', error);
                // Return a safe error response
                return new Response(JSON.stringify({
                    error: 'Service unavailable',
                    offline: true
                }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Handle static assets with cache-first strategy
    if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
        event.respondWith(
            cacheFirstStrategy(request).catch((error) => {
                console.error('[Service Worker] Unhandled error in cacheFirstStrategy:', error);
                return new Response('Resource unavailable', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
        );
        return;
    }

    // Handle images with cache-first strategy
    if (request.destination === 'image') {
        event.respondWith(
            cacheFirstStrategy(request).catch((error) => {
                console.error('[Service Worker] Unhandled error in cacheFirstStrategy:', error);
                return new Response('Image unavailable', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
        );
        return;
    }

    // Default: network-first for HTML pages
    event.respondWith(
        networkFirstStrategy(request).catch((error) => {
            console.error('[Service Worker] Unhandled error:', error);
            // Return a safe fallback response
            return new Response('Service unavailable', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' }
            });
        })
    );
});

// Network-first strategy: try network, fallback to cache
async function networkFirstStrategy(request) {
    try {
        // Add timeout to prevent hanging requests (10 seconds)
        const fetchPromise = fetch(request);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 10000);
        });

        const networkResponse = await Promise.race([fetchPromise, timeoutPromise]);

        // Cache successful responses
        if (networkResponse && networkResponse.ok) {
            try {
                const cache = await caches.open(RUNTIME_CACHE);
                cache.put(request, networkResponse.clone()).catch((err) => {
                    console.warn('[Service Worker] Failed to cache response:', err);
                });
            } catch (cacheError) {
                console.warn('[Service Worker] Cache error (non-fatal):', cacheError);
            }
        }

        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] Network failed, trying cache:', request.url);

        try {
            const cachedResponse = await caches.match(request);

            if (cachedResponse) {
                return cachedResponse;
            }
        } catch (cacheError) {
            console.warn('[Service Worker] Cache lookup failed:', cacheError);
        }

        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            try {
                const offlinePage = await caches.match('/index.html');
                if (offlinePage) {
                    return offlinePage;
                }
            } catch (e) {
                console.warn('[Service Worker] Failed to get offline page:', e);
            }

            return new Response('Offline', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        // For API requests, return a proper error response instead of throwing
        const isApiRequest = API_CACHE_PATTERNS.some((pattern) => pattern.test(new URL(request.url).pathname));
        if (isApiRequest) {
            return new Response(JSON.stringify({
                error: 'Network request failed',
                offline: true
            }), {
                status: 503,
                statusText: 'Service Unavailable',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
        }

        // For other requests, return a generic error response
        return new Response('Network request failed', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Cache-first strategy: try cache, fallback to network
async function cacheFirstStrategy(request) {
    try {
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }
    } catch (cacheError) {
        console.warn('[Service Worker] Cache lookup failed:', cacheError);
    }

    try {
        // Add timeout to prevent hanging requests (10 seconds)
        const fetchPromise = fetch(request);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 10000);
        });

        const networkResponse = await Promise.race([fetchPromise, timeoutPromise]);

        // Cache successful responses
        if (networkResponse && networkResponse.ok) {
            try {
                const cache = await caches.open(STATIC_CACHE);
                cache.put(request, networkResponse.clone()).catch((err) => {
                    console.warn('[Service Worker] Failed to cache response:', err);
                });
            } catch (cacheError) {
                console.warn('[Service Worker] Cache error (non-fatal):', cacheError);
            }
        }

        return networkResponse;
    } catch (error) {
        console.error('[Service Worker] Fetch failed:', error);

        // Return error response instead of throwing
        return new Response('Resource unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync:', event.tag);

    if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    }

    if (event.tag === 'sync-posts') {
        event.waitUntil(syncPosts());
    }
});

// Sync messages when back online
async function syncMessages() {
    try {
        // Get pending messages from IndexedDB
        const pendingMessages = await getPendingMessages();

        for (const message of pendingMessages) {
            try {
                const response = await fetch('/api/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'user-id': message.userId,
                    },
                    body: JSON.stringify(message.data),
                });

                if (response.ok) {
                    // Remove from pending
                    await removePendingMessage(message.id);
                }
            } catch (error) {
                console.error('[Service Worker] Failed to sync message:', error);
            }
        }
    } catch (error) {
        console.error('[Service Worker] Sync messages error:', error);
    }
}

// Sync posts when back online
async function syncPosts() {
    try {
        const pendingPosts = await getPendingPosts();

        for (const post of pendingPosts) {
            try {
                const response = await fetch('/api/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'user-id': post.userId,
                    },
                    body: JSON.stringify(post.data),
                });

                if (response.ok) {
                    await removePendingPost(post.id);
                }
            } catch (error) {
                console.error('[Service Worker] Failed to sync post:', error);
            }
        }
    } catch (error) {
        console.error('[Service Worker] Sync posts error:', error);
    }
}

// Placeholder functions for IndexedDB (to be implemented if needed)
async function getPendingMessages() {
    return [];
}

async function removePendingMessage(id) {
    // Implement IndexedDB removal
}

async function getPendingPosts() {
    return [];
}

async function removePendingPost(id) {
    // Implement IndexedDB removal
}

// Push notification handler
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push notification received');

    const data = event.data ? event.data.json() : {};
    const title = data.title || 'TKS Alumni Portal';
    const options = {
        body: data.body || 'You have a new notification',
        icon: '/tks_logo.png',
        badge: '/tks_logo.png',
        data: data,
        tag: data.tag || 'notification',
        requireInteraction: false,
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked');
    event.notification.close();

    const data = event.notification.data;
    const url = data?.url || '/';

    event.waitUntil(
        clients.openWindow(url)
    );
});
