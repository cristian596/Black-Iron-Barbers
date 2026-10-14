import { describe, it, expect } from 'vitest';
import {
  leerDbSsl,
  leerConfigBaseDatos,
  faltantesDeBaseDatos,
  avisoSslBaseDatos,
  describirDestino,
  enmascarar,
  esHostLocal,
  leerTrustProxy,
} from '../config/baseDatos.js';

// Configuración de la conexión a PostgreSQL (DB_SSL, DATABASE_URL) y de TRUST_PROXY: funciones puras, sin base de datos.

const SEPARADAS = { DB_USER: 'usuario_sep', DB_PASSWORD: 'clave_sep', DB_HOST: 'db_black_iron', DB_PORT: '5432', DB_NAME: 'base_sep' };
const CLAVE_URL = 'S3cr3t@/clave:url';
const URL_GESTIONADA = `postgresql://usuario_url:${encodeURIComponent(CLAVE_URL)}@ep-ejemplo-123.region.proveedor.example:6543/base_url?sslmode=require`;

describe('DB_SSL', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['  ', false],
    ['false', false],
    ['FALSE', false],
    ['true', { rejectUnauthorized: true }],
    [' True ', { rejectUnauthorized: true }],
    ['no-verify', { rejectUnauthorized: false }],
    ['NO-VERIFY', { rejectUnauthorized: false }],
  ])('%j -> %j', (valor, esperado) => {
    expect(leerDbSsl({ DB_SSL: valor })).toEqual(esperado);
  });

  it.each(['require', 'verify-full', '1', '0', 'yes', 'on', 'no_verify', 'algo-raro'])('rechaza %j con un mensaje claro', (valor) => {
    expect(() => leerDbSsl({ DB_SSL: valor })).toThrow(/DB_SSL no es válido: usa false, true, no-verify/);
  });

  it('el Pool recibe el ssl de DB_SSL y por defecto es false (igual que antes)', () => {
    expect(leerConfigBaseDatos(SEPARADAS).ssl).toBe(false);
    expect(leerConfigBaseDatos({ ...SEPARADAS, DB_SSL: 'true' }).ssl).toEqual({ rejectUnauthorized: true });
  });

  it('un DB_SSL inválido impide construir la configuración', () => {
    expect(() => leerConfigBaseDatos({ ...SEPARADAS, DB_SSL: 'raro' })).toThrow(/DB_SSL/);
    expect(() => leerConfigBaseDatos({ DATABASE_URL: URL_GESTIONADA, DB_SSL: 'raro' })).toThrow(/DB_SSL/);
  });
});

describe('DATABASE_URL y variables separadas', () => {
  it('sin DATABASE_URL usa las variables separadas', () => {
    expect(leerConfigBaseDatos(SEPARADAS)).toEqual({
      user: 'usuario_sep',
      password: 'clave_sep',
      host: 'db_black_iron',
      port: 5432,
      database: 'base_sep',
      ssl: false,
    });
  });

  it('DATABASE_URL vacía o en blanco se ignora', () => {
    expect(leerConfigBaseDatos({ ...SEPARADAS, DATABASE_URL: '' }).database).toBe('base_sep');
    expect(leerConfigBaseDatos({ ...SEPARADAS, DATABASE_URL: '   ' }).database).toBe('base_sep');
  });

  it('DATABASE_URL tiene prioridad sobre las variables separadas y decodifica la contraseña', () => {
    const config = leerConfigBaseDatos({ ...SEPARADAS, DATABASE_URL: URL_GESTIONADA });
    expect(config).toEqual({
      user: 'usuario_url',
      password: CLAVE_URL,
      host: 'ep-ejemplo-123.region.proveedor.example',
      port: 6543,
      database: 'base_url',
      ssl: false,
    });
  });

  it('el SSL lo decide solo DB_SSL, no el ?sslmode= de la URL', () => {
    expect(leerConfigBaseDatos({ DATABASE_URL: URL_GESTIONADA }).ssl).toBe(false);
    expect(leerConfigBaseDatos({ DATABASE_URL: URL_GESTIONADA, DB_SSL: 'no-verify' }).ssl).toEqual({ rejectUnauthorized: false });
  });

  it('acepta el esquema postgres://, el puerto por defecto y hosts IPv6', () => {
    expect(leerConfigBaseDatos({ DATABASE_URL: 'postgres://u:p@host.example/base' })).toMatchObject({ host: 'host.example', port: 5432, database: 'base' });
    expect(leerConfigBaseDatos({ DATABASE_URL: 'postgres://u:p@[::1]:5432/base' }).host).toBe('::1');
  });

  it('con DATABASE_URL no se exigen las DB_*; sin ella, sí', () => {
    expect(faltantesDeBaseDatos({ DATABASE_URL: URL_GESTIONADA })).toEqual([]);
    expect(faltantesDeBaseDatos({})).toEqual(['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_NAME']);
    expect(faltantesDeBaseDatos({ ...SEPARADAS, DB_HOST: undefined })).toEqual(['DB_HOST']);
  });

  it.each([
    ['sin esquema', 'ep-ejemplo.example/base'],
    ['esquema equivocado', `mysql://u:${CLAVE_URL}@host.example/base`],
    ['sin base', `postgres://u:${encodeURIComponent(CLAVE_URL)}@host.example`],
    ['sin host', 'postgres://u:p@/base'],
    ['puerto inválido', `postgres://u:${encodeURIComponent(CLAVE_URL)}@host.example:abc/base`],
    ['texto cualquiera', `no es una url ${CLAVE_URL}`],
  ])('URL inválida (%s): error claro que no reproduce la URL ni la contraseña', (_, url) => {
    let mensaje = '';
    try {
      leerConfigBaseDatos({ DATABASE_URL: url });
    } catch (err) {
      mensaje = err.message;
    }
    expect(mensaje).toMatch(/DATABASE_URL no es una URL de PostgreSQL válida/);
    expect(mensaje).not.toContain(CLAVE_URL);
    expect(mensaje).not.toContain(encodeURIComponent(CLAVE_URL));
    expect(mensaje).not.toContain('host.example');
  });
});

describe('mensajes sin filtrar secretos', () => {
  it('enmascarar deja solo los extremos', () => {
    expect(enmascarar('ep-ejemplo-123.region.proveedor.example')).toBe('ep***le');
    expect(enmascarar('abcd')).toBe('***');
    expect(enmascarar(undefined)).toBe('***');
  });

  it('describirDestino enmascara host y base, y no contiene la URL, el usuario ni la contraseña', () => {
    const texto = describirDestino(leerConfigBaseDatos({ DATABASE_URL: URL_GESTIONADA }));
    expect(texto).toBe('host ep***le, base ba***rl');
    for (const secreto of [URL_GESTIONADA, CLAVE_URL, encodeURIComponent(CLAVE_URL), 'usuario_url', 'ep-ejemplo-123', 'base_url']) {
      expect(texto).not.toContain(secreto);
    }
  });

  it('el aviso de producción no contiene la URL ni la contraseña', () => {
    const config = leerConfigBaseDatos({ DATABASE_URL: URL_GESTIONADA });
    const aviso = avisoSslBaseDatos(config, { NODE_ENV: 'production' });
    expect(aviso).toContain('DB_SSL=false');
    for (const secreto of [URL_GESTIONADA, CLAVE_URL, encodeURIComponent(CLAVE_URL), 'usuario_url', 'ep-ejemplo-123.region', 'base_url']) {
      expect(aviso).not.toContain(secreto);
    }
  });
});

describe('aviso de SSL en producción', () => {
  const remota = leerConfigBaseDatos({ ...SEPARADAS, DB_HOST: 'db.proveedor.example' });

  it('avisa en producción con DB_SSL=false y un host que no es local', () => {
    expect(avisoSslBaseDatos(remota, { NODE_ENV: 'production' })).toMatch(/no usa SSL/);
  });

  it.each(['localhost', '127.0.0.1', '::1', 'db_black_iron', 'LOCALHOST'])('no avisa si el host es local (%s)', (host) => {
    expect(esHostLocal(host)).toBe(true);
    expect(avisoSslBaseDatos({ ...remota, host }, { NODE_ENV: 'production' })).toBeNull();
  });

  it('no avisa fuera de producción', () => {
    expect(avisoSslBaseDatos(remota, { NODE_ENV: 'development' })).toBeNull();
    expect(avisoSslBaseDatos(remota, {})).toBeNull();
  });

  it('no avisa si DB_SSL es true o no-verify', () => {
    for (const DB_SSL of ['true', 'no-verify']) {
      const config = leerConfigBaseDatos({ ...SEPARADAS, DB_HOST: 'db.proveedor.example', DB_SSL });
      expect(avisoSslBaseDatos(config, { NODE_ENV: 'production' })).toBeNull();
    }
  });

  it('un host remoto no se confunde con uno local por parecido', () => {
    expect(esHostLocal('localhost.proveedor.example')).toBe(false);
    expect(esHostLocal('db_black_iron.proveedor.example')).toBe(false);
    expect(esHostLocal(undefined)).toBe(false);
  });
});

describe('TRUST_PROXY (validación)', () => {
  it.each([undefined, '', '   '])('vacío o ausente (%j) = no confiar', (valor) => {
    expect(leerTrustProxy({ TRUST_PROXY: valor })).toBeNull();
  });

  it.each([
    ['1', 1],
    [' 2 ', 2],
    ['10', 10],
  ])('%j = %i saltos exactos', (valor, saltos) => {
    expect(leerTrustProxy({ TRUST_PROXY: valor })).toBe(saltos);
  });

  it.each(['true', 'TRUE', 'false', '*', 'all', 'loopback', '10.0.0.0/8', '10.0.0.1', '::1', '1,2', '1.5', '0', '-1', '+1', '1e2', '0x1', 'uno', '99999999999999999999'])(
    'rechaza %j con un mensaje claro',
    (valor) => {
      expect(() => leerTrustProxy({ TRUST_PROXY: valor })).toThrow(/TRUST_PROXY no es válido: usa un entero ≥ 1/);
    }
  );
});
