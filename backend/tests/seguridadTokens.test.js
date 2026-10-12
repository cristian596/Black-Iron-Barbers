import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { comprobanteDe } from './verificacionPrueba.js';

// Pentest (fase 2): el token debe morir con la contraseña / la desactivación, solo vale HS256 con exp acotado y un
// comprobante de correo no es un token de login (ni al revés).
const app = crearApp();
const CLAVE = 'Clave-inicial-azul-4411';
const CLAVE_NUEVA = 'Clave-nueva-verde-9922';
const USUARIO = 'tok_barbero';

const iniciar = (usuario, contrasena) => request(app).post('/api/auth/login').send({ usuario, contrasena });
const loginAdmin = async () => (await iniciar(process.env.ADMIN_USER, process.env.ADMIN_PASSWORD)).body.token;
const sesion = (token) => request(app).get('/api/auth/sesion').set('Authorization', `Bearer ${token}`);
const idDe = async (usuario) => (await pool.query('SELECT id FROM usuarios WHERE usuario = $1', [usuario])).rows[0].id;

beforeAll(async () => {
  const hash = await bcrypt.hash(CLAVE, 10);
  await pool.query(
    `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id, contrasena_cambiada_en) VALUES ($1, $2, 'barbero', 2, now() - interval '59 days')
     ON CONFLICT (usuario) DO UPDATE SET contrasena = $2, activo = true, version_token = 0, contrasena_cambiada_en = now() - interval '59 days'`,
    [USUARIO, hash]
  );
});
afterAll(async () => {
  await pool.query('DELETE FROM usuarios WHERE usuario = $1', [USUARIO]);
});

describe('El token muere con el cambio de contraseña', () => {
  it('cambiar la propia contraseña invalida los tokens anteriores y devuelve uno nuevo que sí sirve', async () => {
    const viejo = (await iniciar(USUARIO, CLAVE)).body.token;
    expect((await sesion(viejo)).status).toBe(200);
    const cambio = await request(app).patch('/api/auth/contrasena').set('Authorization', `Bearer ${viejo}`).send({ actual: CLAVE, nueva: CLAVE_NUEVA });
    expect(cambio.status).toBe(200);
    expect((await sesion(viejo)).status).toBe(401);
    expect(typeof cambio.body.token).toBe('string');
    expect((await sesion(cambio.body.token)).status).toBe(200);
    // y el login con la clave nueva sigue funcionando
    expect((await iniciar(USUARIO, CLAVE_NUEVA)).status).toBe(200);
  });

  it('el admin que restablece la contraseña de un barbero invalida los tokens de ese barbero', async () => {
    const admin = await loginAdmin();
    const viejo = (await iniciar(USUARIO, CLAVE_NUEVA)).body.token;
    expect((await sesion(viejo)).status).toBe(200);
    const id = await idDe(USUARIO);
    const reset = await request(app).patch(`/api/admin/usuarios/${id}`).set('Authorization', `Bearer ${admin}`).send({ contrasena: CLAVE });
    expect(reset.status).toBe(200);
    expect((await sesion(viejo)).status).toBe(401);
    expect((await sesion(admin)).status).toBe(200); // el del admin no se toca
  });

  it('desactivar y reactivar al usuario NO resucita los tokens anteriores', async () => {
    const admin = await loginAdmin();
    const viejo = (await iniciar(USUARIO, CLAVE)).body.token;
    const id = await idDe(USUARIO);
    await request(app).patch(`/api/admin/usuarios/${id}`).set('Authorization', `Bearer ${admin}`).send({ activo: false });
    expect((await sesion(viejo)).status).toBe(401);
    await request(app).patch(`/api/admin/usuarios/${id}`).set('Authorization', `Bearer ${admin}`).send({ activo: true });
    expect((await sesion(viejo)).status).toBe(401);
    expect((await iniciar(USUARIO, CLAVE)).status).toBe(200);
  });

  it('desactivar al empleado (PATCH /empleados) tampoco deja tokens que revivan al reactivarlo', async () => {
    const admin = await loginAdmin();
    const viejo = (await iniciar(USUARIO, CLAVE)).body.token;
    await request(app).patch('/api/admin/empleados/2').set('Authorization', `Bearer ${admin}`).send({ activo: false });
    expect((await sesion(viejo)).status).toBe(401);
    await request(app).patch('/api/admin/empleados/2').set('Authorization', `Bearer ${admin}`).send({ activo: true });
    expect((await sesion(viejo)).status).toBe(401);
  });
});

describe('Forma del token', () => {
  const base = async () => {
    const { rows } = await pool.query('SELECT id, version_token FROM usuarios WHERE usuario = $1', [USUARIO]);
    return { id: rows[0].id, usuario: USUARIO, rol: 'barbero', barbero_id: 2, v: rows[0].version_token };
  };
  const firmado = async (opciones, cambios = {}) => jwt.sign({ ...(await base()), ...cambios }, process.env.JWT_SECRET, opciones);

  it('el control: un token HS256 con exp de 8 h sirve', async () => {
    expect((await sesion(await firmado({ expiresIn: '8h' }))).status).toBe(200);
  });

  it.each(['HS384', 'HS512'])('rechaza %s aunque esté firmado con el secreto real (algoritmo fijado a HS256)', async (algorithm) => {
    expect((await sesion(await firmado({ algorithm, expiresIn: '1h' }))).status).toBe(401);
  });

  it('rechaza un token sin exp (nunca se emite uno así)', async () => {
    expect((await sesion(await firmado({}))).status).toBe(401);
  });

  it.each([['texto', '1 OR 1=1'], ['arreglo', [1]], ['objeto', { a: 1 }], ['decimal', 1.5]])('un id %s en el payload da 401, nunca 500', async (_, id) => {
    const res = await sesion(await firmado({ expiresIn: '1h' }, { id }));
    expect(res.status).toBe(401);
  });

  it('rechaza alg none', async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const sinFirma = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...(await base()), exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
    expect((await sesion(sinFirma)).status).toBe(401);
  });
});

describe('Comprobante de correo y token de login no son intercambiables', () => {
  it('un comprobante de verificación no sirve como token de sesión', async () => {
    const comprobante = comprobanteDe('alguien@example.com');
    expect((await sesion(comprobante)).status).toBe(401);
    const admin = await request(app).get('/api/admin/estadisticas?periodo=hoy').set('Authorization', `Bearer ${comprobante}`);
    expect(admin.status).toBe(401);
  });

  it('un token de login no sirve como comprobante al reservar', async () => {
    const login = await loginAdmin();
    const res = await request(app)
      .post('/api/citas')
      .send({ cliente: 'Ana', correo: 'ana.login@example.com', telefono: '3001234567', servicios_ids: [1], barbero_id: 1, fecha: '2030-01-01', hora: '10:00', consentimiento: true, verificacion_token: login });
    expect(res.status).toBe(400);
    expect(['VERIFICACION_INVALIDA', 'VERIFICACION_EXPIRADA']).toContain(res.body.codigo);
  });
});
