import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { HORAS_GRACIA_CONFIRMACION, MINUTOS_GRACIA_CONFIRMACION } from '../utils/confirmacion.js';
import { NOCHE_BOGOTA, firmarToken, insertarCita, reiniciarContador } from './utilsPrueba.js';

const app = crearApp();

// Usuarios de globalSetup: admin = 1, barbero1_test = 2 (barbero 1), barbero2_test = 3 (barbero 2).
const firmar = (id, rol, barberoId) =>
  jwt.sign({ id, usuario: `u${id}`, rol, barbero_id: barberoId }, process.env.JWT_SECRET, { expiresIn: '30d' });
const barbero1 = firmar(2, 'barbero', 1);
const barbero2 = firmar(3, 'barbero', 2);
const admin = firmar(1, 'admin', null);

const get = (ruta, token = barbero1) => request(app).get(`/api/barbero${ruta}`).set('Authorization', `Bearer ${token}`);
const ponerReloj = (iso) => vi.setSystemTime(new Date(iso));

// Hora de Bogotá → instante UTC (Bogotá es UTC-5 todo el año).
const bogota = (fecha, hora) => `${fecha}T${hora}:00-05:00`;

const porConfirmar = async (token = barbero1) => (await get('/citas-por-confirmar', token)).body.items.map((c) => c.id);

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterAll(() => {
  vi.useRealTimers();
});
beforeEach(async () => {
  ponerReloj(NOCHE_BOGOTA); // 4 de octubre, 22:00 en Bogotá (5 de octubre en UTC)
  reiniciarContador();
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  await pool.query("UPDATE usuarios SET activo = true, contrasena_cambiada_en = $1 WHERE usuario IN ('barbero1_test', 'barbero2_test')", [new Date(NOCHE_BOGOTA)]);
});

describe('Regla de "cita por confirmar" (pendiente cuyo fin + 2 h ya pasó)', () => {
  it('la gracia es de 2 horas y está en un solo lugar', () => {
    expect(HORAS_GRACIA_CONFIRMACION).toBe(2);
    expect(MINUTOS_GRACIA_CONFIRMACION).toBe(120);
  });

  // Reloj fijo: 22:00. Una cita de 30 min que empieza a las 19:30 termina 20:00 y su límite es justo 22:00.
  it.each([
    ['un minuto antes del límite (19:31)', '19:31', false],
    ['justo en el límite (19:30)', '19:30', true],
    ['un minuto después del límite (19:29)', '19:29', true],
  ])('%s', async (_n, hora, esperada) => {
    const id = await insertarCita({ fecha: '2026-10-04', hora, estado: 'pendiente', barbero_id: 1, duracion_min: 30 });
    expect((await porConfirmar()).includes(id)).toBe(esperada);
    expect((await get('/resumen')).body.por_confirmar).toBe(esperada ? 1 : 0);
  });

  it('usa la duración guardada en la cita y no la del servicio actual', async () => {
    // Servicio 2 dura 90 min, pero la cita guardó 30: termina 19:30, límite 21:30 → ya está por confirmar.
    const id = await insertarCita({ fecha: '2026-10-04', hora: '19:00', estado: 'pendiente', barbero_id: 1, servicio_id: 2, duracion_min: 30 });
    expect(await porConfirmar()).toEqual([id]);
    // Con 90 guardados el límite sería 22:30: todavía no.
    await pool.query('UPDATE citas SET duracion_min = 90 WHERE id = $1', [id]);
    expect(await porConfirmar()).toEqual([]);
  });

  it('cita que cruza la medianoche: 23:00 + 90 min termina a las 00:30 y vence a las 02:30', async () => {
    const id = await insertarCita({ fecha: '2026-10-04', hora: '23:00', estado: 'pendiente', barbero_id: 1, servicio_id: 2, duracion_min: 90 });
    ponerReloj(bogota('2026-10-05', '02:29'));
    expect(await porConfirmar()).toEqual([]);
    ponerReloj(bogota('2026-10-05', '02:30'));
    expect(await porConfirmar()).toEqual([id]);
  });

  it('incluye citas de días anteriores, de la más antigua a la más reciente, con el tiempo vencido', async () => {
    const reciente = await insertarCita({ fecha: '2026-10-04', hora: '10:00', estado: 'pendiente', barbero_id: 1, duracion_min: 30 });
    const antigua = await insertarCita({ fecha: '2026-09-01', hora: '15:00', estado: 'pendiente', barbero_id: 1, duracion_min: 60 });
    const media = await insertarCita({ fecha: '2026-10-02', hora: '09:00', estado: 'pendiente', barbero_id: 1, duracion_min: 30 });

    const res = await get('/citas-por-confirmar');
    expect(res.status).toBe(200);
    expect(res.body.items.map((c) => c.id)).toEqual([antigua, media, reciente]);
    expect(res.body.total).toBe(3);

    // La de hoy 10:00–10:30: terminó hace 690 min (11 h 30) y venció hace 570.
    expect(res.body.items[2]).toMatchObject({
      id: reciente, cliente: 'Cliente de prueba', servicio_nombre: 'Corte de prueba', fecha: '2026-10-04', hora: '10:00:00',
      duracion_min: 30, termino_hace_min: 690, vencida_hace_min: 570,
    });
  });

  it('zona horaria: una cita de las 01:00 del día 5 (futura en Bogotá, pasada en UTC) no está por confirmar', async () => {
    await insertarCita({ fecha: '2026-10-05', hora: '01:00', estado: 'pendiente', barbero_id: 1, duracion_min: 30 });
    expect(await porConfirmar()).toEqual([]);
  });

  it('solo cuentan las pendientes: completadas y canceladas no, aunque sean viejas', async () => {
    await insertarCita({ fecha: '2026-09-01', hora: '10:00', estado: 'completada', barbero_id: 1 });
    await insertarCita({ fecha: '2026-09-01', hora: '11:00', estado: 'cancelada', barbero_id: 1 });
    expect(await porConfirmar()).toEqual([]);
  });

  it('GET /citas-por-confirmar devuelve el total real y el tope', async () => {
    const res = await get('/citas-por-confirmar');
    expect(res.body).toMatchObject({ total: 0, tope: 100, items: [] });
  });
});

describe('GET /api/barbero/resumen', () => {
  it('con todo en cero: sin próxima cita y ceros', async () => {
    const res = await get('/resumen');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      fecha: '2026-10-04', citas_hoy: 0, completadas_hoy: 0, pendientes_hoy: 0, proxima_cita: null,
      ingresos_hoy: 0, cortes_mes: 0, ingresos_mes: 0, por_confirmar: 0,
    });
  });

  it('cuenta solo sus citas; ingresos con el precio guardado en la cita; límites de mes en Bogotá', async () => {
    // Hoy (4 de octubre). El catálogo cobra 50000 por el servicio 1, pero la cita guardó otro precio.
    await insertarCita({ fecha: '2026-10-04', hora: '09:00', estado: 'completada', barbero_id: 1, precio: 40000 });
    await insertarCita({ fecha: '2026-10-04', hora: '10:00', estado: 'completada', barbero_id: 1, precio: 0 });
    await insertarCita({ fecha: '2026-10-04', hora: '11:00', estado: 'pendiente', barbero_id: 1 }); // vencida de hoy
    await insertarCita({ fecha: '2026-10-04', hora: '23:00', estado: 'pendiente', barbero_id: 1 }); // aún no empieza
    await insertarCita({ fecha: '2026-10-04', hora: '12:00', estado: 'cancelada', barbero_id: 1, precio: 99999 });
    // Mes en curso y fuera del mes.
    await insertarCita({ fecha: '2026-10-01', hora: '09:00', estado: 'completada', barbero_id: 1, precio: 30000 });
    await insertarCita({ fecha: '2026-09-30', hora: '09:00', estado: 'completada', barbero_id: 1, precio: 77777 });
    await insertarCita({ fecha: '2026-10-05', hora: '09:00', estado: 'pendiente', barbero_id: 1 }); // mañana
    // Otro barbero: nunca debe aparecer.
    await insertarCita({ fecha: '2026-10-04', hora: '09:00', estado: 'completada', barbero_id: 2, precio: 500000 });
    await insertarCita({ fecha: '2026-10-04', hora: '23:30', estado: 'pendiente', barbero_id: 2 });

    const res = await get('/resumen');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      fecha: '2026-10-04',
      citas_hoy: 4, // 2 completadas + 2 pendientes; la cancelada no cuenta
      completadas_hoy: 2,
      pendientes_hoy: 2,
      ingresos_hoy: 40000,
      cortes_mes: 3,
      ingresos_mes: 70000,
      por_confirmar: 1, // la de las 11:00 (la de 23:00 y la de mañana no)
    });
    expect(res.body.proxima_cita).toMatchObject({ cliente: 'Cliente de prueba', servicio_nombre: 'Corte de prueba', fecha: '2026-10-04', hora: '23:00:00' });

    const otro = await get('/resumen', barbero2);
    expect(otro.body).toMatchObject({ citas_hoy: 2, completadas_hoy: 1, ingresos_hoy: 500000, ingresos_mes: 500000, cortes_mes: 1 });
    expect(otro.body.proxima_cita.hora).toBe('23:30:00');
  });

  it('proxima_cita puede ser de un día siguiente y nunca una que ya empezó', async () => {
    await insertarCita({ fecha: '2026-10-04', hora: '21:00', estado: 'pendiente', barbero_id: 1 }); // ya empezó
    const manana = await insertarCita({ fecha: '2026-10-05', hora: '09:00', estado: 'pendiente', barbero_id: 1 });
    expect((await get('/resumen')).body.proxima_cita).toMatchObject({ id: manana, fecha: '2026-10-05' });
  });

  it('"hoy" y el mes son los de Bogotá, no los de UTC: a las 22:00 del 31 de octubre sigue siendo octubre', async () => {
    ponerReloj(bogota('2026-10-31', '22:00')); // ya es 1 de noviembre en UTC
    await insertarCita({ fecha: '2026-10-31', hora: '09:00', estado: 'completada', barbero_id: 1, precio: 10000 });
    await insertarCita({ fecha: '2026-11-01', hora: '09:00', estado: 'completada', barbero_id: 1, precio: 20000 });
    const res = await get('/resumen');
    expect(res.body).toMatchObject({ fecha: '2026-10-31', completadas_hoy: 1, ingresos_hoy: 10000, cortes_mes: 1, ingresos_mes: 10000 });
  });
});

describe('GET /api/barbero/agenda-hoy', () => {
  it('sus citas de hoy por hora, con estado, servicio, duración, precio y si están por confirmar', async () => {
    const tarde = await insertarCita({ fecha: '2026-10-04', hora: '16:00', estado: 'pendiente', barbero_id: 1, servicio_id: 2, duracion_min: 90, precio: 100000 });
    const manana = await insertarCita({ fecha: '2026-10-04', hora: '09:00', estado: 'completada', barbero_id: 1, precio: 45000 });
    const cancelada = await insertarCita({ fecha: '2026-10-04', hora: '12:00', estado: 'cancelada', barbero_id: 1 });
    const futura = await insertarCita({ fecha: '2026-10-04', hora: '23:00', estado: 'pendiente', barbero_id: 1 });
    await insertarCita({ fecha: '2026-10-05', hora: '09:00', estado: 'pendiente', barbero_id: 1 }); // otro día
    await insertarCita({ fecha: '2026-10-04', hora: '10:00', estado: 'pendiente', barbero_id: 2 }); // otro barbero

    const res = await get('/agenda-hoy');
    expect(res.status).toBe(200);
    expect(res.body.fecha).toBe('2026-10-04');
    expect(res.body.citas.map((c) => c.id)).toEqual([manana, cancelada, tarde, futura]);
    expect(res.body.citas.map((c) => c.por_confirmar)).toEqual([false, false, true, false]); // 16:00 + 90 min + 2 h = 19:30
    expect(res.body.citas[2]).toMatchObject({
      cliente: 'Cliente de prueba', servicio_nombre: 'Combo de prueba', estado: 'pendiente', hora: '16:00:00', duracion_min: 90, precio: 100000,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/correo|telefono|barbero_id/);
  });
});

describe('Seguridad de los endpoints del barbero', () => {
  const rutas = ['/resumen', '/citas-por-confirmar', '/agenda-hoy'];

  it.each(rutas)('%s: el barbero_id nunca se toma del cliente (query, repetidos, otros parámetros → 400)', async (ruta) => {
    await insertarCita({ fecha: '2026-10-04', hora: '09:00', estado: 'pendiente', barbero_id: 2 });
    for (const query of ['?barbero_id=2', '?barbero=2', '?fecha=2026-10-04', '?x=1&x=2', '?barbero_id[]=2']) {
      const res = await get(`${ruta}${query}`);
      expect(res.status, query).toBe(400);
      expect(res.body.codigo).toBe('PARAMETRO_INVALIDO');
    }
  });

  it('un barbero jamás ve datos de otro (ninguna de las tres rutas)', async () => {
    await insertarCita({ fecha: '2026-10-04', hora: '09:00', estado: 'pendiente', barbero_id: 2, cliente: 'Cliente ajeno', precio: 12345 });
    await insertarCita({ fecha: '2026-10-04', hora: '10:00', estado: 'completada', barbero_id: 2, cliente: 'Cliente ajeno', precio: 12345 });
    const cuerpo = JSON.stringify(await Promise.all(rutas.map(async (r) => (await get(r)).body)));
    expect(cuerpo).not.toMatch(/ajeno|12345/);
  });

  it.each(rutas)('%s: sin token 401; el admin 403 (es solo de barberos); POST y DELETE no existen', async (ruta) => {
    expect((await request(app).get(`/api/barbero${ruta}`)).status).toBe(401);
    expect((await get(ruta, admin)).status).toBe(403);
    expect((await request(app).post(`/api/barbero${ruta}`).set('Authorization', `Bearer ${barbero1}`).send({ barbero_id: 2 })).status).toBe(404);
    expect((await request(app).delete(`/api/barbero${ruta}`).set('Authorization', `Bearer ${barbero1}`)).status).toBe(404);
  });

  it.each(rutas)('%s: con la contraseña caducada, 403 CONTRASENA_CADUCADA', async (ruta) => {
    await pool.query("UPDATE usuarios SET contrasena_cambiada_en = $1 WHERE usuario = 'barbero1_test'", [new Date(Date.parse(NOCHE_BOGOTA) - 60 * 24 * 3600 * 1000)]);
    const res = await get(ruta);
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('CONTRASENA_CADUCADA');
  });

  it.each(rutas)('%s: un usuario desactivado da 401 SESION_INVALIDA', async (ruta) => {
    await pool.query("UPDATE usuarios SET activo = false WHERE usuario = 'barbero1_test'");
    const res = await get(ruta);
    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('SESION_INVALIDA');
  });

  it('el barbero_id sale de la base: un token con un barbero_id falsificado no da acceso a otro barbero', async () => {
    await insertarCita({ fecha: '2026-10-04', hora: '09:00', estado: 'completada', barbero_id: 2, precio: 777 });
    const falsificado = firmar(2, 'barbero', 2); // usuario 2 es del barbero 1, el token dice 2
    expect((await get('/resumen', falsificado)).body.ingresos_hoy).toBe(0);
  });
});

describe('Completar y cancelar son de los barberos; el admin solo reasigna', () => {
  const patch = (id, token, cuerpo) => request(app).patch(`/api/citas/${id}`).set('Authorization', `Bearer ${token}`).send(cuerpo);

  it('el admin recibe 403 SOLO_BARBERO al completar y al cancelar, y la cita no cambia', async () => {
    const id = await insertarCita({ fecha: '2026-10-03', hora: '10:00', estado: 'pendiente', barbero_id: 1 });
    for (const estado of ['completada', 'cancelada', 'pendiente']) {
      const res = await patch(id, admin, { estado });
      expect(res.status).toBe(403);
      expect(res.body.codigo).toBe('SOLO_BARBERO');
    }
    const { rows } = await pool.query('SELECT estado FROM citas WHERE id = $1', [id]);
    expect(rows[0].estado).toBe('pendiente');
  });

  it('el admin sí puede reasignar la cita a otro barbero activo', async () => {
    const id = await insertarCita({ fecha: '2026-10-03', hora: '10:00', estado: 'pendiente', barbero_id: 1 });
    const res = await patch(id, admin, { barbero_id: 2 });
    expect(res.status).toBe(200);
    expect(res.body.barbero_id).toBe(2);
  });

  it('el barbero completa y cancela las suyas, no las de otro (404), y tampoco reasigna (403)', async () => {
    const suya = await insertarCita({ fecha: '2026-10-03', hora: '10:00', estado: 'pendiente', barbero_id: 1 });
    const otra = await insertarCita({ fecha: '2026-10-03', hora: '10:00', estado: 'pendiente', barbero_id: 2 });
    const futura = await insertarCita({ fecha: '2026-10-09', hora: '10:00', estado: 'pendiente', barbero_id: 1 });

    expect((await patch(suya, barbero1, { estado: 'completada' })).body.estado).toBe('completada');
    expect((await patch(otra, barbero1, { estado: 'completada' })).status).toBe(404);
    expect((await patch(otra, barbero1, { estado: 'cancelada' })).status).toBe(404);
    expect((await patch(futura, barbero1, { estado: 'completada' })).body.codigo).toBe('CITA_FUTURA');
    expect((await patch(futura, barbero1, { estado: 'cancelada' })).body.estado).toBe('cancelada');
    expect((await patch(suya, barbero1, { barbero_id: 2 })).status).toBe(403);
    const { rows } = await pool.query('SELECT estado FROM citas WHERE id = $1', [otra]);
    expect(rows[0].estado).toBe('pendiente');
  });

  it('una cita que el barbero completa deja de estar por confirmar', async () => {
    const id = await insertarCita({ fecha: '2026-10-03', hora: '10:00', estado: 'pendiente', barbero_id: 1 });
    expect(await porConfirmar()).toEqual([id]);
    await patch(id, firmarToken('barbero'), { estado: 'completada' });
    expect(await porConfirmar()).toEqual([]);
  });
});
