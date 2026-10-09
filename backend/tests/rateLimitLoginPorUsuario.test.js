import { describe, it, expect, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { pool } from '../db/connection.js';

// Límites bajos y limitador forzado (bajo NODE_ENV=test se omite), antes de importar la app. Mismo patrón que
// rateLimitAsesoriaGratis.test.js.
process.env.FORZAR_RATE_LIMIT_PRUEBA = 'true';
process.env.LIMITE_LOGIN_USUARIO_RATE = '3';
process.env.LIMITE_LOGIN_IP_RATE = '6';

const { crearApp } = await import('../app.js');
const app = crearApp();
// Solo en la app de la prueba: permite simular IPs distintas con X-Forwarded-For (la app real no cambia trust proxy).
app.set('trust proxy', true);

const CLAVE = 'clave-segura-1';
const MALA = 'incorrecta-123';

afterAll(async () => {
  await pool.query("DELETE FROM usuarios WHERE usuario LIKE 'prueba_ll%'");
});

const crearUsuario = (usuario) =>
  bcrypt.hash(CLAVE, 4).then((hash) =>
    pool.query(`INSERT INTO usuarios (usuario, contrasena, rol, barbero_id) VALUES ($1, $2, 'barbero', 1)`, [usuario, hash])
  );

const login = (usuario, contrasena, ip) => {
  const peticion = request(app).post('/api/auth/login');
  if (ip) peticion.set('X-Forwarded-For', ip);
  return peticion.send({ usuario, contrasena });
};

const fallar = async (usuario, veces, ip) => {
  const estados = [];
  for (let i = 0; i < veces; i += 1) estados.push((await login(usuario, MALA, ip)).status);
  return estados;
};

describe('Límite de login por IP + usuario (solo fallos) y tope por IP', () => {
  it('bloquea al usuario A tras 3 fallos, pero B entra desde la MISMA IP', async () => {
    await crearUsuario('prueba_ll_a1');
    await crearUsuario('prueba_ll_b1');
    expect(await fallar('prueba_ll_a1', 3, '10.0.0.1')).toEqual([401, 401, 401]);
    expect((await login('prueba_ll_a1', CLAVE, '10.0.0.1')).status).toBe(429);
    const b = await login('prueba_ll_b1', CLAVE, '10.0.0.1');
    expect(b.status).toBe(200);
    expect(b.body.token).toBeDefined();
  });

  it('un login exitoso no cuenta para el bloqueo', async () => {
    await crearUsuario('prueba_ll_ok');
    // 3 correctos + 3 fallos: si los correctos contaran, los fallos ya darían 429.
    for (let i = 0; i < 3; i += 1) expect((await login('prueba_ll_ok', CLAVE, '10.0.0.2')).status).toBe(200);
    expect(await fallar('prueba_ll_ok', 3, '10.0.0.2')).toEqual([401, 401, 401]);
    expect((await login('prueba_ll_ok', MALA, '10.0.0.2')).status).toBe(429);
  });

  it('mayúsculas y espacios distintos cuentan como el mismo usuario', async () => {
    await crearUsuario('prueba_ll_norm');
    const variantes = ['prueba_ll_norm', '  PRUEBA_LL_NORM', 'Prueba_Ll_Norm  '];
    for (const v of variantes) expect((await login(v, MALA, '10.0.0.3')).status).toBe(401);
    expect((await login(' prueba_LL_norm ', CLAVE, '10.0.0.3')).status).toBe(429);
  });

  it('el mismo usuario desde otra IP no queda bloqueado por la primera', async () => {
    await crearUsuario('prueba_ll_ip');
    await fallar('prueba_ll_ip', 3, '10.0.0.4');
    expect((await login('prueba_ll_ip', CLAVE, '10.0.0.4')).status).toBe(429);
    expect((await login('prueba_ll_ip', CLAVE, '10.0.0.5')).status).toBe(200);
  });

  it('tope por IP: fallos repartidos en muchos usuarios llegan al límite general (6) y devuelven 429', async () => {
    const estados = [];
    for (let i = 0; i < 8; i += 1) estados.push((await login(`prueba_ll_inexistente_${i}`, MALA, '10.0.0.6')).status);
    expect(estados).toEqual([401, 401, 401, 401, 401, 401, 429, 429]);
    // Con un usuario válido desde esa misma IP también se bloquea; desde otra IP no.
    expect((await login('prueba_ll_a1', CLAVE, '10.0.0.6')).status).toBe(429);
    expect((await login('prueba_ll_b1', CLAVE, '10.0.0.7')).status).toBe(200);
  });

  it('sin usuario o con usuario que no es texto: queda limitado por IP, sin romperse', async () => {
    const cuerpos = [{}, { usuario: 123, contrasena: 'x' }, { usuario: null }, { contrasena: 'x' }];
    const estados = [];
    for (const cuerpo of cuerpos) {
      estados.push((await request(app).post('/api/auth/login').set('X-Forwarded-For', '10.0.0.8').send(cuerpo)).status);
    }
    // 3 fallos (400 o 401 según el controlador) comparten la clave fija y el 4.º queda bloqueado.
    expect(estados.slice(0, 3).every((e) => e === 400 || e === 401)).toBe(true);
    expect(estados[3]).toBe(429);
  });

  it('el 429 mantiene el formato de siempre (mensaje, codigo y reintentar_en_seg) y no revela si el usuario existe', async () => {
    await fallar('prueba_ll_fmt_no_existe', 3, '10.0.0.9');
    const inexistente = await login('prueba_ll_fmt_no_existe', MALA, '10.0.0.9');
    await crearUsuario('prueba_ll_fmt');
    await fallar('prueba_ll_fmt', 3, '10.0.0.10');
    const existente = await login('prueba_ll_fmt', MALA, '10.0.0.10');

    for (const res of [inexistente, existente]) {
      expect(res.status).toBe(429);
      expect(res.body.codigo).toBe('DEMASIADOS_INTENTOS');
      expect(res.body.error).toBe('Demasiados intentos de inicio de sesión, intenta más tarde');
      expect(Number.isInteger(res.body.reintentar_en_seg)).toBe(true);
      expect(res.body.reintentar_en_seg).toBeGreaterThan(890);
      expect(res.body.reintentar_en_seg).toBeLessThanOrEqual(900);
      expect(res.headers['retry-after']).toBeDefined();
    }
    expect(Object.keys(existente.body).sort()).toEqual(Object.keys(inexistente.body).sort());
  });
});
