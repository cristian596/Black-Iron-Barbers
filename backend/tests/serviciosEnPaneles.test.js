import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { resumenPeriodo, serviciosTop } from '../db/estadisticas.js';
import {
  NOCHE_BOGOTA,
  crearServiciosCombo,
  borrarServiciosCombo,
  insertarCita,
  insertarCitaConServicios,
  reiniciarContador,
} from './utilsPrueba.js';

const app = crearApp();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const firmar = (id, rol, barberoId) =>
  jwt.sign({ id, usuario: `u${id}`, rol, barbero_id: barberoId }, process.env.JWT_SECRET, { expiresIn: '30d' });
const admin = firmar(1, 'admin', null);
const barbero1 = firmar(2, 'barbero', 1);

const getAdmin = (ruta) => request(app).get(`/api/admin${ruta}`).set('Authorization', `Bearer ${admin}`);
const getBarbero = (ruta) => request(app).get(`/api/barbero${ruta}`).set('Authorization', `Bearer ${barbero1}`);

beforeAll(async () => {
  await crearServiciosCombo();
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterAll(async () => {
  vi.useRealTimers();
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  await borrarServiciosCombo();
});
beforeEach(async () => {
  vi.setSystemTime(new Date(NOCHE_BOGOTA)); // 4 de octubre, 22:00 en Bogotá
  reiniciarContador();
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  await pool.query("UPDATE usuarios SET activo = true, contrasena_cambiada_en = $1 WHERE usuario IN ('barbero1_test', 'barbero2_test')", [new Date(NOCHE_BOGOTA)]);
  await pool.query("UPDATE servicios SET nombre = 'Corte T' WHERE id = 201");
});

describe('Estadísticas con combos', () => {
  const sembrarCombos = async () => {
    await insertarCitaConServicios({ ids: [201, 202], fecha: '2026-10-01', hora: '09:00', barbero_id: 1 }); // 35000
    await insertarCitaConServicios({ ids: [201], fecha: '2026-10-01', hora: '10:00', barbero_id: 1 }); // 20000
    await insertarCitaConServicios({ ids: [201, 203], fecha: '2026-10-01', hora: '11:00', barbero_id: 2 }); // 25000
    await insertarCitaConServicios({ ids: [202, 203], fecha: '2026-10-01', hora: '12:00', barbero_id: 2, estado: 'cancelada' });
    await insertarCitaConServicios({ ids: [204], fecha: '2026-10-01', hora: '13:00', barbero_id: 1, estado: 'pendiente' });
  };
  const rango = { desde: '2026-10-01', hasta: '2026-10-01' };

  it('serviciosTop: cantidad = líneas e ingresos = suma del precio de la línea; solo completadas', async () => {
    await sembrarCombos();
    const top = await serviciosTop(pool, rango, 10);
    expect(top).toEqual([
      { id: 201, nombre: 'Corte T', cantidad: 3, ingresos: 60000 },
      { id: 202, nombre: 'Barba T', cantidad: 1, ingresos: 15000 },
      { id: 203, nombre: 'Cejas T', cantidad: 1, ingresos: 5000 },
    ]);
  });

  it('serviciosTop limitado a un barbero cuenta solo sus líneas', async () => {
    await sembrarCombos();
    const top = await serviciosTop(pool, rango, 10, 2);
    expect(top).toEqual([{ id: 201, nombre: 'Corte T', cantidad: 1, ingresos: 20000 }, { id: 203, nombre: 'Cejas T', cantidad: 1, ingresos: 5000 }]);
  });

  it('ingresos, cortes, ticket promedio y canceladas cuentan CITAS (no cambian por tener varios servicios)', async () => {
    await sembrarCombos();
    const r = await resumenPeriodo(pool, rango);
    expect(r).toMatchObject({ completadas: 3, canceladas: 1, citas: 4, ingresos: 80000, ticket_promedio: 26667 });
  });

  it('el reporte diario (JSON y CSV) usa las líneas y total_cortes sigue contando citas', async () => {
    await sembrarCombos();
    const res = await getAdmin('/reportes/diario?fecha=2026-10-01');
    expect(res.status).toBe(200);
    expect(res.body.total_cortes).toBe(3);
    expect(res.body.ingresos).toBe(80000);
    expect(res.body.servicios_mas_pedidos).toEqual([
      { nombre: 'Corte T', cantidad: 3, ingresos: 60000 },
      { nombre: 'Barba T', cantidad: 1, ingresos: 15000 },
      { nombre: 'Cejas T', cantidad: 1, ingresos: 5000 },
    ]);

    const csv = await getAdmin('/reportes/diario.csv?fecha=2026-10-01')
      .buffer(true)
      .parse((r, cb) => {
        let datos = '';
        r.setEncoding('utf8');
        r.on('data', (trozo) => (datos += trozo));
        r.on('end', () => cb(null, datos));
      });
    expect(csv.text ?? csv.body).toContain('Corte T;3;60000');
  });

  it('el endpoint de servicios más pedidos del barbero cuenta sus líneas', async () => {
    await insertarCitaConServicios({ ids: [201, 202], fecha: '2026-10-04', hora: '09:00', barbero_id: 1 });
    await insertarCitaConServicios({ ids: [201], fecha: '2026-10-04', hora: '10:00', barbero_id: 2 });
    const res = await getBarbero('/estadisticas/servicios-top?periodo=hoy');
    expect(res.status).toBe(200);
    expect(res.body.servicios).toEqual([
      { id: 201, nombre: 'Corte T', cantidad: 1, ingresos: 20000 },
      { id: 202, nombre: 'Barba T', cantidad: 1, ingresos: 15000 },
    ]);
  });
});

describe('Admin: lista de citas con varios servicios', () => {
  it('cada cita trae servicio_nombre unido y servicios[] ordenado', async () => {
    await insertarCitaConServicios({ ids: [202, 201], fecha: '2026-10-05', hora: '10:00', estado: 'pendiente' });
    const res = await getAdmin('/citas?pestana=todas');
    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      servicio_id: 202,
      servicio_nombre: 'Barba T + Corte T',
      precio: 35000,
      duracion_min: 60,
      servicios: [
        { id: 202, nombre: 'Barba T', duracion_min: 30, precio: 15000 },
        { id: 201, nombre: 'Corte T', duracion_min: 30, precio: 20000 },
      ],
    });
  });

  it('q busca en los nombres de TODOS los servicios de la cita, no solo el principal', async () => {
    await insertarCitaConServicios({ ids: [201, 202], fecha: '2026-10-05', hora: '10:00', estado: 'pendiente', cliente: 'Combo' });
    await insertarCita({ fecha: '2026-10-05', hora: '12:00', estado: 'pendiente', cliente: 'Otro' });
    const porSegundo = await getAdmin('/citas?q=barba');
    expect(porSegundo.body.items.map((c) => c.cliente)).toEqual(['Combo']);
    expect(porSegundo.body.total).toBe(1);
    const porPrimero = await getAdmin('/citas?q=corte%20t');
    expect(porPrimero.body.items.map((c) => c.cliente)).toEqual(['Combo']);
  });

  it('q escapa los comodines y busca en el snapshot, no en el nombre actual del catálogo', async () => {
    await insertarCitaConServicios({ ids: [201, 202], fecha: '2026-10-05', hora: '10:00', estado: 'pendiente', cliente: 'Combo' });
    expect((await getAdmin('/citas?q=%25')).body.total).toBe(0);
    await pool.query("UPDATE servicios SET nombre = 'Nombre nuevo' WHERE id = 201");
    expect((await getAdmin('/citas?q=corte%20t')).body.total).toBe(1);
    expect((await getAdmin('/citas?q=nombre%20nuevo')).body.total).toBe(0);
  });

  it('un % en q se busca como texto literal (el escape LIKE funciona de verdad)', async () => {
    await pool.query("UPDATE servicios SET nombre = 'Barba 100% T' WHERE id = 202");
    await insertarCitaConServicios({ ids: [201, 202], fecha: '2026-10-05', hora: '10:00', estado: 'pendiente', cliente: 'ConPorcentaje' });
    await pool.query("UPDATE servicios SET nombre = 'Barba T' WHERE id = 202");
    await insertarCitaConServicios({ ids: [201, 202], fecha: '2026-10-05', hora: '12:00', estado: 'pendiente', cliente: 'SinPorcentaje' });
    // Sin escape, "%" sería un comodín y devolvería las dos citas.
    const res = await getAdmin('/citas?q=%25');
    expect(res.body.items.map((c) => c.cliente)).toEqual(['ConPorcentaje']);
    expect((await getAdmin('/citas?q=100%25')).body.total).toBe(1);
    const delBarbero = await getBarbero('/citas?pestana=todas&q=%25'); // el mismo escape en Mis citas
    expect(delBarbero.body.items.map((c) => c.cliente)).toEqual(['ConPorcentaje']);
  });
});

describe('Panel del barbero con varios servicios', () => {
  it('agenda de hoy: nombres unidos, servicios[] y duración total', async () => {
    await insertarCitaConServicios({ ids: [201, 202], fecha: '2026-10-04', hora: '15:00', estado: 'pendiente', barbero_id: 1 });
    const res = await getBarbero('/agenda-hoy');
    expect(res.status).toBe(200);
    expect(res.body.citas[0]).toMatchObject({
      servicio_nombre: 'Corte T + Barba T',
      duracion_min: 60,
      precio: 35000,
      servicios: [
        { id: 201, nombre: 'Corte T', duracion_min: 30, precio: 20000 },
        { id: 202, nombre: 'Barba T', duracion_min: 30, precio: 15000 },
      ],
    });
    expect(JSON.stringify(res.body)).not.toMatch(/correo|telefono|example\.com|3001234567/);
  });

  it('"por confirmar" usa la duración TOTAL de la cita: 19:30 + 60 min + 2 h = 22:30, aún no (solo el primer servicio daría 22:00)', async () => {
    const aun = await insertarCitaConServicios({ ids: [201, 202], fecha: '2026-10-04', hora: '19:30', estado: 'pendiente', barbero_id: 1 });
    const ya = await insertarCitaConServicios({ ids: [201, 202], fecha: '2026-10-04', hora: '18:00', estado: 'pendiente', barbero_id: 1 });
    const res = await getBarbero('/citas-por-confirmar');
    expect(res.body.items.map((c) => c.id)).toEqual([ya]);
    expect(res.body.items[0]).toMatchObject({ duracion_min: 60, servicio_nombre: 'Corte T + Barba T' });
    expect(res.body.items[0].servicios).toHaveLength(2);
    expect(aun).not.toBe(ya);
    expect((await getBarbero('/resumen')).body.por_confirmar).toBe(1);
  });

  it('Mis citas: trae servicios[], filtra por el nombre de cualquiera y los conteos coinciden', async () => {
    await insertarCitaConServicios({ ids: [201, 202], fecha: '2026-10-04', hora: '09:00', barbero_id: 1, cliente: 'Combo' });
    await insertarCita({ fecha: '2026-10-04', hora: '12:00', barbero_id: 1, cliente: 'Simple', estado: 'completada' });
    const res = await getBarbero('/citas?pestana=todas&q=barba');
    expect(res.status).toBe(200);
    expect(res.body.items.map((c) => c.cliente)).toEqual(['Combo']);
    expect(res.body.items[0].servicios.map((s) => s.nombre)).toEqual(['Corte T', 'Barba T']);
    expect(res.body.conteos.todas).toBe(1);
  });

  it('la próxima cita del resumen trae los servicios', async () => {
    await insertarCitaConServicios({ ids: [201, 202], fecha: '2026-10-05', hora: '09:00', estado: 'pendiente', barbero_id: 1 });
    const res = await getBarbero('/resumen');
    expect(res.body.proxima_cita).toMatchObject({ servicio_nombre: 'Corte T + Barba T' });
    expect(res.body.proxima_cita.servicios).toHaveLength(2);
  });
});

describe('Backfill de cita_servicios (schema.sql)', () => {
  const schema = readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf-8');

  it('crea una línea por cita previa con la duración y el precio de la propia cita; correrlo dos veces no duplica', async () => {
    // Citas "previas": sin líneas, con un snapshot distinto al del catálogo actual (servicio 1 = 30 min / 50000).
    const a = await insertarCita({ fecha: '2026-09-01', hora: '09:00', estado: 'completada', duracion_min: 45, precio: 12345 });
    const b = await insertarCita({ fecha: '2026-09-01', hora: '10:00', estado: 'cancelada', servicio_id: 2, duracion_min: 90, precio: 100000 });
    await pool.query('DELETE FROM cita_servicios WHERE cita_id = ANY($1::int[])', [[a, b]]);
    // Una cita que YA tiene varias líneas no se toca.
    const combo = await insertarCitaConServicios({ ids: [201, 202], fecha: '2026-09-02', hora: '09:00' });

    await pool.query(schema);
    await pool.query(schema);

    const { rows } = await pool.query(
      'SELECT cita_id, servicio_id, orden, nombre, duracion_min, precio FROM cita_servicios WHERE cita_id = ANY($1::int[]) ORDER BY cita_id, orden',
      [[a, b]]
    );
    expect(rows).toEqual([
      { cita_id: a, servicio_id: 1, orden: 1, nombre: 'Corte de prueba', duracion_min: 45, precio: 12345 },
      { cita_id: b, servicio_id: 2, orden: 1, nombre: 'Combo de prueba', duracion_min: 90, precio: 100000 },
    ]);
    const { rows: delCombo } = await pool.query('SELECT servicio_id FROM cita_servicios WHERE cita_id = $1 ORDER BY orden', [combo]);
    expect(delCombo.map((l) => l.servicio_id)).toEqual([201, 202]);
    const { rows: total } = await pool.query('SELECT COUNT(*)::int AS n FROM cita_servicios');
    expect(total[0].n).toBe(4); // 2 backfill + 2 del combo
  });

  it('tras el backfill todas las citas tienen líneas cuya suma coincide con la cita', async () => {
    await insertarCita({ fecha: '2026-09-01', hora: '09:00' });
    await insertarCitaConServicios({ ids: [201, 202, 203], fecha: '2026-09-02', hora: '09:00' });
    const { rows } = await pool.query(
      `SELECT c.id FROM citas c
       LEFT JOIN cita_servicios cs ON cs.cita_id = c.id
       GROUP BY c.id, c.duracion_min, c.precio
       HAVING COUNT(cs.id) = 0 OR SUM(cs.duracion_min) <> c.duracion_min OR SUM(cs.precio) <> c.precio`
    );
    expect(rows).toEqual([]);
  });
});
