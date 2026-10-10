import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db/connection.js';
import * as moduloVerificacion from '../config/verificacion.js';
import { validarConfiguracionVerificacion } from '../config/verificacion.js';

// Configuración de la verificación del correo: arranque en producción, valores débiles o ausentes y esquema idempotente.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECRETO = 'un-secreto-propio-de-la-verificacion-0123456789abcdef';
const JWT_FUERTE = 'Qw3rTy9uIo1pAs5dFg7hJk2lZx4cVb6nM8qWe0rTy3uIo5pA';

const produccionValida = {
  NODE_ENV: 'production',
  EMAIL_ENABLED: 'true',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  EMAIL_FROM: 'Black Iron Barbers <no-reply@example.com>',
  EMAIL_VERIF_SECRET: SECRETO,
  JWT_SECRET: 'otro-secreto-del-login-que-es-distinto-0123456789',
};

describe('validarConfiguracionVerificacion en producción', () => {
  it('arranca si todo está bien', () => {
    expect(() => validarConfiguracionVerificacion(produccionValida)).not.toThrow();
  });

  it.each([
    ['falta EMAIL_ENABLED', { EMAIL_ENABLED: undefined }, /EMAIL_ENABLED/],
    ['EMAIL_ENABLED=false', { EMAIL_ENABLED: 'false' }, /EMAIL_ENABLED/],
    ['falta el SMTP', { SMTP_HOST: undefined }, /SMTP_HOST/],
    ['falta EMAIL_VERIF_SECRET', { EMAIL_VERIF_SECRET: undefined }, /EMAIL_VERIF_SECRET/],
    ['EMAIL_VERIF_SECRET vacío', { EMAIL_VERIF_SECRET: '' }, /EMAIL_VERIF_SECRET/],
    ['EMAIL_VERIF_SECRET débil (31 caracteres)', { EMAIL_VERIF_SECRET: 'x'.repeat(31) }, /demasiado corto/],
    ['EMAIL_VERIF_SECRET igual al JWT_SECRET', { EMAIL_VERIF_SECRET: SECRETO, JWT_SECRET: SECRETO }, /distinto de JWT_SECRET/],
    ['EMAIL_VERIF_SECRET con el valor de ejemplo de .env.example', { EMAIL_VERIF_SECRET: 'cambia-esto-por-un-secreto-aleatorio-de-al-menos-32-caracteres' }, /valor de ejemplo/],
  ])('no arranca: %s', (_, cambios, patron) => {
    const variables = { ...produccionValida, ...cambios };
    expect(() => validarConfiguracionVerificacion(variables)).toThrow(patron);
  });

  it('los mensajes de error nunca incluyen los valores configurados', () => {
    const debil = 'abc-secreto-debil';
    let mensaje = '';
    try {
      validarConfiguracionVerificacion({ ...produccionValida, EMAIL_VERIF_SECRET: debil, SMTP_USER: 'usuario-smtp', SMTP_PASS: '' });
    } catch (err) {
      mensaje = err.message;
    }
    expect(mensaje).not.toBe('');
    expect(mensaje).not.toContain(debil);
    expect(mensaje).not.toContain('usuario-smtp');
  });
});

describe('validarConfiguracionVerificacion fuera de producción', () => {
  it('exige un secreto propio de al menos 32 caracteres, pero no el SMTP', () => {
    expect(() => validarConfiguracionVerificacion({ NODE_ENV: 'development', EMAIL_VERIF_SECRET: SECRETO, JWT_SECRET: 'otro' })).not.toThrow();
    expect(() => validarConfiguracionVerificacion({ NODE_ENV: 'development' })).toThrow(/EMAIL_VERIF_SECRET/);
    expect(() => validarConfiguracionVerificacion({ EMAIL_VERIF_SECRET: 'corto' })).toThrow(/demasiado corto/);
  });

  it('REQUIRE_EMAIL_VERIFICATION ya no existe: ninguna variante apaga la verificación ni evita exigir el secreto', () => {
    expect(moduloVerificacion.verificacionRequerida).toBeUndefined();
    for (const valor of ['false', '0', 'no', 'FALSE', '']) {
      expect(() => validarConfiguracionVerificacion({ REQUIRE_EMAIL_VERIFICATION: valor })).toThrow(/EMAIL_VERIF_SECRET/);
      expect(() => validarConfiguracionVerificacion({ NODE_ENV: 'development', REQUIRE_EMAIL_VERIFICATION: valor })).toThrow(/EMAIL_VERIF_SECRET/);
    }
  });
});

describe('Arranque real del servidor (index.js)', () => {
  const arrancar = (sobrescribir) =>
    new Promise((resolve) => {
      execFile(
        process.execPath,
        ['index.js'],
        { cwd: path.resolve(__dirname, '..'), env: { ...process.env, JWT_SECRET: JWT_FUERTE, FRONTEND_URL: 'https://blackiron.example', ...sobrescribir }, timeout: 20000 },
        (error, stdout, stderr) => resolve({ codigo: error?.code ?? 0, stdout, stderr })
      );
    });

  it('en producción sin EMAIL_VERIF_SECRET sale con error claro y sin imprimir valores', async () => {
    const resultado = await arrancar({
      NODE_ENV: 'production',
      EMAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      EMAIL_FROM: 'a@example.com',
      EMAIL_VERIF_SECRET: '',
      PORT: '0',
    });
    expect(resultado.codigo).toBe(1);
    expect(resultado.stderr).toContain('EMAIL_VERIF_SECRET');
    expect(resultado.stderr).not.toContain(JWT_FUERTE);
  }, 30000);

  it.each([
    ['JWT_SECRET débil', 'changeme'],
    ['JWT_SECRET de ejemplo', 'cambia-esto-por-un-secreto-aleatorio-de-al-menos-32-caracteres'],
  ])('en producción con %s sale con error claro', async (_, jwt) => {
    const resultado = await arrancar({
      NODE_ENV: 'production',
      EMAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      EMAIL_FROM: 'a@example.com',
      EMAIL_VERIF_SECRET: SECRETO,
      JWT_SECRET: jwt,
      PORT: '0',
    });
    expect(resultado.codigo).toBe(1);
    expect(resultado.stderr).toContain('JWT_SECRET');
  }, 30000);

  it('en producción con EMAIL_ENABLED=false sale con error claro', async () => {
    const resultado = await arrancar({ NODE_ENV: 'production', EMAIL_ENABLED: 'false', EMAIL_VERIF_SECRET: SECRETO, PORT: '0' });
    expect(resultado.codigo).toBe(1);
    expect(resultado.stderr).toContain('EMAIL_ENABLED');
  }, 30000);
});

describe('Esquema de la verificación', () => {
  it('aplicar schema.sql dos veces no falla ni duplica nada', async () => {
    const schema = readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf-8');
    const contar = async () =>
      (
        await pool.query(
          `SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('verificaciones_correo', 'verificaciones_usadas')) AS tablas,
                  (SELECT COUNT(*) FROM pg_indexes WHERE tablename IN ('verificaciones_correo', 'verificaciones_usadas')) AS indices,
                  (SELECT COUNT(*) FROM pg_constraint WHERE conname = 'verificaciones_usadas_jti_key') AS restricciones`
        )
      ).rows[0];
    const antes = await contar();
    await pool.query(schema);
    await pool.query(schema);
    expect(await contar()).toEqual(antes);
    expect(Number(antes.tablas)).toBe(2);
    expect(Number(antes.restricciones)).toBe(1);
  });

  it('no existe ninguna columna que pueda guardar el código en texto plano', async () => {
    const { rows } = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'verificaciones_correo' ORDER BY ordinal_position"
    );
    expect(rows.map((fila) => fila.column_name)).toEqual(['id', 'correo', 'codigo_hash', 'intentos', 'expira_en', 'usado_en', 'invalidado_en', 'creado_en']);
  });

  it('el UNIQUE de jti rechaza un comprobante consumido dos veces', async () => {
    await pool.query("DELETE FROM verificaciones_usadas WHERE jti = 'jti-config'");
    await pool.query("INSERT INTO verificaciones_usadas (jti, correo, usado_en) VALUES ('jti-config', 'a@config.example', now())");
    await expect(pool.query("INSERT INTO verificaciones_usadas (jti, correo, usado_en) VALUES ('jti-config', 'a@config.example', now())")).rejects.toMatchObject({
      code: '23505',
      constraint: 'verificaciones_usadas_jti_key',
    });
    await pool.query("DELETE FROM verificaciones_usadas WHERE jti = 'jti-config'");
  });
});

describe('Arranque real: FRONTEND_URL en producción', () => {
  it('con http o un comodín el servidor no arranca', async () => {
    for (const FRONTEND_URL of ['http://blackiron.example', '*']) {
      const resultado = await new Promise((resolve) =>
        execFile(process.execPath, ['index.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: JWT_FUERTE, EMAIL_VERIF_SECRET: SECRETO, EMAIL_ENABLED: 'true', SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', EMAIL_FROM: 'a@example.com', FRONTEND_URL, PORT: '0' }, timeout: 20000 }, (error, _out, stderr) => resolve({ codigo: error?.code ?? 0, stderr }))
      );
      expect(resultado.codigo).toBe(1);
      expect(resultado.stderr).toContain('FRONTEND_URL');
    }
  }, 60000);
});
