import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { crearApp } from '../app.js';

const app = crearApp();

describe('POST /api/auth/login', () => {
  it('incluye el nombre de usuario en el token y en la respuesta (el panel lo muestra)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: process.env.ADMIN_USER, contrasena: process.env.ADMIN_PASSWORD });

    expect(res.body.usuario.usuario).toBe(process.env.ADMIN_USER);
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload).toMatchObject({ usuario: process.env.ADMIN_USER, rol: 'admin', barbero_id: null });
    expect(payload.contrasena).toBeUndefined();
  });

  it('el token de un barbero lleva su usuario y su barbero_id', async () => {
    const res = await request(app).post('/api/auth/login').send({ usuario: 'barbero1_test', contrasena: 'barbero12345' });

    expect(jwt.verify(res.body.token, process.env.JWT_SECRET)).toMatchObject({
      usuario: 'barbero1_test',
      rol: 'barbero',
      barbero_id: 1,
    });
  });

  it('devuelve un token con un usuario y contraseña correctos', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: process.env.ADMIN_USER, contrasena: process.env.ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario.rol).toBe('admin');
    expect(res.body.usuario.contrasena).toBeUndefined();
  });

  it('rechaza una contraseña incorrecta', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: process.env.ADMIN_USER, contrasena: 'contrasena-equivocada' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('rechaza un usuario que no existe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'no-existe', contrasena: 'cualquiera123' });

    expect(res.status).toBe(401);
  });

  it('rechaza un usuario desactivado aunque la contraseña sea correcta', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'barbero_inactivo', contrasena: 'barbero12345' });

    expect(res.status).toBe(401);
  });
});

describe('Rutas protegidas con JWT', () => {
  it('rechaza la peticion si no se envia token', async () => {
    const res = await request(app).get('/api/citas');
    expect(res.status).toBe(401);
  });

  it('rechaza la peticion si el token es invalido', async () => {
    const res = await request(app).get('/api/citas').set('Authorization', 'Bearer token-invalido');
    expect(res.status).toBe(401);
  });
});
