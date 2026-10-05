import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { firmarToken, insertarCita, reiniciarContador } from './utilsPrueba.js';
import { celdaCsv, generarCsv } from '../utils/csv.js';

const app = crearApp();

// 23:30 del 4 de octubre en Bogotá: en UTC ya es el 5. Si "hoy" se calculara en UTC, el 5 no sería futuro.
const BOGOTA_2330 = '2026-10-05T04:30:00Z';
const HOY = '2026-10-04';

let admin;
let barbero;
const get = (ruta, token = admin) => request(app).get(`/api/admin${ruta}`).set('Authorization', `Bearer ${token}`);
const csv = (ruta, token = admin) =>
  get(ruta, token).buffer(true).parse((res, cb) => {
    let datos = '';
    res.setEncoding('utf8');
    res.on('data', (trozo) => (datos += trozo));
    res.on('end', () => cb(null, datos));
  });

const limpiarServiciosDePrueba = async () => {
  await pool.query("DELETE FROM citas WHERE servicio_id IN (SELECT id FROM servicios WHERE nombre LIKE 'Prueba %')");
  await pool.query("DELETE FROM servicios WHERE nombre LIKE 'Prueba %'");
  await pool.query('UPDATE servicios SET precio = 50000 WHERE id = 1');
};

beforeAll(async () => {
  await pool.query("SELECT setval('servicios_id_seq', GREATEST((SELECT MAX(id) FROM servicios), 2))");
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(BOGOTA_2330));
  admin = firmarToken('admin');
  barbero = firmarToken('barbero');
});

beforeEach(async () => {
  reiniciarContador();
  await limpiarServiciosDePrueba();
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  vi.useRealTimers();
  await limpiarServiciosDePrueba();
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
});

describe('permisos', () => {
  it.each(['/reportes/diario', '/reportes/diario.csv'])('GET %s: 401 sin token y 403 con token de barbero', async (ruta) => {
    expect((await request(app).get(`/api/admin${ruta}`)).status).toBe(401);
    expect((await get(ruta, barbero)).status).toBe(403);
  });

  it('no existe ningún DELETE, POST ni PATCH del reporte', async () => {
    for (const metodo of ['delete', 'post', 'patch', 'put']) {
      const res = await request(app)[metodo]('/api/admin/reportes/diario').set('Authorization', `Bearer ${admin}`);
      expect(res.status).toBe(404);
    }
  });
});

describe('validación de parámetros y fecha', () => {
  it.each(['/reportes/diario', '/reportes/diario.csv'])('%s rechaza parámetros desconocidos o repetidos con 400 PARAMETRO_INVALIDO', async (ruta) => {
    for (const consulta of ['?periodo=hoy', `?fecha=${HOY}&otro=1`, `?fecha=${HOY}&fecha=${HOY}`, `?fecha[]=${HOY}`]) {
      const res = await get(`${ruta}${consulta}`);
      expect(res.status, consulta).toBe(400);
      expect(res.body.codigo).toBe('PARAMETRO_INVALIDO');
    }
  });

  it.each(['', 'hoy', '2026-10-4', '2026/10/04', '2026-02-31', '2026-13-01', '2026-10-04T10:00', '20261004'])(
    'fecha = "%s" → 400 FECHA_INVALIDA (también en CSV)',
    async (fecha) => {
      for (const ruta of ['/reportes/diario', '/reportes/diario.csv']) {
        const res = await get(`${ruta}?fecha=${encodeURIComponent(fecha)}`);
        expect(res.status).toBe(400);
        expect(res.body.codigo).toBe('FECHA_INVALIDA');
      }
    }
  );

  it('una fecha posterior a hoy en Bogotá → 400 FECHA_FUTURA, aunque en UTC ese día ya haya llegado', async () => {
    const json = await get('/reportes/diario?fecha=2026-10-05'); // en UTC ya es el 5
    expect(json.status).toBe(400);
    expect(json.body.codigo).toBe('FECHA_FUTURA');
    expect((await get('/reportes/diario.csv?fecha=2026-10-05')).body.codigo).toBe('FECHA_FUTURA');
    expect((await get('/reportes/diario?fecha=2099-01-01')).body.codigo).toBe('FECHA_FUTURA');
  });

  it('hoy (Bogotá) es válido y es la fecha por defecto; 23:30 sigue siendo el 4 de octubre', async () => {
    expect((await get(`/reportes/diario?fecha=${HOY}`)).status).toBe(200);
    expect((await get('/reportes/diario')).body.fecha).toBe(HOY);
  });

  it('un día pasado muy lejano es válido y sale vacío', async () => {
    const res = await get('/reportes/diario?fecha=2020-02-29');
    expect(res.status).toBe(200);
    expect(res.body.fecha).toBe('2020-02-29');
  });
});

describe('GET /api/admin/reportes/diario', () => {
  it('un día sin citas devuelve ceros y una lista vacía, no un error', async () => {
    const res = await get('/reportes/diario?fecha=2026-09-01');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      fecha: '2026-09-01',
      total_cortes: 0,
      ingresos: 0,
      ticket_promedio: 0,
      canceladas: 0,
      pendientes_sin_cerrar: 0,
      servicios_mas_pedidos: [],
    });
  });

  it('cuenta solo las completadas del día: ingresos, ticket promedio, canceladas y pendientes aparte', async () => {
    await insertarCita({ fecha: HOY, precio: 50000 });
    await insertarCita({ fecha: HOY, precio: 30000, servicio_id: 2 });
    await insertarCita({ fecha: HOY, precio: 40000, estado: 'cancelada' });
    await insertarCita({ fecha: HOY, precio: 25000, estado: 'pendiente' });
    await insertarCita({ fecha: '2026-10-03', precio: 99000 }); // otro día
    await insertarCita({ fecha: '2026-10-05', precio: 99000, estado: 'pendiente' }); // otro día

    const { body } = await get(`/reportes/diario?fecha=${HOY}`);
    expect(body).toMatchObject({
      fecha: HOY,
      total_cortes: 2,
      ingresos: 80000,
      ticket_promedio: 40000,
      canceladas: 1,
      pendientes_sin_cerrar: 1,
    });
  });

  it('las canceladas no suman ingresos ni cortes', async () => {
    await insertarCita({ fecha: HOY, precio: 70000, estado: 'cancelada' });
    const { body } = await get(`/reportes/diario?fecha=${HOY}`);
    expect(body).toMatchObject({ total_cortes: 0, ingresos: 0, canceladas: 1, servicios_mas_pedidos: [] });
  });

  it('el ticket promedio excluye las completadas de precio 0, que sí cuentan como corte', async () => {
    await insertarCita({ fecha: HOY, precio: 0 });
    await insertarCita({ fecha: HOY, precio: 20000 });
    await insertarCita({ fecha: HOY, precio: 40000 });
    const { body } = await get(`/reportes/diario?fecha=${HOY}`);
    expect(body).toMatchObject({ total_cortes: 3, ingresos: 60000, ticket_promedio: 30000 });
  });

  it('si todas las completadas son gratis el ticket promedio es 0 (no NaN)', async () => {
    await insertarCita({ fecha: HOY, precio: 0 });
    const { body } = await get(`/reportes/diario?fecha=${HOY}`);
    expect(body).toMatchObject({ total_cortes: 1, ingresos: 0, ticket_promedio: 0 });
  });

  it('usa el precio guardado en la cita: cambiar el precio del servicio no altera el reporte', async () => {
    await insertarCita({ fecha: HOY, precio: 50000 });
    const antes = (await get(`/reportes/diario?fecha=${HOY}`)).body;

    await pool.query('UPDATE servicios SET precio = 999999 WHERE id = 1');
    const despues = (await get(`/reportes/diario?fecha=${HOY}`)).body;

    expect(despues).toEqual(antes);
    expect(despues.ingresos).toBe(50000);
    expect(despues.servicios_mas_pedidos[0].ingresos).toBe(50000);
  });

  it('servicios más pedidos: por cantidad (luego ingresos y nombre), con nombre, cantidad e ingresos, solo completadas', async () => {
    await pool.query("INSERT INTO servicios (nombre, duracion_min, precio) VALUES ('Prueba Extra', 30, 10000)");
    const { rows } = await pool.query("SELECT id FROM servicios WHERE nombre = 'Prueba Extra'");
    await insertarCita({ fecha: HOY, precio: 50000, servicio_id: 1 });
    await insertarCita({ fecha: HOY, precio: 50000, servicio_id: 1 });
    await insertarCita({ fecha: HOY, precio: 100000, servicio_id: 2 });
    await insertarCita({ fecha: HOY, precio: 10000, servicio_id: rows[0].id });
    await insertarCita({ fecha: HOY, precio: 10000, servicio_id: rows[0].id });
    await insertarCita({ fecha: HOY, precio: 10000, servicio_id: rows[0].id, estado: 'cancelada' });

    const { body } = await get(`/reportes/diario?fecha=${HOY}`);
    expect(body.servicios_mas_pedidos).toEqual([
      { nombre: 'Corte de prueba', cantidad: 2, ingresos: 100000 },
      { nombre: 'Prueba Extra', cantidad: 2, ingresos: 20000 },
      { nombre: 'Combo de prueba', cantidad: 1, ingresos: 100000 },
    ]);
  });

  it('no desglosa por barbero', async () => {
    await insertarCita({ fecha: HOY });
    expect(Object.keys((await get(`/reportes/diario?fecha=${HOY}`)).body).sort()).toEqual([
      'canceladas', 'fecha', 'ingresos', 'pendientes_sin_cerrar', 'servicios_mas_pedidos', 'ticket_promedio', 'total_cortes',
    ]);
  });

  it('coincide con /api/admin/estadisticas?periodo=hoy (mismas reglas)', async () => {
    await insertarCita({ fecha: HOY, precio: 0 });
    await insertarCita({ fecha: HOY, precio: 45000 });
    await insertarCita({ fecha: HOY, precio: 10000, estado: 'cancelada' });
    const reporte = (await get(`/reportes/diario?fecha=${HOY}`)).body;
    const { actual } = (await get('/estadisticas?periodo=hoy')).body;
    expect(reporte).toMatchObject({
      total_cortes: actual.completadas, ingresos: actual.ingresos, ticket_promedio: actual.ticket_promedio, canceladas: actual.canceladas,
    });
  });

  it('una cita de las 23:30 de Bogotá cuenta en el día 4, no en el 5 (la fecha es de Bogotá, no UTC)', async () => {
    await insertarCita({ fecha: HOY, hora: '23:30', precio: 30000 });
    expect((await get(`/reportes/diario?fecha=${HOY}`)).body.total_cortes).toBe(1);
  });
});

describe('GET /api/admin/reportes/diario.csv', () => {
  it('cabeceras: text/csv utf-8, descarga con nombre reporte-diario-FECHA.csv y sin caché', async () => {
    const res = await csv(`/reportes/diario.csv?fecha=${HOY}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="reporte-diario-${HOY}.csv"`);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('empieza con BOM UTF-8, separa con ; y termina las líneas con CRLF', async () => {
    await insertarCita({ fecha: HOY, precio: 50000 });
    await insertarCita({ fecha: HOY, precio: 30000, servicio_id: 2 });
    await insertarCita({ fecha: HOY, precio: 5000, estado: 'cancelada' });
    await insertarCita({ fecha: HOY, precio: 5000, estado: 'pendiente' });

    const texto = (await csv(`/reportes/diario.csv?fecha=${HOY}`)).body;
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    expect(texto.endsWith('\r\n')).toBe(true);
    expect(texto.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/); // ningún salto suelto: todos son CRLF
    expect(texto.slice(1).split('\r\n')).toEqual([
      `Reporte diario;${HOY}`,
      'Total de cortes;2',
      'Ingresos;80000',
      'Ticket promedio;40000',
      'Canceladas;1',
      'Pendientes sin cerrar;1',
      '',
      'Servicio;Cantidad;Ingresos',
      'Corte de prueba;1;50000',
      'Combo de prueba;1;30000',
      '',
    ]);
  });

  it('tiene el mismo contenido que el JSON', async () => {
    await insertarCita({ fecha: HOY, precio: 50000 });
    const json = (await get(`/reportes/diario?fecha=${HOY}`)).body;
    const filas = (await csv(`/reportes/diario.csv?fecha=${HOY}`)).body.slice(1).split('\r\n').map((l) => l.split(';'));
    expect(filas[1][1]).toBe(String(json.total_cortes));
    expect(filas[2][1]).toBe(String(json.ingresos));
    expect(filas[3][1]).toBe(String(json.ticket_promedio));
    expect(filas[4][1]).toBe(String(json.canceladas));
    expect(filas[5][1]).toBe(String(json.pendientes_sin_cerrar));
    expect(filas[8]).toEqual([json.servicios_mas_pedidos[0].nombre, '1', '50000']);
  });

  it('un día vacío da el encabezado con ceros y la tabla de servicios sin filas', async () => {
    const texto = (await csv('/reportes/diario.csv?fecha=2026-09-01')).body;
    expect(texto.slice(1).split('\r\n')).toEqual([
      'Reporte diario;2026-09-01', 'Total de cortes;0', 'Ingresos;0', 'Ticket promedio;0', 'Canceladas;0',
      'Pendientes sin cerrar;0', '', 'Servicio;Cantidad;Ingresos', '',
    ]);
  });

  it('escapa comillas y separadores en el nombre del servicio', async () => {
    await pool.query(`INSERT INTO servicios (nombre, duracion_min, precio) VALUES ('Prueba "Corte"; con coma, y ñ', 30, 1000)`);
    const { rows } = await pool.query("SELECT id FROM servicios WHERE nombre LIKE 'Prueba %'");
    await insertarCita({ fecha: HOY, precio: 1000, servicio_id: rows[0].id });
    const texto = (await csv(`/reportes/diario.csv?fecha=${HOY}`)).body;
    expect(texto).toContain('"Prueba ""Corte""; con coma, y ñ";1;1000\r\n');
  });

  it.each(['=HYPERLINK("http://x";"y")', '+cmd|calc', '-2+3', '@SUMA(1;1)'])(
    'neutraliza la inyección de fórmulas: un servicio llamado %s sale como texto',
    async (nombre) => {
      await pool.query('INSERT INTO servicios (nombre, duracion_min, precio) VALUES ($1, 30, 1000)', [nombre]);
      const { rows } = await pool.query('SELECT id FROM servicios WHERE nombre = $1', [nombre]);
      await insertarCita({ fecha: HOY, precio: 1000, servicio_id: rows[0].id });
      try {
        const texto = (await csv(`/reportes/diario.csv?fecha=${HOY}`)).body;
        const fila = texto.slice(1).split('\r\n')[8];
        expect(fila.startsWith(`'${nombre[0]}`) || fila.startsWith(`"'${nombre[0]}`)).toBe(true);
        expect(fila.startsWith(nombre[0])).toBe(false);
      } finally {
        await pool.query('DELETE FROM citas WHERE servicio_id = $1', [rows[0].id]);
        await pool.query('DELETE FROM servicios WHERE id = $1', [rows[0].id]);
      }
    }
  );
});

describe('utils/csv', () => {
  it('celdaCsv: texto simple, números, vacíos, comillas, separadores, saltos de línea y fórmulas', () => {
    expect(celdaCsv('Corte')).toBe('Corte');
    expect(celdaCsv(0)).toBe('0');
    expect(celdaCsv(null)).toBe('');
    expect(celdaCsv(undefined)).toBe('');
    expect(celdaCsv('a;b')).toBe('"a;b"');
    expect(celdaCsv('di "hola"')).toBe('"di ""hola"""');
    expect(celdaCsv('línea\r\nnueva')).toBe('"línea\r\nnueva"');
    expect(celdaCsv('=1+1')).toBe("'=1+1");
    expect(celdaCsv('+1')).toBe("'+1");
    expect(celdaCsv('-1')).toBe("'-1");
    expect(celdaCsv('@a')).toBe("'@a");
    expect(celdaCsv('\t=1')).toBe("'\t=1");
    expect(celdaCsv('a=b')).toBe('a=b'); // solo importa el primer carácter
    expect(celdaCsv('=a;b')).toBe('"\'=a;b"'); // se neutraliza y además se entrecomilla
  });

  it('generarCsv: BOM, ; y CRLF, con una línea vacía para una fila vacía', () => {
    expect(generarCsv([['a', 1], [], ['b', 'c;d']])).toBe('﻿a;1\r\n\r\nb;"c;d"\r\n');
  });
});
