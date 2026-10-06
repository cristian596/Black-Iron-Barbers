import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { NOCHE_BOGOTA, HOY, firmarToken, insertarCita, reiniciarContador } from './utilsPrueba.js';

const app = crearApp();

let admin;
let barbero;
const get = (ruta, token = admin) => request(app).get(ruta).set('Authorization', `Bearer ${token}`);

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOCHE_BOGOTA)); // 22:00 en Bogotá
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

describe('permisos de GET /api/admin/citas', () => {
  it('401 sin token', async () => {
    expect((await request(app).get('/api/admin/citas')).status).toBe(401);
  });

  it('403 con rol barbero', async () => {
    expect((await get('/api/admin/citas', barbero)).status).toBe(403);
  });

  it('200 con rol admin y estructura paginada', async () => {
    const res = await get('/api/admin/citas');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0, pagina: 1, limite: 10 });
  });
});

describe('validación de parámetros', () => {
  it.each([
    ['otro=1', /desconocido/],
    ['pestana=todas&pestana=canceladas', /una sola vez/],
    ['pestana[]=todas', /desconocido|una sola vez/],
    ['pestana=pasadas', /pestana/],
    ['pestana=', /pestana/],
    ['desde=2026-02-31', /desde/],
    ['hasta=ayer', /hasta/],
    ['desde=2026-10-05&hasta=2026-10-01', /posterior/],
    ['barbero=abc', /barbero/],
    ['barbero=99999999999', /barbero/],
    ['barbero=1.5', /barbero/],
    ['pagina=0', /pagina/],
    ['pagina=-1', /pagina/],
    ['pagina=abc', /pagina/],
    ['pagina=1000001', /pagina/],
    ['limite=0', /limite/],
    ['limite=51', /limite/],
    ['limite=abc', /limite/],
    [`q=${'a'.repeat(101)}`, /100 caracteres/],
  ])('%s → 400', async (consulta, mensaje) => {
    const res = await get(`/api/admin/citas?${consulta}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(mensaje);
  });

  it('el límite máximo (50) y el mínimo (1) son válidos', async () => {
    expect((await get('/api/admin/citas?limite=50')).status).toBe(200);
    expect((await get('/api/admin/citas?limite=1')).status).toBe(200);
  });
});

describe('pestañas y marca "Vencida" (reloj: 22:00 del 4 de oct en Bogotá)', () => {
  beforeEach(async () => {
    await insertarCita({ fecha: HOY, hora: '20:00', barbero_id: 1, estado: 'pendiente', cliente: 'Hoy ya pasó' });
    await insertarCita({ fecha: HOY, hora: '22:30', barbero_id: 1, estado: 'pendiente', cliente: 'Hoy más tarde' });
    await insertarCita({ fecha: '2026-10-05', hora: '10:00', barbero_id: 1, estado: 'pendiente', cliente: 'Mañana' });
    await insertarCita({ fecha: '2026-10-01', hora: '10:00', barbero_id: 1, estado: 'pendiente', cliente: 'Semana pasada' });
    await insertarCita({ fecha: '2026-10-03', hora: '10:00', barbero_id: 1, estado: 'completada', cliente: 'Completada' });
    await insertarCita({ fecha: '2026-10-02', hora: '10:00', barbero_id: 1, estado: 'cancelada', cliente: 'Cancelada' });
  });

  const clientes = (res) => res.body.items.map((c) => c.cliente);

  it('"proximas": solo pendientes que aún no empiezan, de la más cercana a la más lejana', async () => {
    const res = await get('/api/admin/citas?pestana=proximas');
    expect(clientes(res)).toEqual(['Hoy más tarde', 'Mañana']);
    expect(res.body.total).toBe(2);
  });

  it('"todas": incluye todo, lo más reciente primero, y marca las vencidas', async () => {
    const res = await get('/api/admin/citas?pestana=todas');
    expect(clientes(res)).toEqual([
      'Mañana', 'Hoy más tarde', 'Hoy ya pasó', 'Completada', 'Cancelada', 'Semana pasada',
    ]);
    const vencidas = res.body.items.filter((c) => c.vencida).map((c) => c.cliente);
    expect(vencidas.sort()).toEqual(['Hoy ya pasó', 'Semana pasada']);
    expect(res.body.items.find((c) => c.cliente === 'Completada').vencida).toBe(false);
  });

  it('una pendiente vencida no aparece en "proximas"', async () => {
    const res = await get('/api/admin/citas?pestana=proximas');
    expect(clientes(res)).not.toContain('Hoy ya pasó');
    expect(clientes(res)).not.toContain('Semana pasada');
  });

  it('"canceladas": solo las canceladas', async () => {
    const res = await get('/api/admin/citas?pestana=canceladas');
    expect(clientes(res)).toEqual(['Cancelada']);
  });

  it('la pestaña por defecto es "todas"', async () => {
    const res = await get('/api/admin/citas');
    expect(res.body.total).toBe(6);
  });

  it('cada cita trae el barbero, el servicio, el estado y fecha/hora como texto; sin datos internos', async () => {
    const res = await get('/api/admin/citas?pestana=canceladas');
    expect(res.body.items[0]).toEqual({
      id: expect.any(Number),
      cliente: 'Cancelada',
      correo: 'c@example.com',
      telefono: '3001234567',
      fecha: '2026-10-02',
      hora: '10:00:00',
      estado: 'cancelada',
      duracion_min: 30,
      precio: 50000,
      servicio_id: 1,
      barbero_id: 1,
      servicio_nombre: 'Corte de prueba',
      servicios: [{ id: 1, nombre: 'Corte de prueba', duracion_min: 30, precio: 50000 }],
      barbero_nombre: 'Barbero Uno',
      vencida: false,
    });
  });

  it('combina pestaña, rango de fechas y barbero', async () => {
    await insertarCita({ fecha: '2026-10-05', hora: '11:00', barbero_id: 2, estado: 'pendiente', cliente: 'Mañana B2' });

    const res = await get('/api/admin/citas?pestana=proximas&barbero=2');
    expect(clientes(res)).toEqual(['Mañana B2']);

    const rango = await get('/api/admin/citas?desde=2026-10-02&hasta=2026-10-03');
    expect(clientes(rango).sort()).toEqual(['Cancelada', 'Completada']);

    const unDia = await get('/api/admin/citas?desde=2026-10-05&hasta=2026-10-05');
    expect(unDia.body.total).toBe(2);
  });
});

describe('búsqueda (q)', () => {
  beforeEach(async () => {
    await insertarCita({ fecha: HOY, cliente: '100% Pérez', servicio_id: 1 });
    await insertarCita({ fecha: HOY, cliente: 'Ana_B', servicio_id: 1 });
    await insertarCita({ fecha: HOY, cliente: 'AnaxB', servicio_id: 2 });
    await insertarCita({ fecha: HOY, cliente: 'Ruta\\Dos', servicio_id: 1 });
  });

  const clientes = (res) => res.body.items.map((c) => c.cliente).sort();

  it('"%" se busca como símbolo literal, no como comodín', async () => {
    const res = await get(`/api/admin/citas?q=${encodeURIComponent('%')}`);
    expect(clientes(res)).toEqual(['100% Pérez']);
  });

  it('"_" se busca como símbolo literal, no como un carácter cualquiera', async () => {
    const res = await get(`/api/admin/citas?q=${encodeURIComponent('Ana_')}`);
    expect(clientes(res)).toEqual(['Ana_B']);
  });

  it('"\\" se busca como símbolo literal', async () => {
    const res = await get(`/api/admin/citas?q=${encodeURIComponent('\\')}`);
    expect(clientes(res)).toEqual(['Ruta\\Dos']);
  });

  it('ignora mayúsculas y minúsculas', async () => {
    const res = await get(`/api/admin/citas?q=${encodeURIComponent('pérez')}`);
    expect(clientes(res)).toEqual(['100% Pérez']);
  });

  it('busca también por nombre de servicio y de barbero', async () => {
    const porServicio = await get('/api/admin/citas?q=combo');
    expect(clientes(porServicio)).toEqual(['AnaxB']);

    const porBarbero = await get('/api/admin/citas?q=barbero%20dos');
    expect(porBarbero.body.items.every((c) => c.barbero_nombre === 'Barbero Dos')).toBe(true);
    expect(porBarbero.body.total).toBeGreaterThan(0);
  });

  it('un q vacío o de solo espacios no filtra', async () => {
    expect((await get('/api/admin/citas?q=')).body.total).toBe(4);
    expect((await get('/api/admin/citas?q=%20%20')).body.total).toBe(4);
  });

  it('una inyección SQL en q es solo texto: no rompe ni devuelve nada', async () => {
    const res = await get(`/api/admin/citas?q=${encodeURIComponent("'; DROP TABLE citas; --")}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM citas')).rows[0].n).toBe(4);
  });
});

describe('paginación', () => {
  beforeEach(async () => {
    for (let i = 1; i <= 12; i += 1) {
      await insertarCita({ fecha: `2026-09-${String(i).padStart(2, '0')}`, cliente: `Cliente ${i}` });
    }
  });

  it('por defecto 10 por página y el total real', async () => {
    const res = await get('/api/admin/citas');
    expect(res.body.items).toHaveLength(10);
    expect(res.body).toMatchObject({ total: 12, pagina: 1, limite: 10 });
  });

  it('la última página trae el resto y no repite filas', async () => {
    const p1 = await get('/api/admin/citas?limite=5&pagina=1');
    const p2 = await get('/api/admin/citas?limite=5&pagina=2');
    const p3 = await get('/api/admin/citas?limite=5&pagina=3');

    expect(p3.body.items).toHaveLength(2);
    const ids = [...p1.body.items, ...p2.body.items, ...p3.body.items].map((c) => c.id);
    expect(new Set(ids).size).toBe(12);
    expect(p3.body).toMatchObject({ total: 12, pagina: 3, limite: 5 });
  });

  it('una página más allá del final devuelve items vacío con el total correcto', async () => {
    const res = await get('/api/admin/citas?pagina=99');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(12);
  });

  it('el total respeta los filtros', async () => {
    const res = await get('/api/admin/citas?desde=2026-09-10&limite=1');
    expect(res.body.total).toBe(3);
    expect(res.body.items).toHaveLength(1);
  });
});
