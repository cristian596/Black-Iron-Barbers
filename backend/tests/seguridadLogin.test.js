import { describe, it, expect, vi, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { crearApp } from '../app.js';

// Pentest (fase 1): enumeración por tiempos, entradas anómalas y errores que filtraban mensajes internos.
const app = crearApp();
const login = (cuerpo) => request(app).post('/api/auth/login').send(cuerpo);

afterEach(() => vi.restoreAllMocks());

describe('Login: indistinguible para usuario inexistente, inactivo o con contraseña mala', () => {
  it('usuario inexistente: se hace igualmente una comparación bcrypt (mismo coste que uno real)', async () => {
    const espia = vi.spyOn(bcrypt, 'compare');
    const res = await login({ usuario: 'no_existe_nunca', contrasena: 'cualquiera-123' });
    expect(res.status).toBe(401);
    expect(espia).toHaveBeenCalledTimes(1);
  });

  it('usuario inactivo (aunque la contraseña sea correcta): comparación bcrypt y mismo 401 genérico', async () => {
    const espia = vi.spyOn(bcrypt, 'compare');
    const res = await login({ usuario: 'barbero_inactivo', contrasena: 'barbero12345' });
    expect(espia).toHaveBeenCalledTimes(1);
    const inexistente = await login({ usuario: 'no_existe_nunca', contrasena: 'barbero12345' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(inexistente.body);
  });

  it('las tres respuestas de fallo tienen el mismo código y el mismo cuerpo', async () => {
    const malaClave = await login({ usuario: 'barbero1_test', contrasena: 'incorrecta-123' });
    const inexistente = await login({ usuario: 'no_existe_nunca', contrasena: 'incorrecta-123' });
    const inactivo = await login({ usuario: 'barbero_inactivo', contrasena: 'incorrecta-123' });
    expect([malaClave.status, inexistente.status, inactivo.status]).toEqual([401, 401, 401]);
    expect(inexistente.body).toEqual(malaClave.body);
    expect(inactivo.body).toEqual(malaClave.body);
  });
});

describe('Login: entradas anómalas nunca dan 500 ni filtran mensajes internos', () => {
  const casos = [
    ['byte nulo en el usuario', { usuario: 'barbero1_test\u0000', contrasena: 'x' }],
    ['byte nulo en la contraseña', { usuario: 'barbero1_test', contrasena: 'x\u0000y' }],
    ['contraseña objeto', { usuario: 'barbero1_test', contrasena: { $ne: 1 } }],
    ['contraseña arreglo', { usuario: 'barbero1_test', contrasena: ['barbero12345'] }],
    ['contraseña número', { usuario: 'barbero1_test', contrasena: 12345678 }],
    ['contraseña booleano', { usuario: 'barbero1_test', contrasena: true }],
    ['usuario objeto', { usuario: { a: 1 }, contrasena: 'x' }],
    ['usuario arreglo', { usuario: ['barbero1_test'], contrasena: 'x' }],
    ['usuario número', { usuario: 1, contrasena: 'x' }],
  ];
  it.each(casos)('%s → 4xx con mensaje genérico', async (_, cuerpo) => {
    const res = await login(cuerpo);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(JSON.stringify(res.body)).not.toMatch(/Illegal|invalid byte|UTF8|destructure|undefined/i);
  });

  it('sin cuerpo, texto plano o form-urlencoded → 400 sin filtrar el TypeError', async () => {
    const sinCuerpo = await request(app).post('/api/auth/login');
    const plano = await request(app).post('/api/auth/login').set('Content-Type', 'text/plain').send('usuario=a');
    const form = await request(app).post('/api/auth/login').type('form').send({ usuario: 'barbero1_test', contrasena: 'barbero12345' });
    for (const res of [sinCuerpo, plano, form]) {
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).not.toMatch(/destructure|undefined|TypeError/i);
    }
  });

  it('JSON malformado → 400 genérico (sin la posición del error del parser)', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error).not.toMatch(/position|column|Expected/i);
  });

  it('el cuerpo demasiado grande → 413 genérico', async () => {
    const res = await login({ usuario: 'a'.repeat(300_000), contrasena: 'x' });
    expect(res.status).toBe(413);
    expect(res.body.error).not.toMatch(/entity/i);
  });
});
