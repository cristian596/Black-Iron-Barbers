import { describe, it, expect, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { pool } from '../db/connection.js';

// El limitador se omite bajo NODE_ENV=test salvo que se fuerce (ver routes/auth.js).
process.env.FORZAR_RATE_LIMIT_PRUEBA = 'true';

const { crearApp } = await import('../app.js');
const app = crearApp();

const CLAVE = 'clave-segura-1';

afterAll(async () => {
  await pool.query("DELETE FROM usuarios WHERE usuario LIKE 'prueba_rl%'");
});

const sesion = async (usuario) => {
  await pool.query(
    `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id, contrasena_cambiada_en) VALUES ($1, $2, 'barbero', 1, $3)`,
    [usuario, await bcrypt.hash(CLAVE, 10), new Date(Date.now() - 59 * 24 * 60 * 60 * 1000)] // por vencer: puede cambiarla
  );
  return (await request(app).post('/api/auth/login').send({ usuario, contrasena: CLAVE })).body.token;
};
const cambiar = (token, cuerpo) => request(app).patch('/api/auth/contrasena').set('Authorization', `Bearer ${token}`).send(cuerpo);

describe('Limitador de PATCH /api/auth/contrasena', () => {
  it('tras 5 intentos fallidos responde 429, y no afecta a otro usuario', async () => {
    const token = await sesion('prueba_rl1');
    const otro = await sesion('prueba_rl2');

    for (let i = 0; i < 5; i += 1) {
      const res = await cambiar(token, { actual: 'incorrecta-123', nueva: 'nueva-clave-99' });
      expect(res.body.codigo).toBe('CONTRASENA_ACTUAL_INCORRECTA');
    }
    const bloqueado = await cambiar(token, { actual: CLAVE, nueva: 'nueva-clave-99' });
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.codigo).toBe('DEMASIADOS_INTENTOS');

    expect((await cambiar(otro, { actual: CLAVE, nueva: 'nueva-clave-99' })).status).toBe(200);
  });

  it('los cambios correctos no gastan cupo', async () => {
    const token = await sesion('prueba_rl3');
    const cambio = await cambiar(token, { actual: CLAVE, nueva: 'nueva-clave-99' });
    expect(cambio.status).toBe(200);
    // MODIFICADO: el cambio revoca el token anterior; se sigue con el que devuelve.
    const vigente = cambio.body.token;
    // Ya vigente: los 403 por ventana tampoco consumen más de lo permitido antes del 429 (cuentan como fallo, 5 máx.).
    for (let i = 0; i < 5; i += 1) expect((await cambiar(vigente, { actual: 'x', nueva: 'y' })).status).toBe(403);
    expect((await cambiar(vigente, { actual: 'x', nueva: 'y' })).status).toBe(429);
  });
});
