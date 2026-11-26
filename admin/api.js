/* ============================================================
   CAPA DE DATOS · igual para todos los clientes
   - Modo real: habla con el Apps Script (PANEL_CONFIG.apiUrl).
   - Modo demo: usa la copia de solo lectura (window.MOCK_DATA) y
     guarda los cambios SOLO en este teléfono (localStorage).
   Producto = { fila, nombre, categoria, precio, tallas:{XS:"",S:"1",...},
                foto, foto2, disponible, descripcion, promo, desde, hasta }
   Tallas: "" = no la tiene · número = unidades · "TRUE" = sin límite.
   Fechas de promo: texto dd/mm/aaaa (como en la hoja).
   ============================================================ */
(function () {
  const C = window.PANEL_CONFIG || {};
  const DEMO = !C.apiUrl;
  const LS = "panel_demo_" + (C.tienda || "tienda").toLowerCase().replace(/\W+/g, "_");
  const PINKEY = LS + "_pin", MAILKEY = LS + "_correo";

  /* ---------- utilidades ---------- */
  const driveId = u => { const m = String(u || "").match(/(?:\/d\/|[?&]id=)([\w-]{20,})/); return m ? m[1] : ""; };
  function imagen(u, ancho) {
    if (!u) return "";
    if (/^(data:|blob:|assets\/|mock\/|\.\/)/.test(u)) return u;
    const id = driveId(u);
    if (id) {
      if (DEMO && window.MOCK_THUMBS && window.MOCK_THUMBS[id]) return window.MOCK_THUMBS[id];
      return `https://lh3.googleusercontent.com/d/${id}=w${ancho || 400}`;
    }
    return u;
  }
  // Reduce la foto en el teléfono antes de subirla (máx. 1400 px, JPEG ~80%)
  function comprimir(file, max = 1400, calidad = 0.8) {
    return new Promise((ok, mal) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        ok(c.toDataURL("image/jpeg", calidad));
      };
      img.onerror = () => mal(new Error("No se pudo leer la foto"));
      img.src = url;
    });
  }

  /* ---------- modo demo ---------- */
  const demo = {
    leer() {
      try { const s = JSON.parse(localStorage.getItem(LS)); if (s && s.productos) return s; } catch (e) {}
      const M = window.MOCK_DATA || { config: {}, productos: [] };
      return JSON.parse(JSON.stringify({ config: M.config, productos: M.productos }));
    },
    guardar(d) { try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) { /* fotos grandes pueden llenar el almacenamiento */ } },
    pausa: (ms = 450) => new Promise(r => setTimeout(r, ms))
  };

  /* ---------- modo real ---------- */
  async function llamar(accion, datos) {
    const pin = localStorage.getItem(PINKEY) || "", correo = localStorage.getItem(MAILKEY) || "";
    let r;
    if (!datos) {
      r = await fetch(`${C.apiUrl}?accion=${encodeURIComponent(accion)}&pin=${encodeURIComponent(pin)}&correo=${encodeURIComponent(correo)}&t=${Date.now()}`);
    } else {
      // text/plain evita el "preflight" CORS que Apps Script no responde
      r = await fetch(C.apiUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ accion, pin, correo, ...datos }) });
    }
    if (!r.ok) throw new Error("El servidor no respondió (" + r.status + ")");
    const j = await r.json();
    if (!j.ok) { const e = new Error(j.error || "Algo salió mal"); e.code = j.code; throw e; }
    return j;
  }

  window.API = {
    demo: DEMO,
    imagen, comprimir, driveId,

    async entrar(pin, correo) {
      pin = String(pin || "").trim().toUpperCase();
      correo = String(correo || localStorage.getItem(MAILKEY) || "").trim().toLowerCase();
      localStorage.setItem(MAILKEY, correo);
      if (DEMO) { await demo.pausa(300); if (pin !== String(C.pin || "").trim().toUpperCase()) throw new Error("Correo o clave incorrectos"); localStorage.setItem(PINKEY, pin); return true; }
      localStorage.setItem(PINKEY, pin);
      try { const j = await llamar("ping"); return { cambiar: !!j.cambiar }; } catch (e) { localStorage.removeItem(PINKEY); throw e; }
    },

    // Clave: cambiar (con sesión), pedir código al correo y restablecer (sin sesión)
    async cambiarClave(nueva) {
      nueva = String(nueva || "").trim().toUpperCase();
      if (DEMO) { await demo.pausa(); C.pin = nueva; localStorage.setItem(PINKEY, nueva); return true; }
      await llamar("clave", { nueva }); localStorage.setItem(PINKEY, nueva); return true;
    },
    async olvide() {
      if (DEMO) { await demo.pausa(); return { correo: "pr•••@gmail.com (vista previa: el código es 123456)" }; }
      return await llamar("olvide", {});
    },
    async restablecer(codigo, nueva) {
      nueva = String(nueva || "").trim().toUpperCase();
      if (DEMO) { await demo.pausa(); if (String(codigo).trim() !== "123456") throw new Error("Código incorrecto"); C.pin = nueva; return true; }
      await llamar("restablecer", { codigo: String(codigo || "").trim(), nueva }); return true;
    },
    correo() { return localStorage.getItem(MAILKEY) || ""; },
    sesion() { return !!localStorage.getItem(PINKEY); },
    salir() { localStorage.removeItem(PINKEY); },

    async cargar() {
      if (DEMO) { await demo.pausa(250); return demo.leer(); }
      const j = await llamar("listar"); return { config: j.config, productos: j.productos };
    },

    async guardarProducto(p) {
      if (DEMO) {
        await demo.pausa(); const d = demo.leer();
        if (p.fila) { const i = d.productos.findIndex(x => x.fila === p.fila); if (i >= 0) d.productos[i] = { ...d.productos[i], ...p }; }
        else { p.fila = Math.max(1, ...d.productos.map(x => x.fila)) + 1; d.productos.unshift(p); }
        demo.guardar(d); return p;
      }
      const j = await llamar(p.fila ? "actualizar" : "agregar", { producto: p }); return j.producto;
    },

    async borrarProducto(fila) {
      if (DEMO) { await demo.pausa(); const d = demo.leer(); d.productos = d.productos.filter(x => x.fila !== fila); demo.guardar(d); return true; }
      await llamar("borrar", { fila }); return true;
    },

    async guardarConfig(cfg) {
      if (DEMO) { await demo.pausa(); const d = demo.leer(); d.config = { ...d.config, ...cfg }; demo.guardar(d); return d.config; }
      const j = await llamar("config", { config: cfg }); return j.config;
    },

    // dataUrl = "data:image/jpeg;base64,..."  → devuelve el enlace público de Drive
    async subirFoto(dataUrl, nombre) {
      if (DEMO) { await demo.pausa(700); return dataUrl; }   // en demo la foto queda solo en este teléfono
      const j = await llamar("foto", { nombre: nombre || "foto.jpg", datos: dataUrl }); return j.url;
    },

    reiniciarDemo() { localStorage.removeItem(LS); }
  };
})();
