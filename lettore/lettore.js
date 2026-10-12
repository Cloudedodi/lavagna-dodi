/* Lavagna ordini Dodi — lettore del testo delle foto, eseguito in un worker (un processo a parte
   del browser, così la pagina non si blocca). Usa Tesseract (tesseract.js-core 7.0.0, licenza Apache 2.0)
   con la lingua italiana di tessdata_fast. Messaggi: {id, dati: Uint8Array grigi, w, h} -> {id, ok, testo | errore}. */
/* global TesseractCore, LAVAGNA_ITA_B64 */
"use strict";

var avvio = null;
var Tess = null;
var api = null;

// SIMD di WebAssembly: c'è su quasi tutti i telefoni recenti; senza, si usa la versione normale.
function haSimd() {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch (e) { return false; }
}

function base64(s) {
  var bin = atob(s);
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pgm(g, w, h) {
  var testa = "P5\n" + w + " " + h + "\n255\n";
  var out = new Uint8Array(testa.length + g.length);
  for (var i = 0; i < testa.length; i++) out[i] = testa.charCodeAt(i);
  out.set(g, testa.length);
  return out;
}

function avvia() {
  if (avvio) return avvio;
  avvio = new Promise(function (ok, ko) {
    if (typeof WebAssembly !== "object") { ko(new Error("questo browser non ha WebAssembly")); return; }
    var simd = haSimd();
    importScripts(simd ? "tesseract-core-simd-lstm.wasm.js" : "tesseract-core-lstm.wasm.js");
    importScripts("ita-traineddata.js");
    TesseractCore().then(function (M) {
      Tess = M;
      Tess.FS.writeFile("ita.traineddata", base64(LAVAGNA_ITA_B64));
      api = new Tess.TessBaseAPI();
      if (api.Init(null, "ita") !== 0) throw new Error("lingua italiana non caricata");
      api.SetVariable("tessedit_pageseg_mode", "6");
      ok({ simd: simd });
    }).catch(ko);
  });
  return avvio;
}

self.onmessage = function (ev) {
  var m = ev.data || {};
  var t0 = Date.now();
  avvia().then(function (info) {
    if (m.tipo === "prepara") { self.postMessage({ id: m.id, ok: true, pronto: true, simd: info.simd }); return; }
    try {
      Tess.FS.writeFile("/input", pgm(m.dati, m.w, m.h));
      api.SetImageFile();
      var testo = api.GetUTF8Text();
      self.postMessage({ id: m.id, ok: true, testo: testo, ms: Date.now() - t0, simd: info.simd });
    } catch (e) {
      self.postMessage({ id: m.id, ok: false, errore: String((e && e.message) || e) });
    }
  }, function (e) {
    // il motore non parte (es. la finestra non permette WebAssembly): inutile riprovare
    self.postMessage({ id: m.id, ok: false, avvio: true, errore: String((e && e.message) || e) });
  });
};
