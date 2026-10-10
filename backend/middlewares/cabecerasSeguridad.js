// Cabeceras de seguridad de la API (sin dependencias). La API solo sirve JSON (y las fotos de perfil, que fijan su propia
// política en perfilController.servirFoto): ningún recurso necesita scripts, estilos ni marcos.
//  · nosniff: el navegador no adivina tipos.   · X-Frame-Options / frame-ancestors: la API no se enmarca.
//  · Referrer-Policy: no se filtra la URL.     · Cache-Control: no-store en lo privado (sesión, paneles, citas, perfil).
//  · HSTS solo en producción (detrás de TLS; sobre HTTP los navegadores lo ignoran).
// No se fija Cross-Origin-Resource-Policy: las fotos de perfil se cargan con <img> desde el origen del front.
const PREFIJOS_PRIVADOS = ['/api/auth', '/api/admin', '/api/barbero', '/api/citas', '/api/perfil', '/api/verificacion-correo', '/api/asesorias'];

export const cabecerasSeguridad = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  const esFoto = req.path.startsWith('/api/perfil/foto/');
  if (!esFoto && PREFIJOS_PRIVADOS.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
};
