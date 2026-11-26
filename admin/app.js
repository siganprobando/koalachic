/* Panel de la tienda · lógica de pantallas (igual para todos los clientes) */
(function () {
  const C = window.PANEL_CONFIG, A = window.API;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MON = C.moneda || "$", TALLAS = C.tallas || ["XS", "S", "M", "L", "XL"], CATS = C.categorias || [];
  const num = v => Number(String(v == null ? "" : v).replace(MON, "").replace(",", ".").trim()) || 0;
  const money = v => MON + (Math.round(num(v) * 100) / 100).toString().replace(".", ",");
  const ICON = {
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    gal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>'
  };
  let D = { config: {}, productos: [] }, F = { cat: "todas", q: "" }, E = null;

  /* ---------- fechas: hoja (dd/mm[/aaaa]) <-> input date (aaaa-mm-dd) ---------- */
  const aISO = v => { const m = String(v || "").trim().match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/); if (!m) return ""; let y = m[3] ? +m[3] : new Date().getFullYear(); if (y < 100) y += 2000; return `${y}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`; };
  const deISO = v => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${+m[3]}/${+m[2]}/${m[1]}` : ""; };
  const promoActiva = p => { const pp = num(p.promo); if (!(pp > 0 && pp < num(p.precio))) return false; const h = new Date(), d = aISO(p.desde), f = aISO(p.hasta); if (d && h < new Date(d + "T00:00:00")) return false; if (f && h > new Date(f + "T23:59:59")) return false; return true; };
  const tallasTxt = p => TALLAS.filter(t => String(p.tallas[t] || "").trim() && String(p.tallas[t]).toUpperCase() !== "FALSE" && String(p.tallas[t]) !== "0").join(" · ");

  /* ---------- toast + confirmar ---------- */
  let tt;
  function toast(msg, mal) { const t = $("#toast"); $("#toastTx").textContent = msg; t.classList.toggle("bad", !!mal); t.querySelector(".i").textContent = mal ? "!" : "✓"; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), mal ? 4200 : 2800); }
  function confirmar(titulo, texto, ok) { $("#dT").textContent = titulo; $("#dP").textContent = texto; $("#ov").classList.add("show"); $("#dOk").onclick = () => { $("#ov").classList.remove("show"); ok(); }; $("#dNo").onclick = $("#ov").onclick = e => { if (e.target === $("#dNo") || e.target === $("#ov")) $("#ov").classList.remove("show"); }; }
  async function ocupado(btn, txt, fn) { const o = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${txt}`; try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = o; } }

  /* ---------- navegación ---------- */
  function ver(id) {
    if (id === "vitrina") { abrirVitrina(); return; }
    ["login", "vClave", "vProductos", "vEditar", "vAjustes"].forEach(v => $("#" + v).classList.toggle("hide", v !== id));
    $("#nav").classList.toggle("hide", id === "login" || id === "vClave" || id === "vEditar");
    $$("#nav button").forEach(b => b.classList.toggle("on", b.dataset.v === id));
    window.scrollTo(0, 0);
    if (id === "vAjustes") pintarAjustes();
  }
  const abrirVitrina = () => window.open(C.vitrinaUrl, "_blank", "noopener");
  $$("#nav button").forEach(b => b.onclick = () => ver(b.dataset.v));
  window.addEventListener("scroll", () => $("#topP").classList.toggle("sc", scrollY > 4), { passive: true });

  /* ---------- marca ---------- */
  function marca() {
    const nom = D.config.Nombre || C.tienda, logo = A.imagen(D.config.Logo || C.logo, 200);
    $("#hName").textContent = nom; $("#lgName").textContent = nom; $("#hLogo").src = logo; $("#lgLogo").src = logo;
    $("#demoPill").classList.toggle("hide", !A.demo); document.title = "Panel · " + nom;
    $("#m1").textContent = $("#m2").textContent = MON;
  }

  /* ---------- login (clave con letras y números) ---------- */
  const pinIn = $("#pinIn");
  pinIn.addEventListener("input", () => { const v = pinIn.value.toUpperCase().replace(/\s+/g, ""); if (v !== pinIn.value) pinIn.value = v; $("#pinErr").textContent = ""; });
  $("#pinEye").onclick = () => { const ver = pinIn.type === "password"; pinIn.type = ver ? "text" : "password"; $("#pinEye").classList.toggle("on", ver); $("#pinEye").setAttribute("aria-label", ver ? "Ocultar clave" : "Mostrar clave"); pinIn.focus(); };
  $("#pinForm").onsubmit = e => { e.preventDefault(); entrar(); };
  async function entrar() {
    const pin = pinIn.value.trim().toUpperCase(), correo = $("#mailIn").value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) { $("#pinErr").textContent = "Escribe tu correo"; return; }
    if (pin.length < 8) { $("#pinErr").textContent = "La clave tiene 8 caracteres o más"; return; }
    const btn = $("#pinGo");
    try { const r = await ocupado(btn, "Entrando…", () => A.entrar(pin, correo)); pinIn.value = ""; await iniciar(); }
    catch (e) { $("#pinErr").textContent = e.message || "Clave incorrecta"; $(".lg-pin").classList.remove("shake"); void $(".lg-pin").offsetWidth; $(".lg-pin").classList.add("shake"); pinIn.select(); }
  }

  /* ---------- lista ---------- */
  function pintarChips() {
    const n = c => D.productos.filter(p => c === "todas" || (c === "agotados" ? !p.disponible : c === "promo" ? promoActiva(p) && p.disponible : p.categoria === c)).length;
    const ops = [["todas", "Todas"], ...(D.productos.some(promoActiva) ? [["promo", "🔥 En promo"]] : []), ...CATS.map(c => [c, c]), ["agotados", "Agotados"]];
    $("#chips").innerHTML = ops.map(([v, t]) => `<button class="chip ${F.cat === v ? "on" : ""}" data-c="${esc(v)}">${esc(t)}<b>${n(v)}</b></button>`).join("");
    $$("#chips .chip").forEach(b => b.onclick = () => { F.cat = b.dataset.c; pintarChips(); pintarLista(); });
  }
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function pintarLista() {
    const q = norm(F.q);
    const L = D.productos.filter(p => (F.cat === "todas" || (F.cat === "agotados" ? !p.disponible : F.cat === "promo" ? promoActiva(p) && p.disponible : p.categoria === F.cat)) && (!q || norm(p.nombre + " " + p.categoria + " " + p.descripcion).includes(q)));
    const disp = L.filter(p => p.disponible).length;
    $("#cnt").innerHTML = `<b>${L.length}</b> producto${L.length === 1 ? "" : "s"} · ${disp} en la vitrina`;
    if (!L.length) { $("#list").innerHTML = `<div class="empty">${q ? "No hay productos con esa búsqueda." : "Aún no hay productos aquí.<br>Toca <b>Nuevo producto</b> para agregar el primero."}</div>`; return; }
    $("#list").innerHTML = L.map(p => {
      const img = A.imagen(p.foto, 200), pa = promoActiva(p), tz = tallasTxt(p);
      return `<div class="it" data-f="${p.fila}">
        <div class="ph ${p.disponible ? "" : "off"}" style="${img ? `background-image:url('${esc(img)}')` : ""}">${img ? "" : '<span class="nf">📷</span>'}</div>
        <div class="b"><h3>${esc(p.nombre)}</h3><div class="m">${esc(p.categoria || "Sin categoría")}${tz ? " · " + esc(tz) : ""}</div>
          <div class="pr">${pa ? `<span class="v">${money(p.promo)}</span><s>${money(p.precio)}</s><span class="tag promo">Promo</span>` : `<span class="v">${money(p.precio)}</span>`}${p.disponible ? "" : '<span class="tag off">Agotado</span>'}</div></div>
        <div class="r"><label class="sw" onclick="event.stopPropagation()"><input type="checkbox" data-sw="${p.fila}" ${p.disponible ? "checked" : ""}><span></span></label><small>${p.disponible ? "Visible" : "Oculto"}</small></div>
      </div>`;
    }).join("");
    $$("#list .it").forEach(el => el.onclick = () => editar(D.productos.find(p => p.fila === +el.dataset.f)));
    $$("#list [data-sw]").forEach(sw => sw.onchange = async () => {
      const p = D.productos.find(x => x.fila === +sw.dataset.sw), antes = p.disponible; p.disponible = sw.checked; pintarChips(); pintarLista();
      try { await A.guardarProducto({ ...p }); toast(p.disponible ? "Listo, ya se ve en tu vitrina" : "Marcado como agotado · ya no se ve en tu vitrina"); }
      catch (e) { p.disponible = antes; pintarChips(); pintarLista(); toast(e.message, true); }
    });
  }
  $("#q").oninput = e => { F.q = e.target.value; pintarLista(); };
  $("#fab").onclick = () => editar(null);

  /* ---------- editar / nuevo ---------- */
  function editar(p) {
    E = p ? JSON.parse(JSON.stringify(p)) : { fila: 0, nombre: "", categoria: F.cat !== "todas" && CATS.includes(F.cat) ? F.cat : "", precio: "", tallas: Object.fromEntries(TALLAS.map(t => [t, ""])), foto: "", foto2: "", disponible: true, descripcion: "", promo: "", desde: "", hasta: "" };
    E._nuevas = {};
    $("#eTitle").textContent = p ? "Editar producto" : "Nuevo producto";
    $("#fSave").textContent = p ? "Guardar cambios" : "Publicar en mi vitrina";
    $("#fDel").classList.toggle("hide", !p);
    $("#fNombre").value = E.nombre; $("#fDesc").value = E.descripcion || ""; $("#fPrecio").value = E.precio;
    const pOn = num(E.promo) > 0; $("#fPromoOn").checked = pOn; $("#promoBox").classList.toggle("hide", !pOn);
    $("#fPromo").value = pOn ? E.promo : ""; $("#fDesde").value = aISO(E.desde); $("#fHasta").value = aISO(E.hasta);
    $("#fDisp").checked = !!E.disponible;
    pintarCat(); pintarTallas(); pintarFotos(); pintarDisp(); hintPromo();
    ver("vEditar");
  }
  function pintarCat() { $("#fCat").innerHTML = CATS.map(c => `<button type="button" class="${E.categoria === c ? "on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join(""); $$("#fCat button").forEach(b => b.onclick = () => { E.categoria = b.dataset.c; pintarCat(); }); }
  function cantidad(v) { const x = String(v || "").trim().toUpperCase(); if (!x || x === "FALSE" || x === "0") return 0; if (x === "TRUE") return Infinity; return parseInt(x, 10) || 0; }
  function pintarTallas() {
    $("#fTallas").innerHTML = TALLAS.map(t => { const n = cantidad(E.tallas[t]); return `<div class="szc ${n ? "on" : ""}" data-t="${t}"><button type="button" class="n" data-tog>${t}</button>${n ? `<div class="q"><button type="button" data-d="-1">−</button><b>${n === Infinity ? "∞" : n}</b><button type="button" data-d="1">+</button></div>` : `<span class="no">No hay</span>`}</div>`; }).join("");
    $$("#fTallas .szc").forEach(el => el.onclick = e => {
      const t = el.dataset.t, n = cantidad(E.tallas[t]), b = e.target.closest("button");
      if (b && b.dataset.d) { const nn = n === Infinity ? (b.dataset.d > 0 ? Infinity : 9) : n + +b.dataset.d; E.tallas[t] = nn === Infinity ? "TRUE" : nn > 0 ? String(nn) : ""; }
      else E.tallas[t] = n ? "" : "1";
      pintarTallas();
    });
  }
  function pintarDisp() { const on = $("#fDisp").checked; $("#dispTxt").textContent = on ? "Disponible" : "Agotado"; $("#dispSub").textContent = on ? "Se ve en tu vitrina" : "No se mostrará en tu vitrina hasta que lo actives"; }
  $("#fDisp").onchange = pintarDisp;
  $("#fPromoOn").onchange = () => { const on = $("#fPromoOn").checked; $("#promoBox").classList.toggle("hide", !on); if (on && !$("#fDesde").value) { const h = new Date(); $("#fDesde").value = h.toISOString().slice(0, 10); } hintPromo(); };
  function hintPromo() {
    const pp = num($("#fPromo").value), pr = num($("#fPrecio").value), d = $("#fDesde").value, h = $("#fHasta").value;
    let t = "";
    if (pp && pr && pp >= pr) t = "⚠️ El precio en promo debe ser menor que el normal.";
    else if (pp && pr) t = `Tus clientes verán ${money(pp)} en vez de ${money(pr)} (−${Math.round((1 - pp / pr) * 100)}%)` + (d || h ? `${d ? " del " + deISO(d) : ""}${h ? " al " + deISO(h) : ""}.` : ".");
    $("#promoHint").textContent = t;
  }
  ["fPromo", "fPrecio", "fDesde", "fHasta"].forEach(id => $("#" + id).addEventListener("input", hintPromo));

  // fotos del producto
  let destinoFoto = null;
  function slotHTML(url, etiqueta, principal) {
    const img = url ? A.imagen(url, 500) : "";
    return { cls: img ? "has" : "", bg: img ? `url('${img.replace(/'/g, "%27")}')` : "", html: (img ? `<span class="lbl">${etiqueta}</span><button type="button" class="x" data-x aria-label="Quitar foto">×</button>` : `<span class="ic">📷</span><span class="tx">${principal ? "Foto principal" : "Segunda foto"}<small>${principal ? "La que se ve primero" : "Opcional"}</small></span>`) + `<div class="acts"><button type="button" data-src="cam">${ICON.cam}Cámara</button><button type="button" data-src="gal">${ICON.gal}Galería</button></div>` };
  }
  function pintarSlot(el, url, etiqueta, principal, onPick, onClear) {
    const s = slotHTML(url, etiqueta, principal); el.className = el.className.replace(/\bhas\b/, "").trim() + (s.cls ? " has" : ""); el.style.backgroundImage = s.bg; el.innerHTML = s.html;
    el.querySelectorAll("[data-src]").forEach(b => b.onclick = e => { e.stopPropagation(); destinoFoto = onPick; $(b.dataset.src === "cam" ? "#fileCam" : "#fileGal").click(); });
    const x = el.querySelector("[data-x]"); if (x) x.onclick = e => { e.stopPropagation(); onClear(); };
  }
  function pintarFotos() {
    [["foto", "#slot0", "Principal", true], ["foto2", "#slot1", "2ª foto", false]].forEach(([k, sel, et, pr]) =>
      pintarSlot($(sel), E._nuevas[k] || E[k], et, pr, dataUrl => { E._nuevas[k] = dataUrl; pintarFotos(); }, () => { E[k] = ""; delete E._nuevas[k]; pintarFotos(); }));
  }
  async function alElegir(ev) {
    const f = ev.target.files[0]; ev.target.value = ""; if (!f || !destinoFoto) return;
    try { const d = await A.comprimir(f); destinoFoto(d); } catch (e) { toast(e.message, true); }
  }
  $("#fileCam").onchange = alElegir; $("#fileGal").onchange = alElegir;

  $("#back").onclick = () => ver("vProductos");
  $("#fSave").onclick = () => {
    const nombre = $("#fNombre").value.trim(), precio = num($("#fPrecio").value);
    if (!nombre) { $("#fNombre").focus(); return toast("Escribe el nombre del producto", true); }
    if (!E.categoria) return toast("Elige una categoría", true);
    if (!precio) { $("#fPrecio").focus(); return toast("Escribe el precio", true); }
    if (!E.foto && !E._nuevas.foto) return toast("Agrega la foto principal", true);
    const promoOn = $("#fPromoOn").checked, pp = num($("#fPromo").value);
    if (promoOn && (!pp || pp >= precio)) return toast("El precio en promo debe ser menor que el normal", true);
    if (!TALLAS.some(t => cantidad(E.tallas[t]))) return toast("Activa al menos una talla", true);
    const btn = $("#fSave");
    ocupado(btn, "Guardando…", async () => {
      try {
        for (const k of ["foto", "foto2"]) if (E._nuevas[k]) { btn.lastChild.textContent = "Subiendo foto…"; E[k] = await A.subirFoto(E._nuevas[k], nombre.slice(0, 40) + (k === "foto2" ? " (2)" : "") + ".jpg"); }
        const p = { fila: E.fila, nombre, categoria: E.categoria, precio: String(precio), tallas: E.tallas, foto: E.foto, foto2: E.foto2, disponible: $("#fDisp").checked, descripcion: $("#fDesc").value.trim(), promo: promoOn ? String(pp) : "", desde: promoOn ? deISO($("#fDesde").value) : "", hasta: promoOn ? deISO($("#fHasta").value) : "" };
        const r = await A.guardarProducto(p), nuevo = !E.fila;
        const i = D.productos.findIndex(x => x.fila === r.fila); if (i >= 0) D.productos[i] = r; else D.productos.unshift(r);
        pintarChips(); pintarLista(); ver("vProductos");
        toast(!r.disponible ? "Guardado · está oculto (agotado)" : nuevo ? "Publicado, ya está en tu vitrina" : "Guardado, ya está en tu vitrina");
      } catch (e) { toast(e.message || "No se pudo guardar", true); }
    });
  };
  $("#fDel").onclick = () => confirmar("¿Borrar este producto?", `“${E.nombre}” se quitará de tu vitrina. Esto no se puede deshacer.`, async () => {
    try { await A.borrarProducto(E.fila); D.productos = D.productos.filter(p => p.fila !== E.fila); pintarChips(); pintarLista(); ver("vProductos"); toast("Producto borrado de tu vitrina"); }
    catch (e) { toast(e.message, true); }
  });

  /* ---------- ajustes ---------- */
  let AJ = {};
  function pintarAjustes() {
    const c = D.config; AJ = { _nuevas: {}, Logo: c.Logo || C.logo, Portada: c.Portada || "" };
    $("#aNombre").value = c.Nombre || C.tienda; $("#aWa").value = c.WhatsApp || ""; $("#aLema").value = c.Lema || ""; $("#aEnv").value = c["Envíos"] || "";
    $("#vitUrl").textContent = String(C.vitrinaUrl || "").replace(/^https?:\/\//, "");
    $("#aReset").classList.toggle("hide", !A.demo);
    $("#aFoot").textContent = A.demo ? "Vista previa: los cambios se guardan solo en este teléfono." : "Conectado a tu catálogo";
    pintarMarca();
  }
  function pintarMarca() {
    [["Logo", "#sLogo"], ["Portada", "#sPortada"]].forEach(([k, sel]) => {
      const el = $(sel), url = AJ._nuevas[k] || AJ[k], img = url ? A.imagen(url, 600) : "";
      el.classList.toggle("has", !!img); el.style.backgroundImage = img ? `url('${img}')` : "";
      el.innerHTML = img ? "" : `<span class="ic">🖼️</span>`;
      el.onclick = () => { destinoFoto = d => { AJ._nuevas[k] = d; pintarMarca(); }; $("#fileGal").click(); };
    });
  }
  $("#vitBtn").onclick = abrirVitrina;
  $("#aSave").onclick = () => {
    const wa = $("#aWa").value.replace(/\D/g, "");
    if (wa && wa.length < 10) return toast("Revisa el número de WhatsApp (con código de país)", true);
    ocupado($("#aSave"), "Guardando…", async () => {
      try {
        const cfg = { Nombre: $("#aNombre").value.trim(), WhatsApp: wa, Lema: $("#aLema").value.trim(), "Envíos": $("#aEnv").value.trim() };
        for (const k of ["Logo", "Portada"]) if (AJ._nuevas[k]) cfg[k] = await A.subirFoto(AJ._nuevas[k], k.toLowerCase() + ".jpg");
        D.config = await A.guardarConfig(cfg); marca(); pintarAjustes(); toast("Guardado, ya está en tu vitrina");
      } catch (e) { toast(e.message || "No se pudo guardar", true); }
    });
  };
  /* ---------- clave: crear (primer ingreso), cambiar, recuperar ---------- */
  let KM = "cambiar";
  const kMay = el => el.addEventListener("input", () => { const v = el.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); if (v !== el.value) el.value = v; $("#kErr").textContent = ""; });
  [$("#kN1"), $("#kN2")].forEach(kMay);
  function abrirClave(modo) {
    KM = modo; $("#kN1").value = $("#kN2").value = $("#kCod").value = ""; $("#kErr").textContent = "";
    const T = { forzar: ["Crea tu clave", "Por seguridad, cambia la clave temporal por una tuya. Mínimo 8 letras o números."],
                cambiar: ["Cambiar mi clave", "Mínimo 8 letras o números. La usarás la próxima vez que entres."],
                olvide: ["¿Olvidaste tu clave?", "Te mandamos un código al correo de la tienda para crear una nueva."] }[modo];
    $("#kT").textContent = T[0]; $("#kP").textContent = T[1];
    $("#kPaso1").classList.toggle("hide", modo !== "olvide"); $("#kCodF").classList.add("hide");
    $("#kNuevas").classList.toggle("hide", modo === "olvide"); $("#kGo").classList.toggle("hide", modo === "olvide");
    $("#kNo").classList.toggle("hide", modo === "forzar");
    $("#kCorreoTx").textContent = "Te enviamos un código de 6 números al correo de la tienda.";
    ver("vClave");
  }
  $("#olvBtn").onclick = () => abrirClave("olvide");
  $("#kNo").onclick = () => KM === "olvide" ? ver("login") : ver("vAjustes");
  $("#kEnviar").onclick = async () => {
    try {
      const r = await ocupado($("#kEnviar"), "Enviando…", () => A.olvide());
      $("#kCorreoTx").textContent = "Listo. Revisa " + (r.correo || "tu correo") + " (también en Spam). El código vence en 15 minutos.";
      $("#kCodF").classList.remove("hide"); $("#kNuevas").classList.remove("hide"); $("#kGo").classList.remove("hide");
      $("#kEnviar").textContent = "Enviar otro código"; $("#kCod").focus();
    } catch (e) { $("#kErr").textContent = e.message; }
  };
  $("#kForm").onsubmit = async e => {
    e.preventDefault();
    const n1 = $("#kN1").value.trim(), n2 = $("#kN2").value.trim();
    if (KM === "olvide" && !/^\d{6}$/.test($("#kCod").value.trim())) { $("#kErr").textContent = "Escribe el código de 6 números"; return; }
    if (n1.length < 8) { $("#kErr").textContent = "La clave debe tener al menos 8 caracteres"; return; }
    if (n1 !== n2) { $("#kErr").textContent = "Las dos claves no coinciden"; return; }
    try {
      if (KM === "olvide") {
        await ocupado($("#kGo"), "Guardando…", () => A.restablecer($("#kCod").value, n1));
        ver("login"); toast("Clave nueva guardada. Entra con tu correo y la clave nueva");
      } else {
        await ocupado($("#kGo"), "Guardando…", () => A.cambiarClave(n1));
        toast("Clave guardada. Úsala la próxima vez que entres");
        if (KM === "forzar") await iniciar(); else ver("vAjustes");
      }
    } catch (err) { $("#kErr").textContent = err.message || "No se pudo guardar"; }
  };

  $("#aSalir").onclick = () => { A.salir(); ver("login"); };
  $("#aReset").onclick = () => confirmar("¿Reiniciar la vista previa?", "Se borran los cambios de prueba y vuelve la copia original del catálogo.", async () => { A.reiniciarDemo(); await iniciar(); toast("Vista previa reiniciada"); });

  /* ---------- arranque ---------- */
  async function iniciar() {
    ver("vProductos"); $("#list").innerHTML = '<div class="skel"></div>'.repeat(5);
    try { D = await A.cargar(); marca(); pintarChips(); pintarLista(); }
    catch (e) { if (e.code === "PIN" || e.code === "BLOQ") { A.salir(); ver("login"); $("#mailIn").value = A.correo(); $("#pinErr").textContent = "Vuelve a escribir tu clave"; return; } $("#list").innerHTML = `<div class="empty">No pudimos cargar tu catálogo.<br><small>${esc(e.message)}</small></div>`; }
  }
  marca();
  $("#mailIn").value = A.correo();
  if (A.sesion()) iniciar(); else ver("login");
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});

  // ganchos para la vista previa / capturas
  window.__panel = { ver, editar: f => editar(D.productos.find(p => p.fila === f) || D.productos[0]), datos: () => D };
})();
