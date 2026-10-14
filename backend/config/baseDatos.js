// Configuración de la conexión a PostgreSQL: variables separadas (DB_*) o DATABASE_URL, más DB_SSL.
// Funciones puras que reciben las variables (por defecto process.env): se pueden probar sin base de datos.
// La contraseña vive en DB_PASSWORD y dentro de DATABASE_URL: ningún mensaje de este módulo incluye valores, ni la URL;
// solo se nombra el host y la base ENMASCARADOS (`describirDestino`).

const MODOS_SSL = ['false', 'true', 'no-verify'];

// Hosts donde no tiene sentido exigir SSL: la propia máquina y el nombre del servicio de la base en docker-compose.
const HOSTS_LOCALES = ['localhost', '127.0.0.1', '::1', 'db_black_iron'];

// DB_SSL: vacío o ausente = false (igual que antes). Cualquier otro valor fuera de la lista impide arrancar.
//  - false: sin SSL · true: SSL verificando el certificado · no-verify: SSL sin verificar el certificado.
export const leerDbSsl = (variables = process.env) => {
  const crudo = String(variables.DB_SSL ?? '').trim().toLowerCase();
  if (crudo === '') return false;
  if (!MODOS_SSL.includes(crudo)) {
    throw new Error(`DB_SSL no es válido: usa ${MODOS_SSL.join(', ')} o déjalo vacío (equivale a false).`);
  }
  if (crudo === 'false') return false;
  return { rejectUnauthorized: crudo === 'true' };
};

// Convierte una DATABASE_URL en las mismas piezas que las variables separadas. No se pasa tal cual a `pg` (connectionString)
// porque sus parámetros (p. ej. ?sslmode=) pisarían a DB_SSL: el SSL lo decide solo DB_SSL. El error nunca cita la URL.
const leerDatabaseUrl = (url) => {
  const mensaje = 'DATABASE_URL no es una URL de PostgreSQL válida (esperado: postgres://usuario:contraseña@host:puerto/base).';
  let parseada;
  try {
    parseada = new URL(url);
  } catch {
    throw new Error(mensaje);
  }
  if (!['postgres:', 'postgresql:'].includes(parseada.protocol) || !parseada.hostname || parseada.pathname.length <= 1) {
    throw new Error(mensaje);
  }
  try {
    const puerto = parseada.port === '' ? 5432 : Number(parseada.port);
    return {
      user: decodeURIComponent(parseada.username),
      password: decodeURIComponent(parseada.password),
      host: parseada.hostname.replace(/^\[|\]$/g, ''),
      port: puerto,
      database: decodeURIComponent(parseada.pathname.slice(1)),
    };
  } catch {
    throw new Error(mensaje);
  }
};

const REQUERIDAS_SEPARADAS = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_NAME'];

// Variables DB_* que faltan. Con DATABASE_URL no se exige ninguna.
export const faltantesDeBaseDatos = (variables = process.env) => {
  if (String(variables.DATABASE_URL ?? '').trim() !== '') return [];
  return REQUERIDAS_SEPARADAS.filter((clave) => !variables[clave]);
};

// Devuelve { user, password, host, port, database, ssl } listo para `new Pool(...)`.
// DATABASE_URL (si no está vacía) tiene prioridad sobre las variables separadas.
export const leerConfigBaseDatos = (variables = process.env) => {
  const ssl = leerDbSsl(variables);
  const url = String(variables.DATABASE_URL ?? '').trim();
  if (url !== '') return { ...leerDatabaseUrl(url), ssl };
  return {
    user: variables.DB_USER,
    password: variables.DB_PASSWORD,
    host: variables.DB_HOST,
    port: Number(variables.DB_PORT),
    database: variables.DB_NAME,
    ssl,
  };
};

// "ab***yz": suficiente para reconocer el destino en un log sin publicarlo entero.
export const enmascarar = (texto) => {
  const valor = String(texto ?? '');
  if (valor.length <= 4) return '***';
  return `${valor.slice(0, 2)}***${valor.slice(-2)}`;
};

export const describirDestino = (config) => `host ${enmascarar(config.host)}, base ${enmascarar(config.database)}`;

export const esHostLocal = (host) => HOSTS_LOCALES.includes(String(host ?? '').trim().toLowerCase());

// Texto de aviso (o null) para el arranque: en producción, hablar con un host que no es local sin SSL.
// No bloquea: hay despliegues con red privada donde es correcto.
export const avisoSslBaseDatos = (config, variables = process.env) => {
  if (variables.NODE_ENV !== 'production' || config.ssl || esHostLocal(config.host)) return null;
  return (
    `La conexión a PostgreSQL (${describirDestino(config)}) no usa SSL (DB_SSL=false) en producción. ` +
    'Las bases gestionadas lo exigen: usa DB_SSL=true (o no-verify si el proveedor usa su propia CA). ' +
    'Solo es aceptable dentro de una red privada.'
  );
};

// TRUST_PROXY: vacío o ausente = no confiar en ningún proxy (igual que antes; req.ip es la IP del socket).
// Un entero ≥ 1 = número EXACTO de proxies delante del servidor. No se admite nada más: true, *, all, rangos o IPs
// permitirían a un cliente falsear X-Forwarded-For y esquivar los límites por IP.
export const leerTrustProxy = (variables = process.env) => {
  const crudo = String(variables.TRUST_PROXY ?? '').trim();
  if (crudo === '') return null;
  const saltos = /^\d+$/.test(crudo) ? Number(crudo) : NaN;
  if (!Number.isSafeInteger(saltos) || saltos < 1) {
    throw new Error(
      'TRUST_PROXY no es válido: usa un entero ≥ 1 (número exacto de proxies delante del servidor) o déjalo vacío. ' +
      'No se admiten true, *, all, rangos de IP ni otros valores.'
    );
  }
  return saltos;
};
