// Minimal service worker — just enough to make Nivora installable as an app.
// No offline caching is implemented; everything still requires a network
// connection. This can be extended later with real caching if offline
// support is ever wanted.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Pass everything straight through to the network.
  event.respondWith(fetch(event.request));
});
