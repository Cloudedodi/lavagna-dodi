// Lavagna ordini Dodi — versione 7b0330d1ce
const PAGINA = "lavagna-pagina-7b0330d1ce";
const LETTORE = "lavagna-lettore-v1";
self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(PAGINA).then((c) => c.addAll(["./", "manifest.webmanifest", "icone/icona-192.png", "icone/icona-512.png"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (ev) => {
  ev.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== PAGINA && k !== LETTORE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (ev) => {
  const u = new URL(ev.request.url);
  if (ev.request.method !== "GET" || u.origin !== location.origin) return; // database e accesso: sempre dalla rete
  if (u.pathname.includes("/lettore/tesseract-core") || u.pathname.endsWith("/lettore/ita-traineddata.js")) {
    ev.respondWith(caches.open(LETTORE).then((c) => c.match(ev.request).then((r) => r || fetch(ev.request).then((res) => { if (res.ok) c.put(ev.request, res.clone()); return res; }))));
    return;
  }
  ev.respondWith(fetch(ev.request).then((res) => {
    if (res.ok) { const copia = res.clone(); caches.open(PAGINA).then((c) => c.put(ev.request, copia)); }
    return res;
  }).catch(() => caches.match(ev.request).then((r) => r || caches.match("./"))));
});
