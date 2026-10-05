import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { NOCHE_BOGOTA, insertarCita, reiniciarContador } from './utilsPrueba.js';

const app = crearApp();

// Usuarios de globalSetup: admin = 1, barbero1_test = 2 (barbero 1), barbero2_test = 3 (barbero 2).
const firmar = (id, rol, barberoId) =>
  jwt.sign({ id, usuario: `u${id}`, rol, barbero_id: barberoId }, process.env.JWT_SECRET, { expiresIn: '30d' });
const barbero1 = firmar(2, 'barbero', 1);
const barbero2 = firmar(3, 'barbero', 2);
const admin = firmar(1, 'admin', null);

const get = (ruta, token = barbero1) => request(app).get(`/api/barbero/estadisticas${ruta}`).set('Authorization', `Bearer ${token}`);
const ponerReloj = (iso) => vi.setSystemTime(new Date(iso));
const RUTAS = ['', '/ingresos', '/servicios-top'];

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

const cita = (extra) => insertarCita({ barbero_id: 1, estado: 'completada', ...extra });

describe('GET /api/barbero/estadisticas*: permisos', () => {
  it.each(RUTAS)('%s: 401 sin token y 403 con el admin', async (ruta) => {
    expect((await request(app).get(`/api/barbero/estadisticas${ruta}`)).status).toBe(401);
    expect((await get(ruta, admin)).status).toBe(403);
  });

  it.each(RUTAS)('%s: contraseña caducada 403 CONTRASENA_CADUCADA y usuario desactivado 401 SESION_INVALIDA', async (ruta) => {
    await pool.query("UPDATE usuarios SET contrasena_cambiada_en = $1 WHERE usuario = 'barbero1_test'", [new Date(Date.parse(NOCHE_BOGOTA) - 60 * 24 * 3600 * 1000)]);
    const caducada = await get(ruta);
    expect(caducada.status).toBe(403);
    expect(caducada.body.codigo).toBe('CONTRASENA_CADUCADA');

    await pool.query("UPDATE usuarios SET contrasena_cambiada_en = $1, activo = false WHERE usuario = 'barbero1_test'", [new Date(NOCHE_BOGOTA)]);
    const inactivo = await get(ruta);
    expect(inactivo.status).toBe(401);
    expect(inactivo.body.codigo).toBe('SESION_INVALIDA');
  });

  it.each(RUTAS)('%s: no hay POST, PATCH, PUT ni DELETE', async (ruta) => {
    for (const metodo of ['post', 'patch', 'put', 'delete']) {
      const res = await request(app)[metodo](`/api/barbero/estadisticas${ruta}`).set('Authorization', `Bearer ${barbero1}`).send({});
      expect(res.status).toBe(404);
    }
  });

  it('un usuario de barbero sin barbero ligado recibe 403 SIN_BARBERO', async () => {
    const huerfano = firmar(2, 'barbero', null); // el barbero_id del token no cuenta: verificarToken lo lee de la base
    await pool.query("UPDATE usuarios SET barbero_id = NULL WHERE usuario = 'barbero1_test'");
    try {
      const res = await get('', huerfano);
      expect(res.status).toBe(403);
      expect(res.body.codigo).toBe('SIN_BARBERO');
    } finally {
      await pool.query("UPDATE usuarios SET barbero_id = 1 WHERE usuario = 'barbero1_test'");
    }
  });
});

describe('GET /api/barbero/estadisticas*: parámetros', () => {
  it.each([
    ['', '?barbero_id=2'],
    ['', '?x=1'],
    ['', '?periodo=hoy&periodo=7d'],
    ['', '?periodo[]=hoy'],
    ['', '?periodo=ayer'],
    ['', '?periodo='],
    ['/ingresos', '?agrupar=semana'],
    ['/ingresos', '?barbero=2'],
    ['/ingresos', '?agrupar=dia&agrupar=mes'],
    ['/servicios-top', '?limite=0'],
    ['/servicios-top', '?limite=21'],
    ['/servicios-top', '?limite=abc'],
    ['/servicios-top', '?periodo=año'],
    ['/servicios-top', '?barbero_id=1'],
  ])('%s%s → 400 PARAMETRO_INVALIDO', async (ruta, query) => {
    const res = await get(`${ruta}${query}`);
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('PARAMETRO_INVALIDO');
    expect(typeof res.body.error).toBe('string');
  });

  it('los valores válidos dan 200', async () => {
    for (const periodo of ['hoy', '7d', '30d', 'mes']) expect((await get(`?periodo=${periodo}`)).status).toBe(200);
    expect((await get('/ingresos?agrupar=mes')).status).toBe(200);
    expect((await get('/servicios-top?periodo=mes&limite=20')).status).toBe(200);
  });
});

describe('GET /api/barbero/estadisticas', () => {
  it('totales: ingresos con el precio de la cita, canceladas aparte, ticket sin precio 0', async () => {
    await pool.query('UPDATE servicios SET precio = 99999 WHERE id = 1'); // el precio actual del servicio no cuenta
    await cita({ fecha: '2026-10-04', hora: '09:00', precio: 30000 });
    await cita({ fecha: '2026-10-04', hora: '10:00', precio: 50000 });
    await cita({ fecha: '2026-10-04', hora: '11:00', precio: 0 }); // gratis: cuenta como corte, no en el ticket
    await cita({ fecha: '2026-10-04', hora: '12:00', precio: 80000, estado: 'cancelada' });
    await cita({ fecha: '2026-10-04', hora: '13:00', precio: 40000, estado: 'pendiente' });
    try {
      const res = await get('?periodo=hoy');
      expect(res.status).toBe(200);
      expect(res.body.periodo).toMatchObject({ clave: 'hoy', desde: '2026-10-04', hasta: '2026-10-04' });
      expect(res.body.actual).toEqual({ citas: 4, completadas: 3, canceladas: 1, ingresos: 80000, ticket_promedio: 40000 });
    } finally {
      await pool.query('UPDATE servicios SET precio = 50000 WHERE id = 1');
    }
  });

  it('por defecto es "hoy"', async () => {
    await cita({ fecha: '2026-10-04', hora: '09:00', precio: 10000 });
    const res = await get('');
    expect(res.body.periodo.clave).toBe('hoy');
    expect(res.body.actual.ingresos).toBe(10000);
  });

  it('nunca cuenta citas de otro barbero, ni con ?barbero_id', async () => {
    await cita({ fecha: '2026-10-04', hora: '09:00', precio: 10000 });
    await insertarCita({ barbero_id: 2, fecha: '2026-10-04', hora: '09:00', precio: 70000, estado: 'completada' });
    await insertarCita({ barbero_id: 2, fecha: '2026-10-04', hora: '10:00', precio: 5000, estado: 'cancelada' });

    const uno = await get('?periodo=hoy', barbero1);
    expect(uno.body.actual).toMatchObject({ completadas: 1, canceladas: 0, ingresos: 10000 });
    const dos = await get('?periodo=hoy', barbero2);
    expect(dos.body.actual).toMatchObject({ completadas: 1, canceladas: 1, ingresos: 70000 });
    expect((await get('?periodo=hoy&barbero_id=2', barbero1)).status).toBe(400);
  });

  it('el periodo anterior: hoy → ayer, 7d → 7 días previos, 30d → 30 previos', async () => {
    await cita({ fecha: '2026-10-04', hora: '09:00', precio: 10000 }); // hoy
    await cita({ fecha: '2026-10-03', hora: '09:00', precio: 20000 }); // ayer
    await cita({ fecha: '2026-09-28', hora: '09:00', precio: 30000 }); // 7d actual: 28 sep – 4 oct
    await cita({ fecha: '2026-09-27', hora: '09:00', precio: 40000 }); // 7d anterior: 21–27 sep
    await cita({ fecha: '2026-09-04', hora: '09:00', precio: 50000 }); // 30d anterior: 6 ago – 4 sep

    const hoy = await get('?periodo=hoy');
    expect(hoy.body.anterior).toEqual({ desde: '2026-10-03', hasta: '2026-10-03' });
    expect(hoy.body.actual.ingresos).toBe(10000);
    expect(hoy.body.previo.ingresos).toBe(20000);

    const semana = await get('?periodo=7d');
    expect(semana.body.periodo).toMatchObject({ desde: '2026-09-28', hasta: '2026-10-04' });
    expect(semana.body.anterior).toEqual({ desde: '2026-09-21', hasta: '2026-09-27' });
    expect(semana.body.actual.ingresos).toBe(60000);
    expect(semana.body.previo.ingresos).toBe(40000);

    const treinta = await get('?periodo=30d');
    expect(treinta.body.periodo).toMatchObject({ desde: '2026-09-05', hasta: '2026-10-04' });
    expect(treinta.body.actual.completadas).toBe(4);
    expect(treinta.body.previo.ingresos).toBe(50000);
  });

  it('periodo vacío: ceros, sin NaN', async () => {
    const res = await get('?periodo=30d');
    expect(res.body.actual).toEqual({ citas: 0, completadas: 0, canceladas: 0, ingresos: 0, ticket_promedio: 0 });
    expect(res.body.previo).toEqual({ citas: 0, completadas: 0, canceladas: 0, ingresos: 0, ticket_promedio: 0 });
  });

  it('"hoy" es el de Bogotá: a las 23:30 de Bogotá (04:30 UTC del día siguiente) sigue siendo el mismo día', async () => {
    ponerReloj('2026-10-05T04:30:00Z'); // 4 de octubre, 23:30 en Bogotá
    await cita({ fecha: '2026-10-04', hora: '09:00', precio: 10000 });
    await cita({ fecha: '2026-10-05', hora: '09:00', precio: 99000, estado: 'pendiente' });
    const res = await get('?periodo=hoy');
    expect(res.body.periodo.desde).toBe('2026-10-04');
    expect(res.body.actual.ingresos).toBe(10000);
  });

  it('cambio de mes: "mes" va del 1 al día de hoy y se compara con el mismo tramo del mes anterior', async () => {
    ponerReloj('2026-11-01T04:30:00Z'); // 31 de octubre, 23:30 en Bogotá
    await cita({ fecha: '2026-10-31', hora: '09:00', precio: 10000 });
    await cita({ fecha: '2026-10-01', hora: '09:00', precio: 20000 });
    await cita({ fecha: '2026-09-30', hora: '09:00', precio: 40000 });
    let res = await get('?periodo=mes');
    expect(res.body.periodo).toMatchObject({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(res.body.actual.ingresos).toBe(30000);
    expect(res.body.anterior).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' }); // septiembre tiene 30 días: se recorta
    expect(res.body.previo.ingresos).toBe(40000);

    ponerReloj('2026-11-01T05:30:00Z'); // 1 de noviembre, 00:30 en Bogotá
    res = await get('?periodo=mes');
    expect(res.body.periodo).toMatchObject({ desde: '2026-11-01', hasta: '2026-11-01' });
    expect(res.body.actual.completadas).toBe(0);
    expect(res.body.anterior).toEqual({ desde: '2026-10-01', hasta: '2026-10-01' });
    expect(res.body.previo.ingresos).toBe(20000);
  });

  it('sus totales coinciden con la suma de sus citas completadas', async () => {
    const precios = [15000, 25000, 0, 35000, 45000];
    for (const [i, precio] of precios.entries()) {
      await cita({ fecha: `2026-10-0${i + 1}`, hora: '09:00', precio });
    }
    await insertarCita({ barbero_id: 2, fecha: '2026-10-02', hora: '09:00', precio: 88000, estado: 'completada' });
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n, SUM(precio)::int AS total FROM citas
       WHERE barbero_id = 1 AND estado = 'completada' AND fecha BETWEEN '2026-10-01' AND '2026-10-04'`
    );
    const res = await get('?periodo=mes');
    expect(res.body.actual.completadas).toBe(rows[0].n);
    expect(res.body.actual.ingresos).toBe(rows[0].total);
    const ingresos = await get('/ingresos?agrupar=dia');
    expect(ingresos.body.puntos.reduce((s, p) => s + p.ingresos, 0)).toBe(rows[0].total);
    expect(ingresos.body.puntos.reduce((s, p) => s + p.cortes, 0)).toBe(rows[0].n);
  });
});

describe('GET /api/barbero/estadisticas/ingresos', () => {
  it('30 días (y 30 anteriores) con ceros, solo sus datos y con el precio de la cita', async () => {
    await cita({ fecha: '2026-10-04', hora: '09:00', precio: 10000 });
    await cita({ fecha: '2026-10-04', hora: '10:00', precio: 20000 });
    await cita({ fecha: '2026-10-04', hora: '11:00', precio: 5000, estado: 'cancelada' });
    await insertarCita({ barbero_id: 2, fecha: '2026-10-04', hora: '09:00', precio: 90000, estado: 'completada' });
    await cita({ fecha: '2026-09-05', hora: '09:00', precio: 7000 }); // primer día de la serie

    const res = await get('/ingresos');
    expect(res.status).toBe(200);
    expect(res.body.agrupar).toBe('dia');
    expect(res.body.puntos).toHaveLength(30);
    expect(res.body.anteriores).toHaveLength(30);
    expect(res.body.puntos[0]).toEqual({ fecha: '2026-09-05', ingresos: 7000, cortes: 1 });
    expect(res.body.puntos[29]).toEqual({ fecha: '2026-10-04', ingresos: 30000, cortes: 2 });
    expect(res.body.puntos[10]).toEqual({ fecha: '2026-09-15', ingresos: 0, cortes: 0 });
  });

  it('agrupar=mes: 12 meses y los 12 anteriores, solo suyos', async () => {
    await cita({ fecha: '2026-10-04', hora: '09:00', precio: 10000 });
    await cita({ fecha: '2026-09-04', hora: '09:00', precio: 20000 });
    await insertarCita({ barbero_id: 2, fecha: '2026-10-03', hora: '09:00', precio: 90000, estado: 'completada' });
    const res = await get('/ingresos?agrupar=mes');
    expect(res.body.puntos).toHaveLength(12);
    expect(res.body.anteriores).toHaveLength(12);
    expect(res.body.puntos[11]).toEqual({ mes: '2026-10', ingresos: 10000, cortes: 1 });
    expect(res.body.puntos[10]).toEqual({ mes: '2026-09', ingresos: 20000, cortes: 1 });
  });

  it('sin citas: todo en ceros', async () => {
    const res = await get('/ingresos');
    expect(res.body.puntos.every((p) => p.ingresos === 0 && p.cortes === 0)).toBe(true);
  });
});

describe('GET /api/barbero/estadisticas/servicios-top', () => {
  it('sus servicios más pedidos: solo completadas suyas, con ingresos de la cita', async () => {
    await cita({ fecha: '2026-10-04', hora: '09:00', precio: 10000, servicio_id: 1 });
    await cita({ fecha: '2026-10-03', hora: '09:00', precio: 12000, servicio_id: 1 });
    await cita({ fecha: '2026-10-02', hora: '09:00', precio: 30000, servicio_id: 2 });
    await cita({ fecha: '2026-10-02', hora: '10:00', precio: 30000, servicio_id: 2, estado: 'cancelada' });
    await cita({ fecha: '2026-10-02', hora: '11:00', precio: 30000, servicio_id: 2, estado: 'pendiente' });
    for (let i = 0; i < 4; i += 1) {
      await insertarCita({ barbero_id: 2, fecha: '2026-10-0' + (i + 1), hora: '09:00', precio: 1000, servicio_id: 2, estado: 'completada' });
    }

    const res = await get('/servicios-top?periodo=30d');
    expect(res.status).toBe(200);
    expect(res.body.periodo.clave).toBe('30d');
    expect(res.body.servicios.map((s) => [s.id, s.cantidad, s.ingresos])).toEqual([
      [1, 2, 22000],
      [2, 1, 30000], // las 4 del otro barbero con el servicio 2 no suman
    ]);
  });

  it('limite recorta la lista y un periodo sin citas da lista vacía', async () => {
    await cita({ fecha: '2026-10-04', hora: '09:00', servicio_id: 1 });
    await cita({ fecha: '2026-10-04', hora: '10:00', servicio_id: 2 });
    expect((await get('/servicios-top?limite=1')).body.servicios).toHaveLength(1);
    expect((await get('/servicios-top?periodo=hoy&limite=5')).body.servicios).toHaveLength(2);
    await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
    expect((await get('/servicios-top')).body.servicios).toEqual([]);
  });
});

describe('/api/admin/estadisticas sigue contando a todos los barberos', () => {
  it('suma las citas de ambos y no añade "codigo" a sus 400', async () => {
    await cita({ fecha: '2026-10-04', hora: '09:00', precio: 10000 });
    await insertarCita({ barbero_id: 2, fecha: '2026-10-04', hora: '09:00', precio: 70000, estado: 'completada' });
    const res = await request(app).get('/api/admin/estadisticas?periodo=hoy').set('Authorization', `Bearer ${admin}`);
    expect(res.body.actual.ingresos).toBe(80000);
    const malo = await request(app).get('/api/admin/estadisticas?periodo=ayer').set('Authorization', `Bearer ${admin}`);
    expect(malo.status).toBe(400);
    expect(malo.body.codigo).toBeUndefined();
  });
});
