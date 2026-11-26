/* Sigan Probando · control de servicio.
   Lee la hoja pública "Estado de servicios" y, si este cliente aparece como
   "Suspendido", tapa la página con un aviso. Si no hay internet o la hoja no
   responde, la página sigue funcionando normal. */
(function () {
  var ID = (document.currentScript && document.currentScript.dataset.cliente) || "";
  var HOJA = "1KkVenbJyUmxq4C7bpZaCopWGr0FD7tFvOneR0QdnFzc";
  var WA = "584247419637";
  if (!ID) return;
  fetch("https://docs.google.com/spreadsheets/d/" + HOJA + "/gviz/tq?tqx=out:csv&sheet=Estado&t=" + Date.now())
    .then(function (r) { return r.text(); })
    .then(function (t) {
      var fila = t.split(/\r?\n/).map(function (l) { return l.split(",").map(function (c) { return c.replace(/^"|"$/g, "").trim(); }); })
        .filter(function (c) { return c[0].toLowerCase() === ID.toLowerCase(); })[0];
      if (!fila || (fila[1] || "").toLowerCase() !== "suspendido") return;
      var d = document.createElement("div");
      d.setAttribute("style", "position:fixed;inset:0;z-index:2147483647;background:#0d0f12;color:#f3f5f8;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px;font-family:system-ui,sans-serif");
      d.innerHTML = '<div style="font-size:46px;margin-bottom:12px">⏸️</div><h2 style="font-size:22px;margin:0 0 10px">Servicio temporalmente suspendido</h2><p style="color:#9aa3ad;max-width:320px;line-height:1.45;margin:0 0 22px">Este catálogo está pausado por el momento. Para reactivarlo, comunícate con Sigan Probando.</p><a href="https://wa.me/' + WA + '" style="background:#25d366;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:999px">Escribir por WhatsApp</a>';
      document.body.appendChild(d);
      document.documentElement.style.overflow = "hidden";
    })
    .catch(function () {});
})();
