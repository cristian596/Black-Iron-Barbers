import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { estadoContrasena, VIGENCIA_DIAS, AVISO_DIAS } from '../utils/contrasenas.js';
import { NOCHE_BOGOTA } from './utilsPrueba.js';

const app = crearApp();
const DIA_MS = 24 * 60 * 60 * 1000;
const CLAVE = 'clave-segura-1';
const CLAVE_NUEVA = 'otra-clave-nueva-2';

let barberoId;

const login = (usuario, contrasena = CLAVE) => request(app).post('/api/auth/login').send({ usuario, contrasena });
const conToken = (token) => ({ Authorization: `Bearer ${token}` });
const cambiar = (token, cuerpo) => request(app).patch('/api/auth/contrasena').set(conToken(token)).send(cuerpo);

// Deja la contraseña del usuario con `dias` días de antigüedad respecto del reloj simulado.
const envejecer = (usuario, dias) =>
  pool.query('UPDATE usuarios SET contrasena_cambiada_en = $1 WHERE usuario = $2', [new Date(Date.now() - dias * DIA_MS), usuario]);

const crearUsuarioPrueba = async (usuario, barbero = barberoId) => {
  await pool.query(
    `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id) VALUES ($1, $2, 'barbero', $3)
     ON CONFLICT (usuario) DO UPDATE SET contrasena = EXCLUDED.contrasena, activo = true`,
    [usuario, await bcrypt.hash(CLAVE, 10), barbero]
  );
};

beforeAll(async () => {
  barberoId = 1;
  await crearUsuarioPrueba('prueba_cad');
  // globalSetup inserta los barberos 1 y 2 con id fijo sin avanzar la secuencia.
  await pool.query("SELECT setval('barberos_id_seq', GREATEST((SELECT MAX(id) FROM barberos), 2))");
});

beforeEach(async () => {
  // Solo se simula Date: los temporizadores reales siguen funcionando (pg, bcrypt, supertest).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOCHE_BOGOTA));
  // Contraseña recién fijada "hoy" según el reloj simulado (la columna se llenó con la hora real al crear el usuario).
  await envejecer('prueba_cad', 0);
});

afterEach(async () => {
  vi.useRealTimers();
  await pool.query("UPDATE usuarios SET activo = true, contrasena = $1 WHERE usuario = 'prueba_cad'", [await bcrypt.hash(CLAVE, 10)]);
});

afterAll(async () => {
  await pool.query("DELETE FROM usuarios WHERE usuario LIKE 'prueba_%'");
});

describe('estadoContrasena (reloj simulado)', () => {
  const cambio = '2026-08-05T15:00:00Z'; // 10:00 en Bogotá
  const despues = (dias, extraMs = 0) => new Date(new Date(cambio).getTime() + dias * DIA_MS + extraMs);

  it('constantes: 60 días de vigencia y aviso a 2 días', () => {
    expect(VIGENCIA_DIAS).toBe(60);
    expect(AVISO_DIAS).toBe(2);
  });

  it.each([
    [0, 'vigente', 60],
    [57, 'vigente', 3],
    [58, 'por_vencer', 2],
    [59, 'por_vencer', 1],
    [60, 'caducada', 0],
    [61, 'caducada', -1],
  ])('día %i desde el cambio → %s con dias_restantes %i', (dias, estado, restantes) => {
    expect(estadoContrasena(cambio, despues(dias))).toMatchObject({ estado, dias_restantes: restantes });
  });

  it('vence_en es la fecha (Bogotá) del cambio + 60 días, cruzando meses', () => {
    expect(estadoContrasena('2026-01-30T15:00:00Z', new Date('2026-01-30T15:00:00Z')).vence_en).toBe('2026-03-31');
    expect(estadoContrasena(cambio, new Date(cambio)).vence_en).toBe('2026-10-04');
  });

  it('cuenta días de calendario: a las 23:59 y a las 00:00 de Bogotá cambia el día, no a las 24 h exactas', () => {
    const tarde = '2026-08-05T23:30:00Z'; // 18:30 Bogotá del 5 de agosto → vence el 4 de octubre
    // 3 de octubre 23:59 Bogotá = faltan 1 día; 4 de octubre 00:00 Bogotá = caducada (aunque no hayan pasado 60×24 h).
    expect(estadoContrasena(tarde, new Date('2026-10-04T04:59:59Z'))).toMatchObject({ estado: 'por_vencer', dias_restantes: 1 });
    expect(estadoContrasena(tarde, new Date('2026-10-04T05:00:00Z'))).toMatchObject({ estado: 'caducada', dias_restantes: 0 });
  });

  it('usa Bogotá y no UTC: a las 22:00 de Bogotá ya es el día siguiente en UTC', () => {
    const nocheBogota = '2026-08-05T03:00:00Z'; // 4 de agosto, 22:00 Bogotá (5 de agosto en UTC)
    expect(estadoContrasena(nocheBogota, new Date(nocheBogota)).vence_en).toBe('2026-10-03'); // con UTC saldría el 4
    // 2 de octubre 23:59 Bogotá = 3 de octubre en UTC: con UTC ya figuraría caducada.
    expect(estadoContrasena(nocheBogota, new Date('2026-10-03T04:59:59Z'))).toMatchObject({ estado: 'por_vencer', dias_restantes: 1 });
    expect(estadoContrasena(nocheBogota, new Date('2026-10-03T05:00:00Z'))).toMatchObject({ estado: 'caducada', dias_restantes: 0 });
  });
});

describe('Login y estado de la sesión', () => {
  it('el login de un barbero incluye el estado de su contraseña', async () => {
    const res = await login('prueba_cad');
    expect(res.status).toBe(200);
    expect(res.body.vigencia).toEqual({ estado: 'vigente', dias_restantes: 60, vence_en: '2026-12-03' });
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
  });

  it('el login del admin no incluye estado (vigencia null)', async () => {
    const res = await login(process.env.ADMIN_USER, process.env.ADMIN_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.vigencia).toBeNull();
  });

  it('un barbero con la contraseña caducada sí puede iniciar sesión', async () => {
    await envejecer('prueba_cad', 60);
    const res = await login('prueba_cad');
    expect(res.status).toBe(200);
    expect(res.body.vigencia).toMatchObject({ estado: 'caducada', dias_restantes: 0 });
  });

  it('GET /api/auth/sesion devuelve el estado actual, también si está caducada', async () => {
    await envejecer('prueba_cad', 59);
    const { body } = await login('prueba_cad');
    const por = await request(app).get('/api/auth/sesion').set(conToken(body.token));
    expect(por.status).toBe(200);
    expect(por.body.vigencia).toMatchObject({ estado: 'por_vencer', dias_restantes: 1 });
    expect(por.body.usuario).toMatchObject({ usuario: 'prueba_cad', rol: 'barbero' });

    await envejecer('prueba_cad', 61);
    const caducada = await request(app).get('/api/auth/sesion').set(conToken(body.token));
    expect(caducada.status).toBe(200);
    expect(caducada.body.vigencia.estado).toBe('caducada');
  });

  it('GET /api/auth/sesion sin token da 401', async () => {
    expect((await request(app).get('/api/auth/sesion')).status).toBe(401);
  });
});

describe('Cambio de contraseña: quién puede y cuándo', () => {
  it('barbero vigente (día 57): 403 CAMBIO_NO_PERMITIDO y la contraseña no cambia', async () => {
    await envejecer('prueba_cad', 57);
    const { body } = await login('prueba_cad');
    const res = await cambiar(body.token, { actual: CLAVE, nueva: CLAVE_NUEVA });
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('CAMBIO_NO_PERMITIDO');
    expect((await login('prueba_cad')).status).toBe(200); // la clave de antes sigue sirviendo
  });

  it('barbero recién creado (día 0): también 403 CAMBIO_NO_PERMITIDO', async () => {
    const { body } = await login('prueba_cad');
    expect((await cambiar(body.token, { actual: CLAVE, nueva: CLAVE_NUEVA })).body.codigo).toBe('CAMBIO_NO_PERMITIDO');
  });

  it('barbero por_vencer (día 58): puede cambiarla, el contador se reinicia y la nueva sirve', async () => {
    await envejecer('prueba_cad', 58);
    const { body } = await login('prueba_cad');
    expect(body.vigencia).toMatchObject({ estado: 'por_vencer', dias_restantes: 2 });

    const res = await cambiar(body.token, { actual: CLAVE, nueva: CLAVE_NUEVA });
    expect(res.status).toBe(200);
    expect(res.body.vigencia).toEqual({ estado: 'vigente', dias_restantes: 60, vence_en: '2026-12-03' });

    const { rows } = await pool.query("SELECT contrasena_cambiada_en FROM usuarios WHERE usuario = 'prueba_cad'");
    expect(rows[0].contrasena_cambiada_en.toISOString()).toBe(NOCHE_BOGOTA.replace('Z', '.000Z'));
    expect((await login('prueba_cad', CLAVE_NUEVA)).status).toBe(200);
    expect((await login('prueba_cad', CLAVE)).status).toBe(401);

    // MODIFICADO: cambiar la contraseña invalida el token anterior (revocación de sesiones) y devuelve uno nuevo.
    expect((await cambiar(body.token, { actual: CLAVE_NUEVA, nueva: CLAVE })).status).toBe(401);
    // Ya vigente otra vez: no puede volver a cambiarla.
    expect((await cambiar(res.body.token, { actual: CLAVE_NUEVA, nueva: CLAVE })).body.codigo).toBe('CAMBIO_NO_PERMITIDO');
  });

  it('barbero caducada (día 60): puede cambiarla y vuelve a entrar con normalidad', async () => {
    await envejecer('prueba_cad', 60);
    const { body } = await login('prueba_cad');
    expect((await request(app).get('/api/citas').set(conToken(body.token))).status).toBe(403);

    const cambio = await cambiar(body.token, { actual: CLAVE, nueva: CLAVE_NUEVA });
    expect(cambio.status).toBe(200);
    // MODIFICADO: el token anterior queda revocado y el que devuelve el cambio sirve para el resto de la API.
    expect((await request(app).get('/api/citas').set(conToken(body.token))).status).toBe(401);
    expect((await request(app).get('/api/citas').set(conToken(cambio.body.token))).status).toBe(200);
  });

  it('admin exento: cambia su contraseña cuando quiere aunque su fecha sea muy antigua', async () => {
    await pool.query('UPDATE usuarios SET contrasena_cambiada_en = $1 WHERE usuario = $2', [new Date(Date.now() - 400 * DIA_MS), process.env.ADMIN_USER]);
    const { body } = await login(process.env.ADMIN_USER, process.env.ADMIN_PASSWORD);
    expect((await request(app).get('/api/citas').set(conToken(body.token))).status).toBe(200);
    expect((await request(app).get('/api/auth/sesion').set(conToken(body.token))).body.vigencia).toBeNull();

    const cambio = await cambiar(body.token, { actual: process.env.ADMIN_PASSWORD, nueva: CLAVE_NUEVA });
    expect(cambio.status).toBe(200);
    expect(cambio.body.vigencia).toBeNull();
    // Se devuelve a su valor original para no afectar a otras pruebas.
    expect((await cambiar(cambio.body.token, { actual: CLAVE_NUEVA, nueva: process.env.ADMIN_PASSWORD })).status).toBe(200); // MODIFICADO: con el token renovado
  });

  describe('validaciones del cuerpo (con la contraseña por vencer)', () => {
    let token;
    beforeEach(async () => {
      await envejecer('prueba_cad', 59);
      token = (await login('prueba_cad')).body.token;
    });

    it('contraseña actual incorrecta: 400 CONTRASENA_ACTUAL_INCORRECTA (no 401, para no cerrar la sesión)', async () => {
      const res = await cambiar(token, { actual: 'no-es-esa-1', nueva: CLAVE_NUEVA });
      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('CONTRASENA_ACTUAL_INCORRECTA');
    });

    it('nueva igual a la actual: 400 CONTRASENA_IGUAL', async () => {
      const res = await cambiar(token, { actual: CLAVE, nueva: CLAVE });
      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('CONTRASENA_IGUAL');
    });

    it.each([
      ['7 caracteres', 'a'.repeat(7)],
      ['73 caracteres', 'a'.repeat(73)],
      ['vacía', ''],
      ['un número', 12345678],
    ])('nueva inválida (%s): 400 DATOS_INVALIDOS', async (_, nueva) => {
      const res = await cambiar(token, { actual: CLAVE, nueva });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ codigo: 'DATOS_INVALIDOS', campo: 'nueva' });
    });

    it('falta la actual: 400 DATOS_INVALIDOS', async () => {
      const res = await cambiar(token, { nueva: CLAVE_NUEVA });
      expect(res.body).toMatchObject({ codigo: 'DATOS_INVALIDOS', campo: 'actual' });
    });

    // MODIFICADO: antes eran 'n' repetidas; la política de contraseñas rechaza ahora un solo carácter repetido.
    it.each([8, 72])('acepta una nueva de %i caracteres', async (largo) => {
      const nueva = 'aB3$kLm9'.repeat(9).slice(0, largo);
      const res = await cambiar(token, { actual: CLAVE, nueva });
      expect(res.status).toBe(200);
      expect((await login('prueba_cad', nueva)).status).toBe(200);
    });
  });
});

describe('Contraseña caducada: todo lo demás se bloquea', () => {
  let token;
  beforeEach(async () => {
    await envejecer('prueba_cad', 75);
    token = (await login('prueba_cad')).body.token;
  });

  it.each([
    ['get', '/api/citas'],
    ['get', '/api/citas?fecha=2026-10-04'],
    ['patch', '/api/citas/1'],
    ['get', '/api/admin/citas'],
    ['get', '/api/admin/empleados'],
  ])('%s %s → 403 CONTRASENA_CADUCADA', async (metodo, ruta) => {
    const res = await request(app)[metodo](ruta).set(conToken(token)).send({ estado: 'cancelada' });
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('CONTRASENA_CADUCADA');
  });

  it('las rutas públicas siguen abiertas', async () => {
    expect((await request(app).get('/api/barberos')).status).toBe(200);
    expect((await request(app).get('/api/servicios')).status).toBe(200);
  });

  it('token de un usuario desactivado sigue dando 401 SESION_INVALIDA (antes que cualquier bloqueo por caducidad)', async () => {
    await pool.query("UPDATE usuarios SET activo = false WHERE usuario = 'prueba_cad'");
    for (const ruta of ['/api/citas', '/api/auth/sesion']) {
      const res = await request(app).get(ruta).set(conToken(token));
      expect(res.status).toBe(401);
      expect(res.body.codigo).toBe('SESION_INVALIDA');
    }
    expect((await cambiar(token, { actual: CLAVE, nueva: CLAVE_NUEVA })).status).toBe(401);
  });

  it('el reloj manda: a las 23:59 (Bogotá) del día 59 aún se puede entrar; pasada la medianoche, no', async () => {
    // Cambio el 4 de octubre 22:00 Bogotá → vence el 3 de diciembre (hora de Bogotá).
    await pool.query("UPDATE usuarios SET contrasena_cambiada_en = $1 WHERE usuario = 'prueba_cad'", [NOCHE_BOGOTA]);

    vi.setSystemTime(new Date('2026-12-03T04:59:00Z')); // 2 de diciembre, 23:59 en Bogotá (3 de diciembre en UTC)
    const antes = (await login('prueba_cad')).body;
    expect(antes.vigencia).toMatchObject({ estado: 'por_vencer', dias_restantes: 1 });
    expect((await request(app).get('/api/citas').set(conToken(antes.token))).status).toBe(200);

    vi.setSystemTime(new Date('2026-12-03T05:00:00Z')); // 3 de diciembre, 00:00 en Bogotá
    expect((await request(app).get('/api/citas').set(conToken(antes.token))).body.codigo).toBe('CONTRASENA_CADUCADA');
  });
});

describe('Quién reinicia el contador', () => {
  const admin = async () => (await login(process.env.ADMIN_USER, process.env.ADMIN_PASSWORD)).body.token;
  const idUsuario = async (usuario) => (await pool.query('SELECT id FROM usuarios WHERE usuario = $1', [usuario])).rows[0].id;

  it('el admin restablece la contraseña de un barbero caducado: se reinicia el contador y el barbero no está obligado a cambiarla', async () => {
    await envejecer('prueba_cad', 90);
    const res = await request(app)
      .patch(`/api/admin/usuarios/${await idUsuario('prueba_cad')}`)
      .set(conToken(await admin()))
      .send({ contrasena: CLAVE_NUEVA });
    expect(res.status).toBe(200);

    const sesion = await login('prueba_cad', CLAVE_NUEVA);
    expect(sesion.status).toBe(200);
    expect(sesion.body.vigencia).toEqual({ estado: 'vigente', dias_restantes: 60, vence_en: '2026-12-03' });
    expect((await request(app).get('/api/citas').set(conToken(sesion.body.token))).status).toBe(200);
  });

  it('el admin cambia solo `activo`: el contador NO se reinicia', async () => {
    await envejecer('prueba_cad', 30);
    await request(app).patch(`/api/admin/usuarios/${await idUsuario('prueba_cad')}`).set(conToken(await admin())).send({ activo: true });
    expect((await login('prueba_cad')).body.vigencia).toMatchObject({ dias_restantes: 30 });
  });

  it('crear un acceso (POST /admin/usuarios) y un empleado (POST /admin/empleados) dejan 60 días', async () => {
    const token = await admin();
    const { rows } = await pool.query("INSERT INTO barberos (nombre) VALUES ('Prueba Vigencia') RETURNING id");
    const acceso = await request(app).post('/api/admin/usuarios').set(conToken(token)).send({ usuario: 'prueba_acceso', contrasena: CLAVE, barbero_id: rows[0].id });
    expect(acceso.status).toBe(201);
    expect((await login('prueba_acceso')).body.vigencia).toMatchObject({ estado: 'vigente', dias_restantes: 60 });

    const empleado = await request(app)
      .post('/api/admin/empleados')
      .set(conToken(token))
      .send({ nombre: 'Prueba Empleado', usuario: 'prueba_empleado', contrasena: CLAVE });
    expect(empleado.status).toBe(201);
    expect(empleado.body.usuario.vigencia).toEqual({ estado: 'vigente', dias_restantes: 60, vence_en: '2026-12-03' });

    await pool.query("DELETE FROM usuarios WHERE usuario IN ('prueba_acceso', 'prueba_empleado')");
    await pool.query("DELETE FROM barberos WHERE nombre IN ('Prueba Vigencia', 'Prueba Empleado')");
  });

  it('GET /admin/empleados muestra el estado de cada barbero y nunca el hash', async () => {
    await envejecer('prueba_cad', 59);
    const res = await request(app).get('/api/admin/empleados').set(conToken(await admin()));
    expect(res.status).toBe(200);
    const empleado = res.body.find((e) => e.usuario?.usuario === 'prueba_cad');
    expect(empleado.usuario.vigencia).toMatchObject({ estado: 'por_vencer', dias_restantes: 1, vence_en: '2026-10-05' });
    expect(Object.keys(empleado.usuario).sort()).toEqual(['activo', 'id', 'usuario', 'vigencia']);
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$|contrasena/);
  });
});
