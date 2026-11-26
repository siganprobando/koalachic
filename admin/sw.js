/* Service worker del Panel: guarda la app para que abra rápido y sin señal.
   Los datos (Apps Script) y las fotos (Drive) siempre se piden en línea. */
const V = "koala-panel-v1";
const APP = ["./", "index.html", "app.js", "api.js", "config.js", "manifest.json", "assets/fonts.css", "assets/logo.png", "assets/icon-192.png", "assets/icon-512.png",
  "assets/fonts/Poppins-400.woff2", "assets/fonts/Poppins-500.woff2", "assets/fonts/Poppins-600.woff2", "assets/fonts/Poppins-700.woff2", "assets/fonts/PlayfairDisplay-700.woff2", "assets/fonts/PlayfairDisplay-800.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(APP)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;           // API y fotos: directo a la red
  // red primero (para ver cambios de config.js al instante), caché si no hay señal
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
