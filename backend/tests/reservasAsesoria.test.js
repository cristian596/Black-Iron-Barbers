import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { firmarToken, insertarCita, reiniciarContador } from './utilsPrueba.js';
import { esAsesoriaGratis, esConflictoDeHorario } from '../utils/areas.js';

// Fase 3 de asesorías: disponibilidad y creación de citas de asesoría, solas o combinadas con cortes. Las pruebas crean
// sus propios asesores y servicios (ids 92xx) y los borran: no dependen del seed del catálogo. Los barberos 1 y 2 son
// los de globalSetup (area 'barberia').

const app = crearApp();
const FECHA = '2030-07-17';

const A1 = 9201; // asesores (area 'asesoria')
const A2 = 9202;
const ASES_A = 9201; // asesoría de 30 min, $60.000
const ASES_B = 9202; // asesoría de 45 min, $45.000
const CORTE_1 = 9203; // 30 min, $20.000
const CORTE_2 = 9204; // 30 min, $15.000
const CORTE_LARGO_A = 9205; // 120 min
const CORTE_LARGO_B = 9206; // 130 min (A + B = 250 > 240)
const ASES_LARGA = 9207; // asesoría de 300 min
const GRATIS = 9208; // asesoría gratis (clave_seed): sigue bloqueada
const IDS_SERVICIOS = [ASES_A, ASES_B, CORTE_1, CORTE_2, CORTE_LARGO_A, CORTE_LARGO_B, ASES_LARGA, GRATIS];

const credenciales = () => ({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
});

const limpiar = async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  await pool.query("DELETE FROM usuarios WHERE usuario LIKE 'prueba_reserva_%'");
};

const borrarDatosPrueba = async () => {
  await limpiar();
  await pool.query('DELETE FROM servicios WHERE id = ANY($1::int[])', [IDS_SERVICIOS]);
  await pool.query('DELETE FROM barberos WHERE id = ANY($1::int[])', [[A1, A2]]);
};

let admin;
const tokenDe = async (barberoId) => {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id, activo) VALUES ($1, 'no-se-usa', 'barbero', $2, true) RETURNING id`,
    [`prueba_reserva_${barberoId}`, barberoId]
  );
  return jwt.sign({ id: rows[0].id, usuario: `prueba_reserva_${barberoId}`, rol: 'barbero', barbero_id: barberoId }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
};

beforeAll(async () => {
  await borrarDatosPrueba();
  await pool.query(
    `INSERT INTO barberos (id, nombre, cargo, especialidad, area) VALUES
       ($1, 'Reserva Asesor Uno', 'Asesor de Imagen', 'Asesoria', 'asesoria'),
       ($2, 'Reserva Asesor Dos', 'Asesor de Imagen', 'Asesoria', 'asesoria')`,
    [A1, A2]
  );
  await pool.query(
    `INSERT INTO servicios (id, nombre, duracion_min, precio, tipo, descripcion, area, clave_seed) VALUES
       ($1, 'Reserva asesoría A', 30, 60000, 'vip', 'x', 'asesoria', NULL),
       ($2, 'Reserva asesoría B', 45, 45000, 'elite', 'x', 'asesoria', NULL),
       ($3, 'Reserva corte 1', 30, 20000, 'original', 'x', 'barberia', NULL),
       ($4, 'Reserva corte 2', 30, 15000, 'original', 'x', 'barberia', NULL),
       ($5, 'Reserva corte largo A', 120, 80000, 'original', 'x', 'barberia', NULL),
       ($6, 'Reserva corte largo B', 130, 90000, 'original', 'x', 'barberia', NULL),
       ($7, 'Reserva asesoría larga', 300, 150000, 'vip', 'x', 'asesoria', NULL),
       ($8, 'Reserva asesoría gratis', 15, 0, 'original', 'x', 'asesoria', 'asesoria-gratis')`,
    IDS_SERVICIOS
  );
  admin = firmarToken('admin');
});

beforeEach(async () => {
  reiniciarContador();
  await limpiar();
  await pool.query('UPDATE barberos SET area = $1, activo = true WHERE id IN (1, 2)', ['barberia']);
  await pool.query('UPDATE barberos SET activo = true WHERE id = ANY($1::int[])', [[A1, A2]]);
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await borrarDatosPrueba();
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const disp = (query) => request(app).get('/api/disponibilidad').query({ fecha: FECHA, ...query });
const reservar = (extra = {}) =>
  request(app)
    .post('/api/citas')
    .send({
      cliente: 'Cliente de prueba',
      correo: 'cliente@example.com',
      telefono: '3001234567',
      consentimiento: true,
      fecha: FECHA,
      hora: '11:00',
      ...extra,
    });
const contarCitas = async () => (await pool.query('SELECT COUNT(*)::int AS n FROM citas')).rows[0].n;
const contarLineas = async () => (await pool.query('SELECT COUNT(*)::int AS n FROM cita_servicios')).rows[0].n;

// Citas ocupadas de antemano (pendientes). Las de un asesor llevan un servicio de asesoría (el trigger lo exige).
const ocupar = (profesional, hora, { servicio = CORTE_1, duracion = 30 } = {}) =>
  insertarCita({ fecha: FECHA, hora, barbero_id: profesional, estado: 'pendiente', servicio_id: servicio, duracion_min: duracion });
const ocuparBarberos = async (hora, duracion = 30) => {
  for (const id of [1, 2]) await ocupar(id, hora, { servicio: CORTE_1, duracion });
};
const ocuparAsesores = async (hora, duracion = 30) => {
  for (const id of [A1, A2]) await ocupar(id, hora, { servicio: ASES_A, duracion });
};

const citasDeReserva = async (reservaId) =>
  (
    await pool.query(
      `SELECT id, barbero_id, TO_CHAR(hora, 'HH24:MI') AS hora, duracion_min, precio, servicio_id, estado,
              reserva_id::text AS reserva_id, lower(rango) AS inicio, upper(rango) AS fin
       FROM citas WHERE reserva_id = $1 ORDER BY hora`,
      [reservaId]
    )
  ).rows;
const lineasDeCita = async (citaId) =>
  (await pool.query('SELECT servicio_id, orden, nombre, duracion_min, precio FROM cita_servicios WHERE cita_id = $1 ORDER BY orden', [citaId])).rows;

describe('esAsesoriaGratis', () => {
  it('se decide por clave_seed, no por nombre ni precio', () => {
    expect(esAsesoriaGratis({ clave_seed: 'asesoria-gratis' })).toBe(true);
    expect(esAsesoriaGratis({ clave_seed: 'asesoria-premium', precio: 0, nombre: 'Asesoría gratis' })).toBe(false);
    expect(esAsesoriaGratis({ clave_seed: null, precio: 0 })).toBe(false);
    expect(esAsesoriaGratis(undefined)).toBe(false);
  });
});

describe('GET /api/disponibilidad: solo barbería', () => {
  it('conserva la forma de siempre (sin asesor_id) y el pool son solo los barberos de barbería', async () => {
    const res = await disp({ servicios: String(CORTE_1) });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['barbero_id', 'fecha', 'horas']);
    expect(res.body.barbero_id).toBeNull();
    expect(res.body.horas[0]).toBe('10:00');
  });

  it('"cualquier barbero" nunca usa a un asesor: con los dos barberos ocupados, esa hora no se ofrece aunque los asesores estén libres', async () => {
    await ocuparBarberos('11:00');
    const res = await disp({ servicios: String(CORTE_1) });
    expect(res.body.horas).not.toContain('11:00');
    expect(res.body.horas).toContain('10:30');
    expect(res.body.horas).toContain('11:30');
  });

  it('barbero=<id> sigue funcionando y responde barbero_id', async () => {
    await ocupar(1, '11:00');
    const uno = await disp({ servicio: CORTE_1, barbero: 1 });
    const dos = await disp({ servicio: CORTE_1, barbero: 2 });
    expect(uno.body).toMatchObject({ barbero_id: 1 });
    expect(uno.body.horas).not.toContain('11:00');
    expect(dos.body.horas).toContain('11:00');
  });
});

describe('GET /api/disponibilidad: solo asesoría', () => {
  it('responde asesor_id null y barbero_id null; el pool son los asesores activos', async () => {
    const res = await disp({ servicios: String(ASES_A) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ barbero_id: null, asesor_id: null });
    expect(res.body.horas[0]).toBe('10:00');
    expect(res.body.horas).toContain('19:30'); // 30 min: el último inicio es 19:30
    expect(res.body.horas).not.toContain('20:00');
  });

  it('"cualquier asesor" nunca usa a un barbero: con los dos asesores ocupados, esa hora no se ofrece aunque los barberos estén libres', async () => {
    await ocuparAsesores('11:00');
    const res = await disp({ servicios: String(ASES_A) });
    expect(res.body.horas).not.toContain('11:00');
    expect(res.body.horas).toContain('10:30');
    expect(res.body.horas).toContain('11:30');
  });

  it('basta con un asesor libre; un asesor concreto ocupado no ofrece esa hora pero el otro sí', async () => {
    await ocupar(A1, '11:00', { servicio: ASES_A });
    const cualquiera = await disp({ servicios: String(ASES_A) });
    const uno = await disp({ servicios: String(ASES_A), asesor: A1 });
    const dos = await disp({ servicios: String(ASES_A), asesor: A2 });
    expect(cualquiera.body.horas).toContain('11:00');
    expect(uno.body).toMatchObject({ asesor_id: A1, barbero_id: null });
    expect(uno.body.horas).not.toContain('11:00');
    expect(dos.body).toMatchObject({ asesor_id: A2 });
    expect(dos.body.horas).toContain('11:00');
  });

  it('usa la duración de la asesoría: 45 min se solapa con una cita que empieza 30 min después y no cabe a las 19:30', async () => {
    await ocupar(A1, '11:30', { servicio: ASES_A });
    await ocupar(A2, '11:30', { servicio: ASES_A });
    const res = await disp({ servicios: String(ASES_B) });
    expect(res.body.horas).not.toContain('11:00'); // [11:00, 11:45) choca con la de 11:30
    expect(res.body.horas).toContain('10:30'); // [9:30, 11:15) cabe
    expect(res.body.horas).toContain('19:00'); // termina 19:45
    expect(res.body.horas).not.toContain('19:30'); // terminaría 20:15, pasa del cierre
  });

  it('un asesor inactivo no cuenta; sin asesores activos no hay horas', async () => {
    await pool.query('UPDATE barberos SET activo = false WHERE id = ANY($1::int[])', [[A1, A2]]);
    const res = await disp({ servicios: String(ASES_A) });
    expect(res.status).toBe(200);
    expect(res.body.horas).toEqual([]);
  });
});

describe('GET /api/disponibilidad: asesoría + barbería', () => {
  const combo = `${ASES_A},${CORTE_1}`; // 30 + 30

  it('responde asesor_id y barbero_id null, y la hora es la de inicio de la asesoría', async () => {
    const res = await disp({ servicios: combo });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ asesor_id: null, barbero_id: null });
    expect(res.body.horas[0]).toBe('10:00');
  });

  it('el corte empieza cuando termina la asesoría: el barbero puede estar ocupado MIENTRAS dura la asesoría', async () => {
    await ocuparBarberos('11:00'); // ocupados 11:00-11:30
    const res = await disp({ servicios: combo });
    // t=11:00 → asesoría 11:00-11:30 (asesor libre) y corte 11:30-12:00 (barbero libre): se ofrece.
    expect(res.body.horas).toContain('11:00');
    // t=10:30 → corte 11:00-11:30 con los dos barberos ocupados: no.
    expect(res.body.horas).not.toContain('10:30');
  });

  it('cadena rota 1: asesor libre pero barberos ocupados justo cuando termina la asesoría', async () => {
    await ocuparBarberos('11:30');
    const res = await disp({ servicios: combo });
    expect(res.body.horas).not.toContain('11:00'); // asesor libre 11:00-11:30, pero el corte de 11:30 no tiene barbero
    expect(res.body.horas).toContain('11:30'); // asesoría 11:30-12:00, corte 12:00-12:30
    expect(res.body.horas).toContain('10:30'); // asesoría 9:30-11:00, corte 11:00-11:30
  });

  it('cadena rota 2: barbero libre pero asesores ocupados al inicio', async () => {
    await ocuparAsesores('11:00');
    const res = await disp({ servicios: combo });
    expect(res.body.horas).not.toContain('11:00');
    expect(res.body.horas).toContain('10:30');
    expect(res.body.horas).toContain('11:30');
  });

  it('basta con UN asesor libre y UN barbero libre, aunque sean distintos en cada hora', async () => {
    await ocupar(A1, '11:00', { servicio: ASES_A });
    await ocupar(1, '11:30', { servicio: CORTE_1 });
    const res = await disp({ servicios: combo });
    expect(res.body.horas).toContain('11:00'); // A2 y el barbero 2
  });

  it('respeta el cierre con la duración total encadenada (30 + 30 = 60: el último inicio es 19:00)', async () => {
    const res = await disp({ servicios: combo });
    expect(res.body.horas).toContain('19:00');
    expect(res.body.horas).not.toContain('19:30');
  });

  it('con un corte largo (30 + 120): el último inicio es 17:30', async () => {
    const res = await disp({ servicios: `${ASES_A},${CORTE_LARGO_A}` });
    expect(res.body.horas).toContain('17:30');
    expect(res.body.horas).not.toContain('18:00');
  });

  it('hoy no ofrece horas pasadas (se mide sobre el inicio de la asesoría)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-07-17T18:00:00Z')); // 13:00 en Bogotá
    const res = await disp({ servicios: combo });
    expect(res.status).toBe(200);
    expect(res.body.horas).not.toContain('13:00');
    expect(res.body.horas).not.toContain('10:00');
    expect(res.body.horas[0]).toBe('13:30');
  });

  it('asesor= concreto: solo ese asesor cuenta y se devuelve en la respuesta', async () => {
    await ocupar(A1, '11:00', { servicio: ASES_A });
    const uno = await disp({ servicios: combo, asesor: A1 });
    const dos = await disp({ servicios: combo, asesor: A2 });
    expect(uno.body).toMatchObject({ asesor_id: A1, barbero_id: null });
    expect(uno.body.horas).not.toContain('11:00');
    expect(dos.body.horas).toContain('11:00');
  });

  it('barbero= concreto: solo ese barbero cuenta (y el corte se mide desde el fin de la asesoría)', async () => {
    await ocupar(1, '11:30', { servicio: CORTE_1 });
    const uno = await disp({ servicios: combo, barbero: 1 });
    const dos = await disp({ servicios: combo, barbero: 2 });
    expect(uno.body).toMatchObject({ barbero_id: 1, asesor_id: null });
    expect(uno.body.horas).not.toContain('11:00');
    expect(dos.body.horas).toContain('11:00');
  });

  it('asesor= y barbero= a la vez', async () => {
    await ocupar(A1, '10:00', { servicio: ASES_A });
    await ocupar(2, '11:30', { servicio: CORTE_1 });
    const res = await disp({ servicios: combo, asesor: A1, barbero: 2 });
    expect(res.body).toMatchObject({ asesor_id: A1, barbero_id: 2 });
    expect(res.body.horas).not.toContain('10:00'); // el asesor está ocupado
    expect(res.body.horas).not.toContain('11:00'); // el barbero está ocupado de 11:30 a 12:00
    expect(res.body.horas).toContain('10:30');
    expect(res.body.horas).toContain('11:30');
  });

  it('el orden de los ids no importa: el área de cada servicio sale de la base', async () => {
    const a = await disp({ servicios: `${CORTE_1},${ASES_A}` });
    const b = await disp({ servicios: combo });
    expect(a.body).toEqual(b.body);
  });

  it('asesoría + dos cortes (3 servicios): el corte dura la suma de los dos', async () => {
    await ocuparBarberos('12:00');
    const res = await disp({ servicios: `${ASES_A},${CORTE_1},${CORTE_2}` }); // 30 + 60
    expect(res.body.horas).not.toContain('11:30'); // corte 12:00-13:00 choca con los ocupados de 12:00
    expect(res.body.horas).not.toContain('11:00'); // corte 11:30-12:30 también
    expect(res.body.horas).toContain('10:30'); // corte 11:00-12:00 cabe
  });
});

describe('GET /api/disponibilidad: validaciones', () => {
  it('asesor= de un barbero de barbería → 400 PROFESIONAL_INCOMPATIBLE (campo asesor)', async () => {
    const res = await disp({ servicios: String(ASES_A), asesor: 1 });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'PROFESIONAL_INCOMPATIBLE', campo: 'asesor' });
  });

  it('barbero= de un asesor → 400 PROFESIONAL_INCOMPATIBLE (campo barbero), también en una combinada', async () => {
    const solo = await disp({ servicios: String(CORTE_1), barbero: A1 });
    const combinada = await disp({ servicios: `${ASES_A},${CORTE_1}`, barbero: A1 });
    for (const res of [solo, combinada]) {
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ codigo: 'PROFESIONAL_INCOMPATIBLE', campo: 'barbero' });
    }
  });

  it('un profesional del área equivocada para esos servicios también es incompatible (barbero= con solo asesoría, asesor= con solo cortes)', async () => {
    const a = await disp({ servicios: String(ASES_A), barbero: 1 });
    const b = await disp({ servicios: String(CORTE_1), asesor: A1 });
    expect(a.status).toBe(400);
    expect(a.body).toMatchObject({ codigo: 'PROFESIONAL_INCOMPATIBLE', campo: 'barbero' });
    expect(b.status).toBe(400);
    expect(b.body).toMatchObject({ codigo: 'PROFESIONAL_INCOMPATIBLE', campo: 'asesor' });
  });

  it('asesor inexistente o inactivo → 404; no numérico → 400', async () => {
    expect((await disp({ servicios: String(ASES_A), asesor: 987654 })).status).toBe(404);
    await pool.query('UPDATE barberos SET activo = false WHERE id = $1', [A1]);
    expect((await disp({ servicios: String(ASES_A), asesor: A1 })).status).toBe(404);
    const malo = await disp({ servicios: String(ASES_A), asesor: 'abc' });
    expect(malo.status).toBe(400);
    expect((await disp({ servicios: String(ASES_A), asesor: [A1, A2] })).status).toBe(400);
  });

  it('LIMITE_ASESORIAS: más de una asesoría → 400', async () => {
    const res = await disp({ servicios: `${ASES_A},${ASES_B}` });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'LIMITE_ASESORIAS', maximo: 1 });
    const conCorte = await disp({ servicios: `${ASES_A},${ASES_B},${CORTE_1}` });
    expect(conCorte.body.codigo).toBe('LIMITE_ASESORIAS');
  });

  it('los códigos existentes siguen igual: LIMITE_SERVICIOS, SERVICIOS_REPETIDOS, SERVICIO_NO_DISPONIBLE', async () => {
    expect((await disp({ servicios: `${ASES_A},${CORTE_1},${CORTE_2},${CORTE_LARGO_A}` })).body.codigo).toBe('LIMITE_SERVICIOS');
    expect((await disp({ servicios: `${CORTE_1},${CORTE_1}` })).body.codigo).toBe('SERVICIOS_REPETIDOS');
    expect((await disp({ servicios: `${CORTE_1},987654` })).body.codigo).toBe('SERVICIO_NO_DISPONIBLE');
    expect((await disp({ servicio: 987654 })).status).toBe(404);
  });

  it('tope de 240 min POR CITA: dos servicios de barbería que suman 250 → DURACION_EXCEDIDA', async () => {
    const res = await disp({ servicios: `${CORTE_LARGO_A},${CORTE_LARGO_B}` });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'DURACION_EXCEDIDA', duracion_total_min: 250, maximo_min: 240 });
  });

  it('el tope NO suma asesoría + corte: 300 + 30 min se ofrece (solo lo limita el horario de atención)', async () => {
    const res = await disp({ servicios: `${ASES_LARGA},${CORTE_1}` });
    expect(res.status).toBe(200);
    expect(res.body.horas).toContain('10:00');
    expect(res.body.horas).toContain('14:30'); // 330 min → 20:00
    expect(res.body.horas).not.toContain('15:00');
  });

  it('la asesoría gratis se ofrece como cualquier otra (sola o en combo): la disponibilidad no necesita identidad', async () => {
    for (const query of [{ servicios: String(GRATIS) }, { servicios: `${GRATIS},${CORTE_1}` }, { servicio: GRATIS }]) {
      const res = await disp(query);
      expect(res.status).toBe(200);
      expect(res.body.horas).toContain('11:00');
    }
  });
});

describe('GET /api/disponibilidad: costo', () => {
  it.each([
    ['solo barbería', { servicios: String(CORTE_1) }],
    ['solo barbería con barbero=', { servicios: String(CORTE_1), barbero: 1 }],
    ['solo asesoría', { servicios: String(ASES_A) }],
    ['asesoría + barbería', { servicios: `${ASES_A},${CORTE_1}` }],
    ['asesoría + barbería con asesor= y barbero=', { servicios: `${ASES_A},${CORTE_1}`, asesor: A1, barbero: 1 }],
  ])('%s: como máximo 3 consultas (servicios, profesionales, citas ocupadas)', async (_nombre, query) => {
    const espia = vi.spyOn(pool, 'query');
    try {
      const res = await disp(query);
      expect(res.status).toBe(200);
      expect(espia.mock.calls.length).toBeLessThanOrEqual(3);
    } finally {
      espia.mockRestore();
    }
  });
});

describe('POST /api/citas: una sola cita', () => {
  it('asesoría sola: una cita con un asesor, respuesta plana y reserva_id NULL', async () => {
    const res = await reservar({ servicio_id: ASES_A });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      servicio_id: ASES_A,
      duracion_min: 30,
      precio: 60000,
      estado: 'pendiente',
      servicio_nombre: 'Reserva asesoría A',
    });
    expect([A1, A2]).toContain(res.body.barbero_id);
    expect(res.body.barbero_nombre).toMatch(/^Reserva Asesor/);
    expect(res.body.servicios).toEqual([{ id: ASES_A, nombre: 'Reserva asesoría A', duracion_min: 30, precio: 60000 }]);
    expect(res.body).not.toHaveProperty('citas');
    expect(res.body).not.toHaveProperty('reserva_id');
    const { rows } = await pool.query('SELECT reserva_id FROM citas WHERE id = $1', [res.body.id]);
    expect(rows[0].reserva_id).toBeNull();
    expect(await contarCitas()).toBe(1);
    expect(await contarLineas()).toBe(1);
  });

  it('asesoría sola con asesor_id concreto', async () => {
    const res = await reservar({ servicios_ids: [ASES_B], asesor_id: A2 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ barbero_id: A2, duracion_min: 45, precio: 45000 });
  });

  it('un corte solo (formato anterior servicio_id y servicios_ids) sigue igual y con reserva_id NULL', async () => {
    const a = await reservar({ servicio_id: CORTE_1 });
    const b = await reservar({ servicios_ids: [CORTE_1, CORTE_2], hora: '12:00', correo: 'otro@example.com' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect([1, 2]).toContain(a.body.barbero_id);
    expect(b.body).toMatchObject({ duracion_min: 60, precio: 35000, servicio_id: CORTE_1 });
    expect(b.body).not.toHaveProperty('citas');
    const { rows } = await pool.query('SELECT reserva_id FROM citas');
    expect(rows.every((fila) => fila.reserva_id === null)).toBe(true);
  });

  it('asignación automática de asesor: no usa a un barbero aunque estén libres; con los asesores ocupados → 409 y nada nuevo', async () => {
    await ocuparAsesores('11:00');
    const antes = await contarCitas();
    const res = await reservar({ servicio_id: ASES_A, hora: '11:00' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/asesores/);
    expect(await contarCitas()).toBe(antes);
  });

  it('asignación automática de barbero: no usa a un asesor aunque estén libres; con los barberos ocupados → 409 y nada nuevo', async () => {
    await ocuparBarberos('11:00');
    const antes = await contarCitas();
    const res = await reservar({ servicio_id: CORTE_1, hora: '11:00' });
    expect(res.status).toBe(409);
    expect(await contarCitas()).toBe(antes);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM citas WHERE barbero_id = ANY($1::int[])', [[A1, A2]])).rows[0].n).toBe(0);
  });

  it('asesor concreto ocupado → 409 con mensaje de asesor', async () => {
    await ocupar(A1, '11:00', { servicio: ASES_A });
    const res = await reservar({ servicio_id: ASES_A, asesor_id: A1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/asesor/);
  });

  it('el contacto se valida igual que siempre', async () => {
    expect((await reservar({ servicio_id: ASES_A, telefono: '123' })).status).toBe(400);
    expect((await reservar({ servicio_id: ASES_A, consentimiento: false })).status).toBe(400);
    expect((await reservar({ servicio_id: ASES_A, correo: 'x' })).status).toBe(400);
    expect(await contarCitas()).toBe(0);
  });
});

describe('POST /api/citas: reserva combinada (asesoría + barbería)', () => {
  it('crea DOS citas con el mismo reserva_id: la asesoría primero y el corte justo después', async () => {
    const res = await reservar({ servicios_ids: [ASES_A, CORTE_1] });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(['citas', 'reserva_id']);
    expect(res.body.reserva_id).toMatch(/^[0-9a-f-]{36}$/);
    const [asesoria, corte] = res.body.citas;

    expect([A1, A2]).toContain(asesoria.barbero_id);
    expect([1, 2]).toContain(corte.barbero_id);
    expect(asesoria).toMatchObject({ servicio_id: ASES_A, hora: '11:00:00', duracion_min: 30, precio: 60000, reserva_id: res.body.reserva_id });
    expect(corte).toMatchObject({ servicio_id: CORTE_1, hora: '11:30:00', duracion_min: 30, precio: 20000, reserva_id: res.body.reserva_id });
    expect(asesoria.servicios).toEqual([{ id: ASES_A, nombre: 'Reserva asesoría A', duracion_min: 30, precio: 60000 }]);
    expect(corte.servicios).toEqual([{ id: CORTE_1, nombre: 'Reserva corte 1', duracion_min: 30, precio: 20000 }]);
    expect(asesoria.barbero_nombre).toMatch(/^Reserva Asesor/);
    expect(corte.barbero_nombre).toMatch(/^Barbero/);

    // Lo guardado: contiguas (el fin de una es el inicio de la otra), sin hueco ni solape, con sus líneas.
    const filas = await citasDeReserva(res.body.reserva_id);
    expect(filas).toHaveLength(2);
    expect(filas[0].fin.getTime()).toBe(filas[1].inicio.getTime());
    expect(await lineasDeCita(asesoria.id)).toEqual([{ servicio_id: ASES_A, orden: 1, nombre: 'Reserva asesoría A', duracion_min: 30, precio: 60000 }]);
    expect(await lineasDeCita(corte.id)).toEqual([{ servicio_id: CORTE_1, orden: 1, nombre: 'Reserva corte 1', duracion_min: 30, precio: 20000 }]);
  });

  it('la asesoría va primero aunque el cliente liste el corte antes; la duración de la asesoría desplaza el corte (45 min → 11:45)', async () => {
    const res = await reservar({ servicios_ids: [CORTE_1, ASES_B] });
    expect(res.status).toBe(201);
    const [asesoria, corte] = res.body.citas;
    expect(asesoria).toMatchObject({ servicio_id: ASES_B, hora: '11:00:00', duracion_min: 45 });
    expect(corte).toMatchObject({ servicio_id: CORTE_1, hora: '11:45:00' });
  });

  it('con DOS servicios de barbería: el corte suma sus líneas, renumera el orden y su principal es el primero pedido', async () => {
    const res = await reservar({ servicios_ids: [CORTE_2, ASES_A, CORTE_1] });
    expect(res.status).toBe(201);
    const [asesoria, corte] = res.body.citas;
    expect(asesoria).toMatchObject({ servicio_id: ASES_A, duracion_min: 30, precio: 60000 });
    expect(corte).toMatchObject({ servicio_id: CORTE_2, hora: '11:30:00', duracion_min: 60, precio: 35000 });
    expect(corte.servicio_nombre).toBe('Reserva corte 2 + Reserva corte 1');
    expect(corte.servicios.map((s) => s.id)).toEqual([CORTE_2, CORTE_1]);
    const lineas = await lineasDeCita(corte.id);
    expect(lineas.map((l) => [l.servicio_id, l.orden])).toEqual([[CORTE_2, 1], [CORTE_1, 2]]);
    expect(await lineasDeCita(asesoria.id)).toHaveLength(1);
    expect(await contarLineas()).toBe(3);
    expect(await contarCitas()).toBe(2);
  });

  it('asesor_id y barbero_id concretos se respetan', async () => {
    const res = await reservar({ servicios_ids: [ASES_A, CORTE_1], asesor_id: A2, barbero_id: 2 });
    expect(res.status).toBe(201);
    expect(res.body.citas.map((c) => c.barbero_id)).toEqual([A2, 2]);
  });

  it('asigna por pool: el barbero ocupado mientras dura la asesoría no estorba, y el ocupado al terminar sí se evita', async () => {
    await ocupar(1, '11:30', { servicio: CORTE_1 }); // el barbero 1 está ocupado cuando empezaría el corte
    const res = await reservar({ servicios_ids: [ASES_A, CORTE_1] });
    expect(res.status).toBe(201);
    expect(res.body.citas[1].barbero_id).toBe(2);
  });

  it('el barbero se busca en la ventana del CORTE (al terminar la asesoría), no en la de la asesoría', async () => {
    await ocupar(1, '11:00', { servicio: CORTE_1 }); // ocupado mientras dura la asesoría: no importa
    await ocupar(2, '11:30', { servicio: CORTE_1 }); // ocupado cuando empieza el corte: no sirve
    const res = await reservar({ servicios_ids: [ASES_A, CORTE_1] });
    expect(res.status).toBe(201);
    expect(res.body.citas[1].barbero_id).toBe(1);
  });

  it('con los barberos ocupados al terminar la asesoría → 409 y no queda ni la asesoría', async () => {
    await ocuparBarberos('11:30');
    const antes = await contarCitas();
    const res = await reservar({ servicios_ids: [ASES_A, CORTE_1] });
    expect(res.status).toBe(409);
    expect(await contarCitas()).toBe(antes);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM citas WHERE barbero_id = ANY($1::int[])', [[A1, A2]])).rows[0].n).toBe(0);
  });

  it('con los asesores ocupados al inicio → 409 y no se toca a ningún barbero', async () => {
    await ocuparAsesores('11:00');
    const antes = await contarCitas();
    const res = await reservar({ servicios_ids: [ASES_A, CORTE_1] });
    expect(res.status).toBe(409);
    expect(await contarCitas()).toBe(antes);
  });

  it('fuera de horario: 30 + 30 a las 19:30 → 400, a las 19:00 cabe', async () => {
    const tarde = await reservar({ servicios_ids: [ASES_A, CORTE_1], hora: '19:30' });
    expect(tarde.status).toBe(400);
    expect(tarde.body.error).toMatch(/no caben/);
    expect(await contarCitas()).toBe(0);
    const justo = await reservar({ servicios_ids: [ASES_A, CORTE_1], hora: '19:00' });
    expect(justo.status).toBe(201);
    expect(justo.body.citas[1].hora).toBe('19:30:00');
  });

  it('los totales del cliente se ignoran: la duración y el precio salen de la base', async () => {
    const res = await reservar({ servicios_ids: [ASES_A, CORTE_1], precio: 1, duracion_min: 5, area: 'barberia', reserva_id: 'x' });
    expect(res.status).toBe(201);
    expect(res.body.citas.map((c) => [c.duracion_min, c.precio])).toEqual([[30, 60000], [30, 20000]]);
  });
});

describe('POST /api/citas: errores', () => {
  it.each([
    ['asesor_id de un barbero de barbería', { servicios_ids: [ASES_A], asesor_id: 1 }, 'asesor_id'],
    ['barbero_id de un asesor', { servicios_ids: [CORTE_1], barbero_id: A1 }, 'barbero_id'],
    ['barbero_id de un asesor en una combinada', { servicios_ids: [ASES_A, CORTE_1], barbero_id: A1 }, 'barbero_id'],
    ['asesor_id de un barbero en una combinada', { servicios_ids: [ASES_A, CORTE_1], asesor_id: 1 }, 'asesor_id'],
    ['barbero_id con solo asesoría', { servicios_ids: [ASES_A], barbero_id: 1 }, 'barbero_id'],
    ['asesor_id con solo cortes', { servicios_ids: [CORTE_1], asesor_id: A1 }, 'asesor_id'],
  ])('%s → 400 PROFESIONAL_INCOMPATIBLE y no se crea nada', async (_nombre, extra, campo) => {
    const res = await reservar(extra);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'PROFESIONAL_INCOMPATIBLE', campo });
    expect(await contarCitas()).toBe(0);
    expect(await contarLineas()).toBe(0);
  });

  it('asesor inexistente o inactivo → 400; id no numérico → 400', async () => {
    expect((await reservar({ servicios_ids: [ASES_A], asesor_id: 987654 })).status).toBe(400);
    await pool.query('UPDATE barberos SET activo = false WHERE id = $1', [A1]);
    expect((await reservar({ servicios_ids: [ASES_A], asesor_id: A1 })).status).toBe(400);
    const malo = await reservar({ servicios_ids: [ASES_A], asesor_id: 'abc' });
    expect(malo.status).toBe(400);
    expect(await contarCitas()).toBe(0);
  });

  it('LIMITE_ASESORIAS: dos asesorías (solas o con un corte) → 400', async () => {
    for (const ids of [[ASES_A, ASES_B], [ASES_A, ASES_B, CORTE_1]]) {
      const res = await reservar({ servicios_ids: ids });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ codigo: 'LIMITE_ASESORIAS', maximo: 1 });
    }
    expect(await contarCitas()).toBe(0);
  });

  it('los códigos existentes siguen igual: LIMITE_SERVICIOS, SERVICIOS_REPETIDOS, SERVICIO_NO_DISPONIBLE, DURACION_EXCEDIDA', async () => {
    expect((await reservar({ servicios_ids: [ASES_A, CORTE_1, CORTE_2, CORTE_LARGO_A] })).body.codigo).toBe('LIMITE_SERVICIOS');
    expect((await reservar({ servicios_ids: [CORTE_1, CORTE_1] })).body.codigo).toBe('SERVICIOS_REPETIDOS');
    expect((await reservar({ servicios_ids: [CORTE_1, 987654] })).body.codigo).toBe('SERVICIO_NO_DISPONIBLE');
    const largo = await reservar({ servicios_ids: [CORTE_LARGO_A, CORTE_LARGO_B] });
    expect(largo.body).toMatchObject({ codigo: 'DURACION_EXCEDIDA', duracion_total_min: 250 });
    expect(await contarCitas()).toBe(0);
  });

  it('el tope de 240 min es por cita: asesoría de 300 min + corte se reserva (cada profesional atiende solo la suya)', async () => {
    const res = await reservar({ servicios_ids: [ASES_LARGA, CORTE_1], hora: '10:00' });
    expect(res.status).toBe(201);
    expect(res.body.citas[0]).toMatchObject({ duracion_min: 300, hora: '10:00:00' });
    expect(res.body.citas[1]).toMatchObject({ hora: '15:00:00' });
  });

  it('la asesoría gratis ya se reserva, sola o combinada (su límite por persona se prueba en asesoriaGratis.test.js)', async () => {
    const sola = await reservar({ servicios_ids: [GRATIS], correo: 'uno@example.com', telefono: '3001111111' });
    expect(sola.status).toBe(201);
    expect(sola.body).toMatchObject({ servicio_id: GRATIS, precio: 0, duracion_min: 15 });
    const combinada = await reservar({ servicios_ids: [GRATIS, CORTE_1], correo: 'dos@example.com', telefono: '3002222222', hora: '13:00' });
    expect(combinada.status).toBe(201);
    expect(combinada.body.citas).toHaveLength(2);
  });
});

// Falla provocada en un INSERT concreto: se intercepta la conexión de la transacción y, justo antes de ese INSERT, OTRA
// conexión (pool lateral, fuera de la transacción) inserta una cita que choca. Así el fallo es el real de la base (23P01).
let alInsertar = null; // async (parametros) => void: se ejecuta justo antes de cada INSERT INTO citas de la transacción
let antesDeCommit = null; // async () => void: justo antes del COMMIT
const instalarEspia = () => {
  const original = pool.connect.bind(pool);
  return vi.spyOn(pool, 'connect').mockImplementation((alTerminar) => {
    if (typeof alTerminar === 'function') return original(alTerminar); // pool.query usa la forma con callback
    return original().then((cliente) => {
      if (!cliente.espiado) {
        cliente.espiado = true; // se envuelve una sola vez por conexión; lo que hace lo decide `alInsertar`
        const consultar = cliente.query.bind(cliente);
        cliente.query = async (...args) => {
          if (alInsertar && typeof args[0] === 'string' && args[0].includes('INSERT INTO citas')) await alInsertar(args[1]);
          if (antesDeCommit && args[0] === 'COMMIT') await antesDeCommit();
          return consultar(...args);
        };
      }
      return cliente;
    });
  });
};

describe('POST /api/citas: atomicidad y reintentos por etapa', () => {
  let lateral;
  let espia;

  beforeEach(() => {
    lateral = new pg.Pool(credenciales());
    espia = instalarEspia();
  });

  afterEach(async () => {
    alInsertar = null;
    antesDeCommit = null;
    espia.mockRestore();
    await lateral.end();
  });

  const chocar = async (barberoId, hora, servicioId) => {
    const { rows } = await lateral.query(
      `INSERT INTO citas (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado)
       VALUES ('Choque', 'c@example.com', '3001234567', $1, $2, $3, $4, 30, 0, 'pendiente') RETURNING id`,
      [servicioId, barberoId, FECHA, hora]
    );
    await lateral.query(
      `INSERT INTO cita_servicios (cita_id, servicio_id, orden, nombre, duracion_min, precio) VALUES ($1, $2, 1, 'Choque', 30, 0)`,
      [rows[0].id, servicioId]
    );
  };

  it('ROLLBACK TOTAL: si falla la segunda cita no queda la primera (barbero concreto → 409)', async () => {
    const intentos = [];
    alInsertar = async (params) => {
      intentos.push(params[4]);
      if (intentos.length === 2) await chocar(1, '11:30', CORTE_2); // el barbero 1 se ocupa justo antes del INSERT del corte
    };

    const res = await reservar({ servicios_ids: [ASES_A, CORTE_1], asesor_id: A1, barbero_id: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/barbero/);
    expect(intentos).toEqual([A1, 1]); // se llegó a insertar la asesoría y falló el corte
    // Solo existe la cita del choque (con su línea): ni la asesoría ni líneas huérfanas.
    expect(await contarCitas()).toBe(1);
    expect(await contarLineas()).toBe(1);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM citas WHERE barbero_id = $1', [A1])).rows[0].n).toBe(0);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM citas WHERE reserva_id IS NOT NULL')).rows[0].n).toBe(0);
  });

  it('si falla el corte con barbero automático, avanza SOLO el barbero (el asesor se conserva) y todo queda coherente', async () => {
    const intentos = [];
    alInsertar = async (params) => {
      intentos.push(params[4]);
      if (intentos.length === 2) await chocar(1, '11:30', CORTE_2);
    };

    const res = await reservar({ servicios_ids: [ASES_A, CORTE_1] });
    expect(res.status).toBe(201);
    expect(res.body.citas.map((c) => c.barbero_id)).toEqual([A1, 2]);
    expect(intentos).toEqual([A1, 1, A1, 2]); // 1.er intento (A1, barbero 1) falló en el corte; 2.º: mismo asesor, siguiente barbero
    expect(await contarCitas()).toBe(3); // choque + las dos de la reserva (la primera asesoría se deshizo)
    expect((await citasDeReserva(res.body.reserva_id))).toHaveLength(2);
    expect(await contarLineas()).toBe(3);
  });

  it('si falla la asesoría con asesor automático, avanza SOLO el asesor (el barbero se conserva)', async () => {
    const intentos = [];
    alInsertar = async (params) => {
      intentos.push(params[4]);
      if (intentos.length === 1) await chocar(A1, '11:00', ASES_A); // el asesor 1 se ocupa antes del primer INSERT
    };

    const res = await reservar({ servicios_ids: [ASES_A, CORTE_1] });
    expect(res.status).toBe(201);
    expect(res.body.citas.map((c) => c.barbero_id)).toEqual([A2, 1]);
    expect(intentos).toEqual([A1, A2, 1]);
  });

  it('si todos los candidatos de un lado fallan → 409 y no queda nada de la reserva', async () => {
    alInsertar = async (params) => {
      // cada vez que se intenta insertar un corte, se ocupa ese barbero justo antes
      if (params[4] === 1 || params[4] === 2) await chocar(params[4], '11:30', CORTE_2).catch(() => {});
    };
    const res = await reservar({ servicios_ids: [ASES_A, CORTE_1] });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/barberos/);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM citas WHERE reserva_id IS NOT NULL')).rows[0].n).toBe(0);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM citas WHERE barbero_id = ANY($1::int[])', [[A1, A2]])).rows[0].n).toBe(0);
  });

  it('el error del trigger al COMMIT en una combinada llega como 400 PROFESIONAL_INCOMPATIBLE (nunca "horario ocupado")', async () => {
    // Antes del COMMIT, otra conexión convierte al barbero 1 en asesor: el trigger diferido lo rechaza.
    antesDeCommit = () => lateral.query("UPDATE barberos SET area = 'asesoria' WHERE id = 1");
    try {
      const res = await reservar({ servicios_ids: [ASES_A, CORTE_1], barbero_id: 1 });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ codigo: 'PROFESIONAL_INCOMPATIBLE', campo: 'profesional' });
      expect(await contarCitas()).toBe(0);
      expect(await contarLineas()).toBe(0);
    } finally {
      antesDeCommit = null;
      await lateral.query("UPDATE barberos SET area = 'barberia' WHERE id = 1");
    }
  });
});

describe('POST /api/citas: concurrencia', () => {
  it('dos reservas simultáneas del mismo asesor y hora: una gana (201) y la otra recibe el conflicto de horario (409)', async () => {
    for (let ronda = 0; ronda < 3; ronda += 1) {
      await limpiar();
      const [a, b] = await Promise.all([
        reservar({ servicios_ids: [ASES_A], asesor_id: A1, correo: 'a@example.com' }),
        reservar({ servicios_ids: [ASES_A], asesor_id: A1, correo: 'b@example.com' }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect((await pool.query('SELECT COUNT(*)::int AS n FROM citas WHERE barbero_id = $1', [A1])).rows[0].n).toBe(1);
    }
  });

  it('dos combinadas simultáneas que chocan SOLO en el barbero: una gana y la perdedora no deja ni su asesoría', async () => {
    for (let ronda = 0; ronda < 3; ronda += 1) {
      await limpiar();
      const [a, b] = await Promise.all([
        reservar({ servicios_ids: [ASES_A, CORTE_1], asesor_id: A1, barbero_id: 1, correo: 'a@example.com' }),
        reservar({ servicios_ids: [ASES_A, CORTE_1], asesor_id: A2, barbero_id: 1, correo: 'b@example.com' }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await contarCitas()).toBe(2); // solo la reserva ganadora
      const ganadora = [a, b].find((r) => r.status === 201);
      expect((await citasDeReserva(ganadora.body.reserva_id))).toHaveLength(2);
      expect((await pool.query('SELECT COUNT(*)::int AS n FROM citas WHERE barbero_id = ANY($1::int[])', [[A1, A2]])).rows[0].n).toBe(1);
    }
  });

  it('tres combinadas simultáneas con asignación automática (2 asesores, 2 barberos): dos ganan con profesionales distintos y la tercera recibe 409', async () => {
    const resultados = await Promise.all(
      [1, 2, 3].map((n) => reservar({ servicios_ids: [ASES_A, CORTE_1], correo: `n${n}@example.com` }))
    );
    const ganadoras = resultados.filter((r) => r.status === 201);
    expect(ganadoras).toHaveLength(2);
    expect(resultados.filter((r) => r.status === 409)).toHaveLength(1);
    expect(new Set(ganadoras.map((r) => r.body.citas[0].barbero_id)).size).toBe(2);
    expect(new Set(ganadoras.map((r) => r.body.citas[1].barbero_id)).size).toBe(2);
    expect(await contarCitas()).toBe(4);
  });
});

describe('EXCLUDE de reserva_id', () => {
  const insertarSuelta = (barberoId, hora, reservaId, servicioId = CORTE_1) =>
    pool.query(
      `INSERT INTO citas (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado, reserva_id)
       VALUES ('Reserva', 'c@example.com', '3001234567', $1, $2, $3, $4, 30, 0, 'pendiente', $5)`,
      [servicioId, barberoId, FECHA, hora, reservaId]
    );
  const RESERVA = '11111111-1111-4111-8111-111111111111';

  it('dos citas de la misma reserva no pueden solaparse en el tiempo (aunque sean de profesionales distintos)', async () => {
    await insertarSuelta(1, '11:00', RESERVA);
    await expect(insertarSuelta(2, '11:15', RESERVA)).rejects.toMatchObject({
      code: '23P01',
      constraint: 'citas_reserva_sin_autosolapamiento',
    });
    await insertarSuelta(2, '11:30', RESERVA); // contigua: sí
    expect(await contarCitas()).toBe(2);
  });

  it('una combinada creada por la API nunca se solapa consigo misma', async () => {
    const res = await reservar({ servicios_ids: [ASES_B, CORTE_1, CORTE_2] });
    const [a, b] = await citasDeReserva(res.body.reserva_id);
    expect(a.fin.getTime()).toBeLessThanOrEqual(b.inicio.getTime());
  });
});

describe('Cada profesional gestiona solo su cita', () => {
  it('el asesor cancela su asesoría sin tocar el corte; no puede tocar el corte; el barbero cancela el suyo', async () => {
    const reserva = await reservar({ servicios_ids: [ASES_A, CORTE_1], asesor_id: A1, barbero_id: 1 });
    const [asesoria, corte] = reserva.body.citas;
    const tokenAsesor = await tokenDe(A1);

    const ajena = await request(app).patch(`/api/citas/${corte.id}`).set(auth(tokenAsesor)).send({ estado: 'cancelada' });
    expect(ajena.status).toBe(404);

    const propia = await request(app).patch(`/api/citas/${asesoria.id}`).set(auth(tokenAsesor)).send({ estado: 'cancelada' });
    expect(propia.status).toBe(200);
    expect(propia.body.estado).toBe('cancelada');
    expect((await pool.query('SELECT estado FROM citas WHERE id = $1', [corte.id])).rows[0].estado).toBe('pendiente');

    const lista = await request(app).get('/api/citas').set(auth(tokenAsesor));
    expect(lista.body.map((c) => c.id)).toEqual([asesoria.id]);

    // La cancelada libera el hueco del asesor.
    const otra = await reservar({ servicios_ids: [ASES_A], asesor_id: A1, correo: 'otro@example.com' });
    expect(otra.status).toBe(201);
  });
});

describe('Reasignación del admin dentro de la misma área', () => {
  const reasignar = (citaId, barberoId) => request(app).patch(`/api/citas/${citaId}`).set(auth(admin)).send({ barbero_id: barberoId });

  it('una asesoría pasa a otro asesor libre (y conserva su reserva_id); si está ocupado → 409 por el EXCLUDE', async () => {
    const reserva = await reservar({ servicios_ids: [ASES_A, CORTE_1], asesor_id: A1, barbero_id: 1 });
    const asesoria = reserva.body.citas[0];

    const libre = await reasignar(asesoria.id, A2);
    expect(libre.status).toBe(200);
    expect(libre.body.barbero_id).toBe(A2);
    expect((await pool.query('SELECT reserva_id::text AS r FROM citas WHERE id = $1', [asesoria.id])).rows[0].r).toBe(reserva.body.reserva_id);

    await ocupar(A1, '11:00', { servicio: ASES_A });
    const ocupado = await reasignar(asesoria.id, A1);
    expect(ocupado.status).toBe(409);
  });

  it('un corte pasa a otro barbero libre; a uno ocupado → 409; a un asesor → 400 PROFESIONAL_INCOMPATIBLE', async () => {
    const reserva = await reservar({ servicios_ids: [ASES_A, CORTE_1], asesor_id: A1, barbero_id: 1 });
    const corte = reserva.body.citas[1];
    await ocupar(2, '11:30', { servicio: CORTE_1 });

    expect((await reasignar(corte.id, 2)).status).toBe(409);
    const incompatible = await reasignar(corte.id, A2);
    expect(incompatible.status).toBe(400);
    expect(incompatible.body).toMatchObject({ codigo: 'PROFESIONAL_INCOMPATIBLE', campo: 'barbero_id' });
    expect((await pool.query('SELECT barbero_id FROM citas WHERE id = $1', [corte.id])).rows[0].barbero_id).toBe(1);
  });
});

describe('Distinción de 23505 por restricción', () => {
  it('las UNIQUE de asesoria_gratis_usos no se confunden con "horario ocupado" (aún no se usan, la distinción queda lista)', async () => {
    const cita = await ocupar(1, '11:00');
    await pool.query(`INSERT INTO asesoria_gratis_usos (cita_id, correo_norm, telefono_norm) VALUES ($1, 'a@example.com', '3001234567')`, [cita]);
    const otra = await ocupar(2, '11:00');
    const error = await pool
      .query(`INSERT INTO asesoria_gratis_usos (cita_id, correo_norm, telefono_norm) VALUES ($1, 'a@example.com', '3009999999')`, [otra])
      .catch((err) => err);
    expect(error.code).toBe('23505');
    expect(error.constraint).toBe('asesoria_gratis_usos_correo_norm_key');
    expect(esConflictoDeHorario(error)).toBe(false);
  });
});
