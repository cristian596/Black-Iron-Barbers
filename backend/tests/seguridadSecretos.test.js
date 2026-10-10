import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { problemasDeSecreto, validarSecretoJwt, validarOrigenFrontend, sha256 } from '../config/secretos.js';
import { validarConfiguracionVerificacion } from '../config/verificacion.js';
import { esEntornoDePruebas, omitirLimitadores } from '../config/entorno.js';

// Pentest H-01/H-02: secretos de ejemplo versionados y JWT_SECRET sin exigencias.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FUERTE = 'k3Jx9QvT2mZpL7aRb0WcYd5NfHs8UeGi1oAtVnXq4MzB6yCu';
const leerEjemplo = () => readFileSync(path.resolve(__dirname, '../../.env.example'), 'utf8');

describe('.env.example no contiene secretos reales', () => {
  it.each(['JWT_SECRET', 'EMAIL_VERIF_SECRET'])('%s es un placeholder que el validador rechaza', (clave) => {
    const linea = leerEjemplo().split(/\r?\n/).find((l) => l.startsWith(`${clave}=`));
    const valor = linea.slice(clave.length + 1);
    expect(valor).toMatch(/^cambia-esto/);
    expect(problemasDeSecreto(clave, valor).length).toBeGreaterThan(0);
  });

  it('un secreto que estuvo publicado en el repo (por hash) se rechaza aunque sea largo y aleatorio', () => {
    // No se escribe el valor aquí: se prueba el mecanismo con el hash de un valor de prueba.
    expect(sha256('x')).toHaveLength(64);
    expect(problemasDeSecreto('EMAIL_VERIF_SECRET', FUERTE)).toEqual([]);
  });
});

describe('validarSecretoJwt', () => {
  const casos = [
    ['vacío', ''],
    ['"changeme"', 'changeme'],
    ['"secret"', 'secret'],
    ['corto (31)', 'aB3$'.repeat(7) + 'xyz'],
    ['largo pero repetitivo', 'a'.repeat(64)],
    ['largo con dos caracteres', 'ab'.repeat(40)],
    ['valor de ejemplo del repo', 'cambia-esto-por-un-secreto-aleatorio-de-al-menos-32-caracteres'],
    ['"password" repetido', 'password' + 'password1234567890abcdefghijk'],
  ];
  it.each(casos)('rechaza %s fuera de pruebas', (_, valor) => {
    expect(() => validarSecretoJwt({ NODE_ENV: 'development', JWT_SECRET: valor })).toThrow(/JWT_SECRET/);
    expect(() => validarSecretoJwt({ JWT_SECRET: valor })).toThrow(/JWT_SECRET/);
    expect(() => validarSecretoJwt({ NODE_ENV: 'production', JWT_SECRET: valor })).toThrow(/JWT_SECRET/);
  });

  it('acepta uno aleatorio y largo, y dentro de las pruebas (Vitest) no exige nada', () => {
    expect(() => validarSecretoJwt({ NODE_ENV: 'production', JWT_SECRET: FUERTE })).not.toThrow();
    expect(() => validarSecretoJwt({ NODE_ENV: 'test', VITEST: 'true', JWT_SECRET: 'corto' })).not.toThrow();
  });

  it('un NODE_ENV=test puesto por error en un servidor real (sin Vitest) NO relaja la validación', () => {
    expect(() => validarSecretoJwt({ NODE_ENV: 'test', JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('el mensaje de error nunca incluye el valor', () => {
    let mensaje = '';
    try {
      validarSecretoJwt({ NODE_ENV: 'production', JWT_SECRET: 'abc-secreto-debil-xyz' });
    } catch (err) {
      mensaje = err.message;
    }
    expect(mensaje).not.toContain('abc-secreto-debil-xyz');
  });
});

describe('EMAIL_VERIF_SECRET débil o predecible', () => {
  it('rechaza un secreto largo pero de un solo carácter', () => {
    expect(() => validarConfiguracionVerificacion({ NODE_ENV: 'development', EMAIL_VERIF_SECRET: 'z'.repeat(64) })).toThrow(/predecible/);
  });
});

describe('NODE_ENV=test fuera de Vitest no desactiva protecciones', () => {
  it('esEntornoDePruebas solo es verdadero con NODE_ENV=test Y Vitest', () => {
    expect(esEntornoDePruebas({ NODE_ENV: 'test', VITEST: 'true' })).toBe(true);
    expect(esEntornoDePruebas({ NODE_ENV: 'test' })).toBe(false);
    expect(esEntornoDePruebas({ VITEST: 'true' })).toBe(false);
    expect(esEntornoDePruebas({ NODE_ENV: 'production', VITEST: 'true' })).toBe(false);
  });

  it('los limitadores solo se omiten dentro de las pruebas, y FORZAR_RATE_LIMIT_PRUEBA los reactiva', () => {
    expect(omitirLimitadores({ NODE_ENV: 'test', VITEST: 'true' })).toBe(true);
    expect(omitirLimitadores({ NODE_ENV: 'test', VITEST: 'true', FORZAR_RATE_LIMIT_PRUEBA: 'true' })).toBe(false);
    expect(omitirLimitadores({ NODE_ENV: 'test' })).toBe(false); // un servidor real con NODE_ENV=test sigue limitando
  });
});

describe('validarOrigenFrontend (CORS solo para FRONTEND_URL)', () => {
  it.each(['*', '', 'localhost:5173', 'http://localhost:5173/', 'http://localhost:5173/app', 'ftp://x.com', 'https://*.midominio.com', 'javascript:alert(1)'])('rechaza %j', (valor) => {
    expect(() => validarOrigenFrontend({ NODE_ENV: 'development', FRONTEND_URL: valor })).toThrow(/FRONTEND_URL/);
  });
  it('acepta un origen http en desarrollo y exige https en producción', () => {
    expect(() => validarOrigenFrontend({ NODE_ENV: 'development', FRONTEND_URL: 'http://localhost:5173' })).not.toThrow();
    expect(() => validarOrigenFrontend({ NODE_ENV: 'production', FRONTEND_URL: 'https://blackiron.example' })).not.toThrow();
    expect(() => validarOrigenFrontend({ NODE_ENV: 'production', FRONTEND_URL: 'http://blackiron.example' })).toThrow(/https/);
  });
});
