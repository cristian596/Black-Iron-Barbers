import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { vi } from 'vitest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { ingresosPorDia, ingresosPorMes } from '../db/estadisticas.js';
import { NOCHE_BOGOTA, HOY, firmarToken, insertarCita, reiniciarContador } from './utilsPrueba.js';

const app = crearApp();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let admin;
let barbero;
const get = (ruta, token = admin) => request(app).get(ruta).set('Authorization', `Bearer ${token}`);

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOCHE_BOGOTA));
  admin = firmarToken('admin');
  barbero = firmarToken('barbero');
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(async () => {
  reiniciarContador();
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
});

afterEach(async () => {
  await pool.query('UPDATE servicios SET precio = 50000 WHERE id = 1');
});

const RUTAS = [
  '/api/admin/estadisticas',
  '/api/admin/estadisticas/ingresos',
  '/api/admin/estadisticas/servicios-top',
];

describe('permisos de /api/admin/estadisticas*', () => {
  it.each(RUTAS)('%s: 401 sin token', async (ruta) => {
    const res = await request(app).get(ruta);
    expect(res.status).toBe(401);
  });

  it.each(RUTAS)('%s: 403 con rol barbero', async (ruta) => {
    const res = await get(ruta, barbero);
    expect(res.status).toBe(403);
  });

  it.each(RUTAS)('%s: 200 con rol admin', async (ruta) => {
    const res = await get(ruta);
    expect(res.status).toBe(200);
  });
});

describe('validación de parámetros', () => {
  it.each([
    ['/api/admin/estadisticas?otro=1', /desconocido/],
    ['/api/admin/estadisticas?periodo=hoy&periodo=7d', /una sola vez/],
    ['/api/admin/estadisticas?periodo[]=hoy', /desconocido|una sola vez/],
    ['/api/admin/estadisticas?periodo=semana', /periodo/],
    ['/api/admin/estadisticas?periodo=', /periodo/],
    ['/api/admin/estadisticas/ingresos?agrupar=semana', /agrupar/],
    ['/api/admin/estadisticas/ingresos?agrupar=dia&agrupar=mes', /una sola vez/],
    ['/api/admin/estadisticas/ingresos?periodo=hoy', /desconocido/],
    ['/api/admin/estadisticas/servicios-top?periodo=ayer', /periodo/],
    ['/api/admin/estadisticas/servicios-top?limite=0', /limite/],
    ['/api/admin/estadisticas/servicios-top?limite=21', /limite/],
    ['/api/admin/estadisticas/servicios-top?limite=abc', /limite/],
    ['/api/admin/estadisticas/servicios-top?limite=1.5', /limite/],
    ['/api/admin/estadisticas/servicios-top?limite=-1', /limite/],
    ['/api/admin/estadisticas/servicios-top?limite=99999999999', /limite/],
    ['/api/admin/estadisticas/servicios-top?limite=3&limite=4', /una sola vez/],
  ])('%s → 400', async (ruta, mensaje) => {
    const res = await get(ruta);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(mensaje);
  });
});

describe('GET /api/admin/estadisticas', () => {
  it('"hoy" es el día de Bogotá (22:00 del 4 de oct), no el día UTC (5 de oct)', async () => {
    await insertarCita({ fecha: HOY, precio: 50000 });
    await insertarCita({ fecha: '2026-10-05', precio: 70000 }); // "hoy" en UTC: no debe contarse

    const res = await get('/api/admin/estadisticas?periodo=hoy');

    expect(res.body.periodo).toEqual({ clave: 'hoy', desde: HOY, hasta: HOY });
    expect(res.body.anterior).toEqual({ desde: '2026-10-03', hasta: '2026-10-03' });
    expect(res.body.actual.ingresos).toBe(50000);
    expect(res.body.actual.completadas).toBe(1);
  });

  it('por defecto usa el período "hoy"', async () => {
    const res = await get('/api/admin/estadisticas');
    expect(res.body.periodo.clave).toBe('hoy');
  });

  it('las canceladas no suman ingresos ni cuentan como citas; se cuentan aparte', async () => {
    await insertarCita({ fecha: HOY, estado: 'completada', precio: 50000 });
    await insertarCita({ fecha: HOY, estado: 'cancelada', precio: 99999 });
    await insertarCita({ fecha: HOY, estado: 'pendiente', precio: 40000 });

    const { actual } = (await get('/api/admin/estadisticas?periodo=hoy')).body;

    expect(actual).toEqual({ citas: 2, completadas: 1, canceladas: 1, ingresos: 50000, ticket_promedio: 50000 });
  });

  it('usa el precio guardado en la cita: cambiar el precio del servicio después no altera los ingresos', async () => {
    await insertarCita({ fecha: HOY, precio: 50000, servicio_id: 1 });
    await pool.query('UPDATE servicios SET precio = 99999 WHERE id = 1');

    const { actual } = (await get('/api/admin/estadisticas?periodo=hoy')).body;

    expect(actual.ingresos).toBe(50000);
    expect(actual.ticket_promedio).toBe(50000);
  });

  it('una completada de precio 0 cuenta como completada pero no entra al ticket promedio', async () => {
    await insertarCita({ fecha: HOY, precio: 60000 });
    await insertarCita({ fecha: HOY, precio: 0 });

    const { actual } = (await get('/api/admin/estadisticas?periodo=hoy')).body;

    expect(actual.completadas).toBe(2);
    expect(actual.ingresos).toBe(60000);
    expect(actual.ticket_promedio).toBe(60000);
  });

  it('con 0 completadas el ticket promedio es 0 (no null ni NaN) y todo es cero', async () => {
    const { actual, previo } = (await get('/api/admin/estadisticas?periodo=hoy')).body;

    const ceros = { citas: 0, completadas: 0, canceladas: 0, ingresos: 0, ticket_promedio: 0 };
    expect(actual).toEqual(ceros);
    expect(previo).toEqual(ceros);
  });

  it('solo completadas de precio 0: ticket promedio 0', async () => {
    await insertarCita({ fecha: HOY, precio: 0 });
    const { actual } = (await get('/api/admin/estadisticas?periodo=hoy')).body;
    expect(actual.completadas).toBe(1);
    expect(actual.ticket_promedio).toBe(0);
  });

  it('el período anterior vacío no rompe: previo en ceros y actual con datos', async () => {
    await insertarCita({ fecha: HOY, precio: 50000 });
    const { actual, previo } = (await get('/api/admin/estadisticas?periodo=hoy')).body;
    expect(actual.ingresos).toBe(50000);
    expect(previo.ingresos).toBe(0);
  });

  it('compara con el día anterior', async () => {
    await insertarCita({ fecha: HOY, precio: 50000 });
    await insertarCita({ fecha: '2026-10-03', precio: 30000 });
    await insertarCita({ fecha: '2026-10-03', precio: 10000, estado: 'cancelada' });

    const { previo } = (await get('/api/admin/estadisticas?periodo=hoy')).body;

    expect(previo).toMatchObject({ ingresos: 30000, completadas: 1, canceladas: 1, citas: 1 });
  });

  it('7 días: los 7 días hasta hoy contra los 7 previos', async () => {
    await insertarCita({ fecha: '2026-09-28', precio: 10000 }); // primer día del período
    await insertarCita({ fecha: '2026-09-27', precio: 20000 }); // último del anterior
    await insertarCita({ fecha: '2026-09-21', precio: 40000 }); // primero del anterior
    await insertarCita({ fecha: '2026-09-20', precio: 80000 }); // fuera de ambos

    const res = await get('/api/admin/estadisticas?periodo=7d');

    expect(res.body.periodo).toMatchObject({ desde: '2026-09-28', hasta: HOY });
    expect(res.body.anterior).toEqual({ desde: '2026-09-21', hasta: '2026-09-27' });
    expect(res.body.actual.ingresos).toBe(10000);
    expect(res.body.previo.ingresos).toBe(60000);
  });

  it('mes: del 1 a hoy contra el mismo tramo del mes anterior', async () => {
    await insertarCita({ fecha: '2026-10-01', precio: 10000 });
    await insertarCita({ fecha: '2026-09-04', precio: 20000 }); // dentro del tramo 1–4 de septiembre
    await insertarCita({ fecha: '2026-09-05', precio: 90000 }); // después del tramo

    const res = await get('/api/admin/estadisticas?periodo=mes');

    expect(res.body.periodo).toMatchObject({ desde: '2026-10-01', hasta: HOY });
    expect(res.body.anterior).toEqual({ desde: '2026-09-01', hasta: '2026-09-04' });
    expect(res.body.previo.ingresos).toBe(20000);
  });
});

describe('GET /api/admin/estadisticas/ingresos', () => {
  it('por día: 30 días y 30 anteriores, contiguos, con ceros y terminando en hoy (Bogotá)', async () => {
    await insertarCita({ fecha: HOY, precio: 50000 });
    await insertarCita({ fecha: HOY, precio: 30000 });
    await insertarCita({ fecha: '2026-10-03', estado: 'cancelada', precio: 99999 });
    await insertarCita({ fecha: '2026-09-05', precio: 20000 }); // primer día de la serie actual
    await insertarCita({ fecha: '2026-09-04', precio: 10000 }); // último de la anterior
    await insertarCita({ fecha: '2026-08-06', precio: 5000 }); // primer día de la anterior

    const res = await get('/api/admin/estadisticas/ingresos?agrupar=dia');

    expect(res.body.agrupar).toBe('dia');
    expect(res.body.puntos).toHaveLength(30);
    expect(res.body.anteriores).toHaveLength(30);
    expect(res.body.puntos[0]).toEqual({ fecha: '2026-09-05', ingresos: 20000, cortes: 1 });
    expect(res.body.puntos[29]).toEqual({ fecha: HOY, ingresos: 80000, cortes: 2 });
    expect(res.body.puntos[28]).toEqual({ fecha: '2026-10-03', ingresos: 0, cortes: 0 });
    expect(res.body.anteriores[0]).toEqual({ fecha: '2026-08-06', ingresos: 5000, cortes: 1 });
    expect(res.body.anteriores[29]).toEqual({ fecha: '2026-09-04', ingresos: 10000, cortes: 1 });
    const fechas = [...res.body.anteriores, ...res.body.puntos].map((p) => p.fecha);
    expect(new Set(fechas).size).toBe(60);
    expect([...fechas].sort()).toEqual(fechas);
  });

  it('por defecto agrupa por día', async () => {
    const res = await get('/api/admin/estadisticas/ingresos');
    expect(res.body.agrupar).toBe('dia');
  });

  it('un rango sin citas devuelve todo en ceros, no una lista vacía', async () => {
    const res = await get('/api/admin/estadisticas/ingresos?agrupar=dia');
    expect(res.body.puntos.every((p) => p.ingresos === 0 && p.cortes === 0)).toBe(true);
  });

  it('por mes: 12 meses y 12 anteriores, con el cambio de año en su lugar', async () => {
    await insertarCita({ fecha: '2026-10-01', precio: 30000 });
    await insertarCita({ fecha: '2026-09-30', precio: 40000 });
    await insertarCita({ fecha: '2026-01-01', precio: 1000 });
    await insertarCita({ fecha: '2025-12-31', precio: 2000 });
    await insertarCita({ fecha: '2025-11-15', precio: 5000 }); // primer mes de la serie actual
    await insertarCita({ fecha: '2025-10-31', precio: 7000 }); // último mes de la anterior
    await insertarCita({ fecha: '2026-10-02', estado: 'cancelada', precio: 99999 });

    const res = await get('/api/admin/estadisticas/ingresos?agrupar=mes');
    const porMes = Object.fromEntries([...res.body.anteriores, ...res.body.puntos].map((p) => [p.mes, p.ingresos]));

    expect(res.body.puntos).toHaveLength(12);
    expect(res.body.anteriores).toHaveLength(12);
    expect(res.body.puntos[0].mes).toBe('2025-11');
    expect(res.body.puntos[11].mes).toBe('2026-10');
    expect(res.body.anteriores[0].mes).toBe('2024-11');
    expect(res.body.anteriores[11].mes).toBe('2025-10');
    expect(porMes['2026-10']).toBe(30000);
    expect(porMes['2026-09']).toBe(40000);
    expect(porMes['2026-01']).toBe(1000);
    expect(porMes['2025-12']).toBe(2000);
    expect(porMes['2025-11']).toBe(5000);
    expect(porMes['2025-10']).toBe(7000);
    expect(porMes['2026-05']).toBe(0);
  });
});

describe('GET /api/admin/estadisticas/servicios-top', () => {
  it('cuenta solo completadas y ordena por cantidad y luego ingresos', async () => {
    await insertarCita({ fecha: HOY, servicio_id: 1, precio: 50000 });
    await insertarCita({ fecha: HOY, servicio_id: 1, precio: 50000 });
    await insertarCita({ fecha: HOY, servicio_id: 2, precio: 100000 });
    await insertarCita({ fecha: HOY, servicio_id: 2, precio: 100000, estado: 'cancelada' });
    await insertarCita({ fecha: HOY, servicio_id: 2, precio: 100000, estado: 'pendiente' });

    const res = await get('/api/admin/estadisticas/servicios-top?periodo=hoy');

    expect(res.body.periodo).toMatchObject({ clave: 'hoy', desde: HOY, hasta: HOY });
    expect(res.body.servicios).toEqual([
      { id: 1, nombre: 'Corte de prueba', cantidad: 2, ingresos: 100000 },
      { id: 2, nombre: 'Combo de prueba', cantidad: 1, ingresos: 100000 },
    ]);
  });

  it('respeta el límite y el período; sin datos devuelve []', async () => {
    await insertarCita({ fecha: HOY, servicio_id: 1 });
    await insertarCita({ fecha: HOY, servicio_id: 2 });
    await insertarCita({ fecha: '2026-09-01', servicio_id: 2 }); // fuera de 7d

    const uno = await get('/api/admin/estadisticas/servicios-top?periodo=7d&limite=1');
    expect(uno.body.servicios).toHaveLength(1);

    const vacio = await get('/api/admin/estadisticas/servicios-top?periodo=7d&limite=20');
    expect(vacio.body.servicios).toHaveLength(2);

    await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
    const sinDatos = await get('/api/admin/estadisticas/servicios-top');
    expect(sinDatos.body.servicios).toEqual([]);
  });
});

describe('series por día y por mes con distintas zonas horarias de sesión', () => {
  const ZONAS = ['UTC', 'America/Bogota', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Auckland'];

  it('dan exactamente el mismo resultado sin importar la zona de la sesión de Postgres', async () => {
    await insertarCita({ fecha: '2026-10-01', precio: 30000 });
    await insertarCita({ fecha: '2026-09-30', precio: 40000 });
    await insertarCita({ fecha: '2025-12-31', precio: 2000 });
    await insertarCita({ fecha: '2026-01-01', precio: 1000 });

    const resultados = [];
    for (const zona of ZONAS) {
      const cliente = await pool.connect();
      try {
        await cliente.query(`SET TIME ZONE '${zona}'`);
        resultados.push({
          zona,
          dias: await ingresosPorDia(cliente, '2026-08-06', 60),
          meses: await ingresosPorMes(cliente, '2024-11-01', 24),
        });
      } finally {
        await cliente.query('RESET TIME ZONE');
        cliente.release();
      }
    }

    const [base, ...otros] = resultados;
    expect(base.dias).toHaveLength(60);
    expect(base.meses).toHaveLength(24);
    expect(base.meses.find((m) => m.mes === '2026-09').ingresos).toBe(40000);
    for (const otro of otros) {
      expect(otro.dias, otro.zona).toEqual(base.dias);
      expect(otro.meses, otro.zona).toEqual(base.meses);
    }
  });
});

describe('esquema: idx_citas_fecha_estado', () => {
  it('existe, y volver a aplicar schema.sql es idempotente', async () => {
    const schema = readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf-8');
    await pool.query(schema);
    const { rows } = await pool.query(
      "SELECT indexdef FROM pg_indexes WHERE tablename = 'citas' AND indexname = 'idx_citas_fecha_estado'"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toMatch(/\(fecha, estado\)/);
  });
});
