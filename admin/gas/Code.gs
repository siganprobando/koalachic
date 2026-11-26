/**
 * PANEL DE LA TIENDA · Backend en Google Apps Script
 * --------------------------------------------------
 * Se pega en la hoja del cliente (Extensiones → Apps Script) y se implementa
 * como "Aplicación web". NO cambia el diseño de la hoja: usa las pestañas
 * "Productos" y "Config" tal como ya las lee la vitrina.
 *
 * Ajustes privados (PIN y carpeta de fotos). Se leen en este orden:
 *   1) Propiedades del script (Configuración del proyecto → Propiedades del script)
 *   2) Si no existen, la constante AJUSTES de abajo.
 * La API de Apps Script NO permite escribir propiedades, por eso existe AJUSTES:
 * así todo se puede subir con la API/CLI sin pasos a mano.
 * NUNCA pongas el PIN en la hoja (la pestaña Config es pública para la vitrina).
 *
 * Columnas de Productos (fila 1 = encabezados):
 *  A Nombre | B Categoría | C Precio $ | D XS | E S | F M | G L | H XL |
 *  I Foto (enlace de Drive) | J Foto 2 | K Disponible | L Descripción |
 *  M Precio promo | N Promo desde | O Promo hasta
 */

const AJUSTES = {
  ADMIN_PIN: '',                                     // ← clave del dueño (se cambia desde la app)
  ADMIN_EMAIL: '',            // ← correo que recibe el código si olvida la clave
  FOTOS_FOLDER_ID: ''
};
function ajuste(k) {
  const v = PropertiesService.getScriptProperties().getProperty(k);
  return v ? v : (AJUSTES[k] || '');
}

const HOJA_PRODUCTOS = 'Productos';
const HOJA_CONFIG = 'Config';
const TALLAS = ['XS', 'S', 'M', 'L', 'XL'];
const NCOL = 15; // A..O
const CONFIG_EDITABLE = ['Nombre', 'WhatsApp', 'Lema', 'Envíos', 'Insignia', 'Logo', 'Portada'];

/* ======================= entrada ======================= */

function doGet(e) {
  return responder(() => {
    const p = (e && e.parameter) || {};
    revisarPin(p.pin, p.correo);
    if (p.accion === 'ping') return { ok: true, cambiar: String(ajuste('ADMIN_PIN')).trim().length < MIN_CLAVE };
    if (p.accion === 'listar') return { ok: true, config: leerConfig(), productos: leerProductos() };
    throw new Error('Acción desconocida');
  });
}

function doPost(e) {
  return responder(() => {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    // Acciones SIN clave: recuperar por correo
    if (d.accion === 'olvide') return enviarCodigo();
    if (d.accion === 'restablecer') return restablecer(d.codigo, d.nueva);
    revisarPin(d.pin, d.correo);
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      switch (d.accion) {
        case 'agregar':    return { ok: true, producto: agregarProducto(d.producto) };
        case 'actualizar': return { ok: true, producto: actualizarProducto(d.producto) };
        case 'borrar':     borrarProducto(d.fila); return { ok: true };
        case 'config':     return { ok: true, config: guardarConfig(d.config || {}) };
        case 'foto':       return { ok: true, url: subirFoto(d.datos, d.nombre) };
        default: throw new Error('Acción desconocida');
      }
    } finally {
      lock.releaseLock();
    }
  });
}

function responder(fn) {
  let r;
  try { r = fn(); } catch (err) { r = { ok: false, error: err.message, code: err.code || '' }; }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

/* ======================= seguridad ======================= */
const MIN_CLAVE = 8;        // largo mínimo de una clave nueva
const MAX_FALLOS = 5;       // intentos antes de bloquear
const BLOQUEO_SEG = 900;    // 15 minutos
const cache = () => CacheService.getScriptCache();

function errorCod(msg, code) { const e = new Error(msg); e.code = code; return e; }

function revisarBloqueo(tipo) {
  if (cache().get('bloq_' + tipo)) throw errorCod('Demasiados intentos. Espera 15 minutos o usa "¿Olvidaste tu clave?"', 'BLOQ');
}
function sumarFallo(tipo) {
  const c = cache(), k = 'fallos_' + tipo, n = Number(c.get(k) || 0) + 1;
  if (n >= MAX_FALLOS) { c.put('bloq_' + tipo, '1', BLOQUEO_SEG); c.remove(k); }
  else c.put(k, String(n), BLOQUEO_SEG);
  return MAX_FALLOS - n;
}

function revisarPin(pin, correo) {
  const real = ajuste('ADMIN_PIN'), mail = String(ajuste('ADMIN_EMAIL')).trim().toLowerCase();
  if (!real) throw new Error('Falta configurar ADMIN_PIN');
  revisarBloqueo('pin');
  const okCorreo = !mail || String(correo || '').trim().toLowerCase() === mail;
  if (!okCorreo || String(pin || '').trim().toUpperCase() !== String(real).trim().toUpperCase()) {
    Utilities.sleep(800);
    const quedan = sumarFallo('pin');
    throw errorCod(quedan > 0 ? 'Correo o clave incorrectos' : 'Demasiados intentos. Espera 15 minutos o usa "¿Olvidaste tu clave?"', quedan > 0 ? 'PIN' : 'BLOQ');
  }
  cache().remove('fallos_pin');
}

function guardarClave(nueva) {
  nueva = String(nueva || '').trim().toUpperCase();
  if (!/^[A-Z0-9]+$/.test(nueva)) throw new Error('Usa solo letras y números');
  if (nueva.length < MIN_CLAVE) throw new Error('La clave debe tener al menos ' + MIN_CLAVE + ' caracteres');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', nueva);
}

function enviarCodigo() {
  const c = cache();
  revisarBloqueo('cod');
  if (c.get('cod_espera')) return { ok: true, correo: ocultar(ajuste('ADMIN_EMAIL')) }; // ya se envió uno hace poco
  const correo = ajuste('ADMIN_EMAIL');
  if (!correo) throw new Error('No hay un correo configurado para recuperar la clave');
  const cod = String(Math.floor(100000 + Math.random() * 900000));
  c.put('cod_actual', cod, BLOQUEO_SEG);
  c.put('cod_espera', '1', 60);
  const tienda = (leerConfig().Nombre || 'tu tienda');
  MailApp.sendEmail({
    to: correo,
    subject: 'Código para cambiar la clave de ' + tienda,
    body: 'Tu código es: ' + cod + '\n\nEscríbelo en el panel de ' + tienda + ' para crear una clave nueva. Vence en 15 minutos.\n\nSi no lo pediste, ignora este correo: tu clave no cambia.'
  });
  return { ok: true, correo: ocultar(correo) };
}

function restablecer(codigo, nueva) {
  const c = cache();
  revisarBloqueo('cod');
  const real = c.get('cod_actual');
  if (!real || String(codigo || '').trim() !== real) {
    Utilities.sleep(800);
    const quedan = sumarFallo('cod');
    if (quedan <= 0) c.remove('cod_actual');
    throw errorCod(real ? 'Código incorrecto' : 'El código venció. Pide uno nuevo', 'COD');
  }
  guardarClave(nueva);
  c.remove('cod_actual'); c.remove('fallos_cod'); c.remove('bloq_pin'); c.remove('fallos_pin');
  return { ok: true };
}

function ocultar(correo) {
  const m = String(correo).match(/^(.{2})[^@]*(@.*)$/);
  return m ? m[1] + '•••' + m[2] : correo;
}

/* ======================= productos ======================= */

function hoja(nombre) {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!h) throw new Error('No existe la pestaña ' + nombre);
  return h;
}

function leerProductos() {
  const h = hoja(HOJA_PRODUCTOS), n = h.getLastRow() - 1;
  if (n < 1) return [];
  const rg = h.getRange(2, 1, n, NCOL), val = rg.getValues(), txt = rg.getDisplayValues(), out = [];
  for (let i = 0; i < n; i++) {
    if (!String(val[i][0]).trim()) continue; // fila vacía (plantilla)
    out.push(aProducto(i + 2, val[i], txt[i]));
  }
  return out;
}

function aProducto(fila, v, t) {
  const tallas = {};
  TALLAS.forEach((s, k) => {
    const x = v[3 + k];
    tallas[s] = x === true ? 'TRUE' : (x === false || x === '' || x === null) ? '' : String(t[3 + k]);
  });
  return {
    fila: fila,
    nombre: String(v[0]).trim(),
    categoria: String(v[1]).trim(),
    precio: String(t[2]).replace('$', '').trim(),
    tallas: tallas,
    foto: String(v[8]).trim(),
    foto2: String(v[9]).trim(),
    disponible: v[10] === true || String(v[10]).toUpperCase() === 'TRUE',
    descripcion: String(v[11]).trim(),
    promo: String(t[12]).replace('$', '').trim(),
    desde: String(t[13]).trim(),
    hasta: String(t[14]).trim()
  };
}

function aFila(p) {
  if (!p || !String(p.nombre || '').trim()) throw new Error('Falta el nombre del producto');
  const n = v => { const x = Number(String(v == null ? '' : v).replace('$', '').replace(',', '.').trim()); return isFinite(x) && x > 0 ? x : ''; };
  const talla = v => { const x = String(v == null ? '' : v).trim().toUpperCase(); if (x === 'TRUE') return true; const k = parseInt(x, 10); return k > 0 ? k : ''; };
  const precio = n(p.precio);
  if (!precio) throw new Error('Falta el precio');
  const t = p.tallas || {};
  return [
    String(p.nombre).trim().slice(0, 120),
    String(p.categoria || '').trim(),
    precio,
    talla(t.XS), talla(t.S), talla(t.M), talla(t.L), talla(t.XL),
    String(p.foto || ''), String(p.foto2 || ''),
    p.disponible !== false,
    String(p.descripcion || '').slice(0, 300),
    n(p.promo),
    String(p.desde || ''), String(p.hasta || '')
  ];
}

function escribirFila(h, fila, valores) {
  h.getRange(fila, 14, 1, 2).setNumberFormat('@'); // fechas de promo como texto dd/mm/aaaa (como las lee la vitrina)
  h.getRange(fila, 1, 1, NCOL).setValues([valores]);
  const rg = h.getRange(fila, 1, 1, NCOL);
  return aProducto(fila, rg.getValues()[0], rg.getDisplayValues()[0]);
}

function agregarProducto(p) {
  const h = hoja(HOJA_PRODUCTOS), valores = aFila(p);
  // usa la primera fila vacía de la plantilla (mantiene casillas y formato); si no hay, agrega al final
  const ultima = Math.max(h.getLastRow(), 1);
  const nombres = ultima > 1 ? h.getRange(2, 1, ultima - 1, 1).getValues() : [];
  let fila = 0;
  for (let i = 0; i < nombres.length; i++) if (!String(nombres[i][0]).trim()) { fila = i + 2; break; }
  if (!fila) fila = ultima + 1;
  return escribirFila(h, fila, valores);
}

function actualizarProducto(p) {
  const h = hoja(HOJA_PRODUCTOS), fila = Number(p && p.fila);
  if (!(fila >= 2) || fila > h.getLastRow()) throw new Error('Ese producto ya no existe. Actualiza la lista.');
  if (!String(h.getRange(fila, 1).getValue()).trim()) throw new Error('Ese producto fue borrado. Actualiza la lista.');
  return escribirFila(h, fila, aFila(p));
}

function borrarProducto(fila) {
  const h = hoja(HOJA_PRODUCTOS); fila = Number(fila);
  if (!(fila >= 2) || fila > h.getLastRow()) throw new Error('Ese producto ya no existe');
  // se vacía la fila (no se elimina) para no mover las demás filas ni romper la plantilla
  h.getRange(fila, 1, 1, NCOL).clearContent();
  h.getRange(fila, 11).setValue(false);
}

/* ======================= config ======================= */

function leerConfig() {
  const h = hoja(HOJA_CONFIG), n = h.getLastRow(), out = {};
  if (n < 2) return out;
  h.getRange(2, 1, n - 1, 2).getDisplayValues().forEach(r => { const k = String(r[0]).trim(); if (k) out[k] = String(r[1]).trim(); });
  return out;
}

function guardarConfig(cfg) {
  const h = hoja(HOJA_CONFIG), n = Math.max(h.getLastRow(), 1);
  const claves = n > 1 ? h.getRange(2, 1, n - 1, 1).getValues().map(r => String(r[0]).trim().toLowerCase()) : [];
  Object.keys(cfg).forEach(k => {
    if (CONFIG_EDITABLE.indexOf(k) < 0) return; // solo claves permitidas
    const v = String(cfg[k] == null ? '' : cfg[k]).slice(0, 300);
    const i = claves.indexOf(k.toLowerCase());
    if (i >= 0) {
      const c = h.getRange(i + 2, 2);
      if (k === 'WhatsApp') c.setNumberFormat('@');
      c.setValue(v);
    } else { h.appendRow([k, v]); claves.push(k.toLowerCase()); }
  });
  return leerConfig();
}

/* ======================= fotos ======================= */

function subirFoto(dataUrl, nombre) {
  const id = ajuste('FOTOS_FOLDER_ID');
  if (!id) throw new Error('Falta configurar FOTOS_FOLDER_ID (propiedad o AJUSTES en Code.gs)');
  const m = String(dataUrl || '').match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!m) throw new Error('La foto no llegó bien, intenta de nuevo');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('La foto es muy pesada');
  const limpio = String(nombre || 'foto.jpg').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80);
  const archivo = DriveApp.getFolderById(id).createFile(Utilities.newBlob(bytes, m[1], limpio));
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // pública para la vitrina
  return 'https://drive.google.com/file/d/' + archivo.getId() + '/view';
}

/* Ejecuta esta función UNA vez desde el editor para autorizar permisos (Hoja + Drive). */
function autorizar() {
  leerConfig();
  const id = ajuste('FOTOS_FOLDER_ID');
  if (id) DriveApp.getFolderById(id).getName();
  MailApp.getRemainingDailyQuota(); // permiso para enviar el código por correo
}
