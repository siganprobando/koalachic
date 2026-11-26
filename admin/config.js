/* ============================================================
   PANEL DE KOALA CHIC · CONFIGURACIÓN
   Este archivo es público: NUNCA pongas aquí la clave real.
   La clave real vive solo en el Apps Script (propiedad ADMIN_PIN).
   ============================================================ */
window.PANEL_CONFIG = {
  tienda: "Koala Chic",
  // URL de la implementación de Apps Script (termina en /exec).
  // Vacía ("") = MODO DEMO con una copia de solo lectura del catálogo.
  apiUrl: "https://script.google.com/macros/s/AKfycbzMi62iPakpi3cCTpWeisBi-ScVfeeN1AxgT5B4eOBwwbQC4wJLJMV_Rz5E6gI0Q4YDXA/exec",
  // Clave SOLO para el modo demo (apiUrl vacía). En modo real no se usa.
  pin: "12345678",
  vitrinaUrl: "https://siganprobando.github.io/koalachic/",
  categorias: ["Chaquetas", "Bodies", "Blusas", "Suéteres Tejidos", "Temporada"],
  tallas: ["XS", "S", "M", "L", "XL"],
  moneda: "$",
  logo: "assets/logo.png"
};
