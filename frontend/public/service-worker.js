const STATIC_CACHE = 'dhaka-pharmacy-static-v1';
const API_CACHE = 'dhaka-pharmacy-api-v1';
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/dhaka-pharmacy-logo.png',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const isSameOrigin = (url) => url.origin === self.location.origin;
const isApiRequest = (url) => url.pathname.startsWith('/api');
const isStaticAssetRequest = (request, url) => (
  ['style', 'script', 'image', 'font'].includes(request.destination) ||
  url.pathname.startsWith('/static/')
);

const putInCache = async (cacheName, request, response) => {
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
};

const cacheFirst = async (request, cacheName) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.ok) {
    await putInCache(cacheName, request, networkResponse);
  }
  return networkResponse;
};

const networkFirst = async (request, options = {}) => {
  const { cacheName, cacheable = () => true, fallbackUrl } = options;

  try {
    const networkResponse = await fetch(request);
    if (cacheName && networkResponse && networkResponse.ok && cacheable(networkResponse)) {
      await putInCache(cacheName, request, networkResponse);
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (fallbackUrl) {
      const fallbackResponse = await caches.match(fallbackUrl);
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }

    throw error;
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cacheName) => ![STATIC_CACHE, API_CACHE].includes(cacheName))
        .map((cacheName) => caches.delete(cacheName))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (!isSameOrigin(url)) {
    return;
  }

  if (isApiRequest(url)) {
    const hasAuthHeader = request.headers.has('Authorization');

    // Authenticated pharmacy data stays live-first and is not persisted to cache.
    event.respondWith(networkFirst(request, {
      cacheName: hasAuthHeader ? null : API_CACHE,
    }));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, {
      cacheName: STATIC_CACHE,
      cacheable: (response) => response.type === 'basic',
      fallbackUrl: '/index.html',
    }));
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});
