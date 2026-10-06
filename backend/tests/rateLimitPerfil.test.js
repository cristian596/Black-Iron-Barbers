import { describe, it, expect, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pool } from '../db/connection.js';

// El limitador se omite bajo NODE_ENV=test salvo que se fuerce (ver routes/perfil.js).
process.env.FORZAR_RATE_LIMIT_PRUEBA = 'true';
const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'perfil-rl-'));
process.env.UPLOADS_DIR = CARPETA;

const { crearApp } = await import('../app.js');
const app = crearApp();

const CLAVE = 'clave-segura-1';

afterAll(async () => {
  await pool.query("DELETE FROM usuarios WHERE usuario LIKE 'prueba_rlfoto%'");
  fs.rmSync(CARPETA, { recursive: true, force: true });
});

const sesion = async (usuario) => {
  await pool.query(`INSERT INTO usuarios (usuario, contrasena, rol, barbero_id) VALUES ($1, $2, 'barbero', 2)`, [usuario, await bcrypt.hash(CLAVE, 10)]);
  return (await request(app).post('/api/auth/login').send({ usuario, contrasena: CLAVE })).body.token;
};
const subir = (token, cuerpo) => request(app).post('/api/perfil/foto').set('Authorization', `Bearer ${token}`).set('Content-Type', 'image/png').send(cuerpo);

describe('Limitador de POST /api/perfil/foto', () => {
  it('la subida 11 en 15 min responde 429, cuenta por usuario y no afecta a otro', async () => {
    const token = await sesion('prueba_rlfoto1');
    const otro = await sesion('prueba_rlfoto2');

    for (let i = 0; i < 10; i += 1) {
      expect((await subir(token, Buffer.from('no es una imagen'))).status).toBe(415);
    }
    const bloqueado = await subir(token, Buffer.from('no es una imagen'));
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.codigo).toBe('DEMASIADOS_INTENTOS');

    expect((await subir(otro, Buffer.from('no es una imagen'))).status).toBe(415); // sigue su propio cupo
    // otras rutas del perfil no gastan este cupo
    expect((await request(app).get('/api/perfil').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });
});
