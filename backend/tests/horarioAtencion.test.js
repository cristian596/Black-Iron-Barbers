import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { HORARIO_ATENCION } from '../config/horario.js';

// Horario de atención 10:00–20:00: POST /api/citas rechaza (400 FUERA_DE_HORARIO) lo que empiece antes de abrir o termine
// después de cerrar, y GET /api/disponibilidad solo ofrece inicios cuyo fin sea ≤ 20:00. Fixtures propios (ids 94xx).

const app = crearApp();
const FECHA = '2030-08-14';

const ASESOR = 9401; // asesor (area 'asesoria')
const ASES_30 = 9401; // asesoría de 30 min
const CORTE_30 = 9402;
const CORTE_45 = 9403;
const GRATIS = 9404; // asesoría gratis de 15 min (clave_seed)
const IDS_SERVICIOS = [ASES_30, CORTE_30, CORTE_45, GRATIS];

const limpiar = () => pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
const borrarDatosPrueba = async () => {
  await limpiar();
  await pool.query('DELETE FROM servicios WHERE id = ANY($1::int[])', [IDS_SERVICIOS]);
  await pool.query('DELETE FROM barberos WHERE id = $1', [ASESOR]);
};

beforeAll(async () => {
  await borrarDatosPrueba();
  await pool.query(
    `INSERT INTO barberos (id, nombre, cargo, especialidad, area) VALUES ($1, 'Horario Asesor', 'Asesor de Imagen', 'Asesoria', 'asesoria')`,
    [ASESOR]
  );
  await pool.query(
    `INSERT INTO servicios (id, nombre, duracion_min, precio, tipo, descripcion, area, clave_seed) VALUES
       ($1, 'Horario asesoría 30', 30, 60000, 'vip', 'x', 'asesoria', NULL),
       ($2, 'Horario corte 30', 30, 20000, 'original', 'x', 'barberia', NULL),
       ($3, 'Horario corte 45', 45, 25000, 'original', 'x', 'barberia', NULL),
       ($4, 'Horario asesoría gratis', 15, 0, 'original', 'x', 'asesoria', 'asesoria-gratis')`,
    IDS_SERVICIOS
  );
});

beforeEach(async () => {
  await limpiar();
  await pool.query('UPDATE barberos SET area = $1, activo = true WHERE id IN (1, 2)', ['barberia']);
});

afterAll(borrarDatosPrueba);

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
      servicios_ids: [CORTE_30],
      ...extra,
    });
const disp = (query) => request(app).get('/api/disponibilidad').query({ fecha: FECHA, ...query });
const contarCitas = async () => Number((await pool.query('SELECT COUNT(*) FROM citas')).rows[0].count);

describe('el horario configurado', () => {
  it('es 10:00–20:00 con rejilla de 30 min', () => {
    expect(HORARIO_ATENCION).toEqual({ apertura: '10:00', cierre: '20:00', intervaloMin: 30 });
  });
});

describe('POST /api/citas — horario de atención', () => {
  it('dentro de horario → 201', async () => {
    const res = await reservar({ hora: '14:00' });
    expect(res.status).toBe(201);
  });

  it('inicio exacto a la apertura (10:00) → 201', async () => {
    expect((await reservar({ hora: '10:00' })).status).toBe(201);
  });

  it('inicio 09:30 (antes de abrir) → 400 FUERA_DE_HORARIO y no crea nada', async () => {
    const res = await reservar({ hora: '09:30' });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('FUERA_DE_HORARIO');
    expect(await contarCitas()).toBe(0);
  });

  it('fin exacto a las 20:00 (19:30 + 30 min) → 201', async () => {
    const res = await reservar({ hora: '19:30' });
    expect(res.status).toBe(201);
    expect(res.body.hora).toBe('19:30:00');
  });

  it('fin 20:15 (19:30 + 45 min) → 400 FUERA_DE_HORARIO', async () => {
    const res = await reservar({ hora: '19:30', servicios_ids: [CORTE_45] });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('FUERA_DE_HORARIO');
    expect(await contarCitas()).toBe(0);
  });

  it('no exige alinearse a la rejilla de 30 min: 19:15 + 45 min termina justo a las 20:00', async () => {
    expect((await reservar({ hora: '19:15', servicios_ids: [CORTE_45] })).status).toBe(201);
  });

  it('un minuto más (19:16 + 45 min = 20:01) → 400', async () => {
    const res = await reservar({ hora: '19:16', servicios_ids: [CORTE_45] });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('FUERA_DE_HORARIO');
  });

  it('combinada cuyo corte termina pasadas las 20:00 → 400 y NO crea ninguna de las dos citas', async () => {
    // asesoría 19:30–20:00 y corte 20:00–20:30
    const res = await reservar({ hora: '19:30', servicios_ids: [ASES_30, CORTE_30] });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('FUERA_DE_HORARIO');
    expect(await contarCitas()).toBe(0);
  });

  it('combinada que termina exactamente a las 20:00 → 201 con las dos citas', async () => {
    const res = await reservar({ hora: '19:00', servicios_ids: [ASES_30, CORTE_30] });
    expect(res.status).toBe(201);
    expect(res.body.citas.map((c) => c.hora)).toEqual(['19:00:00', '19:30:00']);
    expect(await contarCitas()).toBe(2);
  });

  it('asesoría gratuita (15 min) seguida de corte: el corte empieza en :15 y se acepta', async () => {
    const res = await reservar({ hora: '10:00', servicios_ids: [GRATIS, CORTE_30] });
    expect(res.status).toBe(201);
    expect(res.body.citas.map((c) => c.hora)).toEqual(['10:00:00', '10:15:00']);
  });

  it('asesoría gratuita + corte con el corte en :45 también se acepta', async () => {
    const res = await reservar({ hora: '15:30', servicios_ids: [GRATIS, CORTE_30] });
    expect(res.status).toBe(201);
    expect(res.body.citas.map((c) => c.hora)).toEqual(['15:30:00', '15:45:00']);
  });

  it('asesoría gratuita + corte que se pasa de las 20:00 (19:30 → corte 19:45–20:15) → 400, sin citas ni uso registrado', async () => {
    const res = await reservar({ hora: '19:30', servicios_ids: [GRATIS, CORTE_30] });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('FUERA_DE_HORARIO');
    expect(await contarCitas()).toBe(0);
    expect(Number((await pool.query('SELECT COUNT(*) FROM asesoria_gratis_usos')).rows[0].count)).toBe(0);
  });
});

describe('GET /api/disponibilidad — horario de atención', () => {
  it('con 30 min ofrece de 10:00 a 19:30', async () => {
    const res = await disp({ servicios: CORTE_30 });
    expect(res.body.horas[0]).toBe('10:00');
    expect(res.body.horas[res.body.horas.length - 1]).toBe('19:30');
    expect(res.body.horas).toHaveLength(20);
  });

  it('con 45 min el último inicio es 19:00 (19:30 terminaría a las 20:15)', async () => {
    const res = await disp({ servicios: CORTE_45 });
    expect(res.body.horas[res.body.horas.length - 1]).toBe('19:00');
    expect(res.body.horas).not.toContain('19:30');
  });

  it('nunca ofrece una hora que termine después de las 20:00', async () => {
    const res = await disp({ servicios: `${CORTE_30},${CORTE_45}` }); // 75 min
    const ultima = res.body.horas[res.body.horas.length - 1];
    const [h, m] = ultima.split(':').map(Number);
    expect(h * 60 + m + 75).toBeLessThanOrEqual(20 * 60);
  });
});
