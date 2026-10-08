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

const get = (query = '', token = barbero1) => request(app).get(`/api/barbero/citas${query}`).set('Authorization', `Bearer ${token}`);
const ponerReloj = (iso) => vi.setSystemTime(new Date(iso));
const bogota = (fecha, hora) => `${fecha}T${hora}:00-05:00`;
const clientes = (res) => res.body.items.map((c) => c.cliente);

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

const cita = (extra) => insertarCita({ barbero_id: 1, estado: 'pendiente', duracion_min: 30, ...extra });

// Un escenario con citas en cada pestaña (reloj: 4 de octubre, 22:00).
const sembrar = async () => {
  await cita({ cliente: 'Hoy completada', fecha: '2026-10-04', hora: '09:00', estado: 'completada' });
  await cita({ cliente: 'Hoy vencida', fecha: '2026-10-04', hora: '10:00' }); // termina 10:30 → por confirmar
  await cita({ cliente: 'Hoy cancelada', fecha: '2026-10-04', hora: '12:00', estado: 'cancelada' });
  await cita({ cliente: 'Hoy tarde', fecha: '2026-10-04', hora: '22:30' }); // aún no empieza
  await cita({ cliente: 'Mañana', fecha: '2026-10-05', hora: '09:00' });
  await cita({ cliente: 'Semana pasada', fecha: '2026-09-28', hora: '15:00' }); // por confirmar
  await cita({ cliente: 'Antes completada', fecha: '2026-09-20', hora: '11:00', estado: 'completada' });
  await cita({ cliente: 'Antes cancelada', fecha: '2026-09-21', hora: '11:00', estado: 'cancelada' });
  await insertarCita({ barbero_id: 2, cliente: 'Ajena', fecha: '2026-10-04', hora: '11:00', estado: 'pendiente' });
};

describe('GET /api/barbero/citas: permisos y parámetros', () => {
  it('sin token 401; el admin 403; con la contraseña caducada 403 CONTRASENA_CADUCADA; desactivado 401 SESION_INVALIDA', async () => {
    expect((await request(app).get('/api/barbero/citas')).status).toBe(401);
    expect((await get('', admin)).status).toBe(403);

    await pool.query("UPDATE usuarios SET contrasena_cambiada_en = $1 WHERE usuario = 'barbero1_test'", [new Date(Date.parse(NOCHE_BOGOTA) - 60 * 24 * 3600 * 1000)]);
    const caducada = await get();
    expect(caducada.status).toBe(403);
    expect(caducada.body.codigo).toBe('CONTRASENA_CADUCADA');

    await pool.query("UPDATE usuarios SET contrasena_cambiada_en = $1, activo = false WHERE usuario = 'barbero1_test'", [new Date(NOCHE_BOGOTA)]);
    const inactivo = await get();
    expect(inactivo.status).toBe(401);
    expect(inactivo.body.codigo).toBe('SESION_INVALIDA');
  });

  it('no hay POST, PATCH ni DELETE', async () => {
    for (const metodo of ['post', 'patch', 'delete', 'put']) {
      expect((await request(app)[metodo]('/api/barbero/citas').set('Authorization', `Bearer ${barbero1}`).send({})).status).toBe(404);
    }
  });

  it.each([
    ['?barbero_id=2', /desconocido/],
    ['?barbero=2', /desconocido/],
    ['?x=1', /desconocido/],
    ['?pestana=hoy&pestana=todas', /una sola vez/],
    ['?q=a&q=b', /una sola vez/],
    ['?pagina[]=1', /desconocido/],
  ])('parámetro desconocido o repetido %s → 400 PARAMETRO_INVALIDO', async (query, mensaje) => {
    const res = await get(query);
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('PARAMETRO_INVALIDO');
    expect(res.body.error).toMatch(mensaje);
  });

  it.each([
    ['?pestana=otra', 'pestana'],
    ['?pestana=', 'pestana'],
    ['?desde=2026-02-31', 'desde'],
    ['?hasta=ayer', 'hasta'],
    ['?desde=2026-10-05&hasta=2026-10-01', 'desde'],
    ['?pagina=0', 'pagina'],
    ['?pagina=-1', 'pagina'],
    ['?pagina=1.5', 'pagina'],
    ['?pagina=1000001', 'pagina'],
    ['?limite=0', 'limite'],
    ['?limite=51', 'limite'],
    ['?limite=abc', 'limite'],
    [`?q=${'a'.repeat(101)}`, 'q'],
  ])('valor inválido %s → 400 PARAMETRO_INVALIDO con el campo', async (query, campo) => {
    const res = await get(query);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'PARAMETRO_INVALIDO', campo });
  });

  it('el barbero_id sale del token/base: nunca aparecen citas de otro barbero en ninguna pestaña', async () => {
    await sembrar();
    for (const pestana of ['hoy', 'proximas', 'por_confirmar', 'completadas', 'canceladas', 'todas']) {
      expect(clientes(await get(`?pestana=${pestana}&limite=50`))).not.toContain('Ajena');
    }
    expect(clientes(await get('?pestana=hoy', barbero2))).toEqual(['Ajena']);
    // un token con barbero_id falsificado sigue viendo solo lo del barbero de la base (usuario 2 = barbero 1)
    expect(clientes(await get('?pestana=hoy', firmar(2, 'barbero', 2)))).not.toContain('Ajena');
  });

  it('no devuelve correo ni teléfono del cliente', async () => {
    await sembrar();
    const res = await get('?pestana=todas&limite=50');
    expect(JSON.stringify(res.body)).not.toMatch(/correo|telefono|example\.com|3001234567/);
    expect(Object.keys(res.body.items[0]).sort()).toEqual(
      // fase 6: se añaden area, hermana y reserva_id (ni correo ni teléfono)
      ['area', 'cliente', 'duracion_min', 'estado', 'fecha', 'hermana', 'hora', 'id', 'por_confirmar', 'precio', 'reserva_id', 'servicio_nombre', 'servicios']
    );
  });
});

describe('GET /api/barbero/citas: pestañas', () => {
  beforeEach(sembrar);

  it('por defecto es "hoy": las de hoy no canceladas, por hora', async () => {
    const res = await get();
    expect(clientes(res)).toEqual(['Hoy completada', 'Hoy vencida', 'Hoy tarde']);
    expect(res.body).toMatchObject({ pagina: 1, limite: 10, total: 3 });
    expect(res.body.items[0]).toMatchObject({ fecha: '2026-10-04', hora: '09:00:00', estado: 'completada', duracion_min: 30, precio: 50000, servicio_nombre: 'Corte de prueba' });
  });

  it('próximas: pendientes que aún no empiezan, las más cercanas primero', async () => {
    expect(clientes(await get('?pestana=proximas'))).toEqual(['Hoy tarde', 'Mañana']);
  });

  it('por_confirmar: de la más antigua a la más reciente, con el flag en true', async () => {
    const res = await get('?pestana=por_confirmar');
    expect(clientes(res)).toEqual(['Semana pasada', 'Hoy vencida']);
    expect(res.body.items.every((c) => c.por_confirmar === true)).toBe(true);
  });

  it('completadas y canceladas: las más recientes primero; todas: todas, las más recientes primero', async () => {
    expect(clientes(await get('?pestana=completadas'))).toEqual(['Hoy completada', 'Antes completada']);
    expect(clientes(await get('?pestana=canceladas'))).toEqual(['Hoy cancelada', 'Antes cancelada']);
    expect(clientes(await get('?pestana=todas'))).toEqual([
      'Mañana', 'Hoy tarde', 'Hoy cancelada', 'Hoy vencida', 'Hoy completada', 'Semana pasada', 'Antes cancelada', 'Antes completada',
    ]);
  });

  it('conteos por pestaña en cada respuesta (y el total es el de la pestaña pedida)', async () => {
    for (const pestana of ['hoy', 'canceladas']) {
      const res = await get(`?pestana=${pestana}`);
      expect(res.body.conteos).toEqual({ hoy: 3, proximas: 2, por_confirmar: 2, completadas: 2, canceladas: 2, todas: 8 });
    }
    expect((await get('?pestana=proximas')).body.total).toBe(2);
  });

  it('el flag por_confirmar aparece también en "hoy" y "todas" (no solo en su pestaña)', async () => {
    const res = await get('?pestana=hoy');
    expect(Object.fromEntries(res.body.items.map((c) => [c.cliente, c.por_confirmar]))).toEqual({
      'Hoy completada': false, 'Hoy vencida': true, 'Hoy tarde': false,
    });
  });
});

describe('GET /api/barbero/citas: regla de las 2 horas, medianoche y zona horaria', () => {
  // Reloj fijo 22:00. Cita de 30 min a las 19:30 → límite exacto 22:00.
  it.each([
    ['19:31 (un minuto antes del límite)', '19:31', false],
    ['19:30 (justo en el límite)', '19:30', true],
    ['19:29 (un minuto después)', '19:29', true],
  ])('por_confirmar con la cita de las %s', async (_n, hora, esperada) => {
    await cita({ cliente: 'Límite', fecha: '2026-10-04', hora });
    expect(clientes(await get('?pestana=por_confirmar'))).toEqual(esperada ? ['Límite'] : []);
    expect((await get('?pestana=proximas')).body.conteos.por_confirmar).toBe(esperada ? 1 : 0);
  });

  it('una cita que cruza la medianoche (23:00 + 90 min) vence a las 02:30', async () => {
    await cita({ cliente: 'Noche', fecha: '2026-10-04', hora: '23:00', duracion_min: 90, servicio_id: 2 });
    ponerReloj(bogota('2026-10-05', '02:29'));
    expect(clientes(await get('?pestana=por_confirmar'))).toEqual([]);
    ponerReloj(bogota('2026-10-05', '02:30'));
    expect(clientes(await get('?pestana=por_confirmar'))).toEqual(['Noche']);
    // a las 02:30 del día 5 "hoy" ya es el 5: la cita del 4 no está en "hoy"
    expect(clientes(await get('?pestana=hoy'))).toEqual([]);
  });

  it('Bogotá frente a UTC: a las 22:00 de Bogotá (ya día 5 en UTC) "hoy" sigue siendo el 4', async () => {
    await cita({ cliente: 'Del 4', fecha: '2026-10-04', hora: '21:00' });
    await cita({ cliente: 'Del 5 temprano', fecha: '2026-10-05', hora: '01:00' });
    expect(clientes(await get('?pestana=hoy'))).toEqual(['Del 4']);
    expect(clientes(await get('?pestana=proximas'))).toEqual(['Del 5 temprano']); // en UTC ya habría empezado
  });

  it('hoy frente a próximas: la de hoy que ya empezó está en "hoy" pero no en "próximas"', async () => {
    await cita({ cliente: 'Empezó', fecha: '2026-10-04', hora: '21:30' });
    await cita({ cliente: 'Falta', fecha: '2026-10-04', hora: '22:30' });
    expect(clientes(await get('?pestana=hoy'))).toEqual(['Empezó', 'Falta']);
    expect(clientes(await get('?pestana=proximas'))).toEqual(['Falta']);
  });

  it('usa la duración guardada en la cita para decidir si está por confirmar', async () => {
    await cita({ cliente: 'Duración guardada', fecha: '2026-10-04', hora: '19:00', servicio_id: 2, duracion_min: 30 });
    expect(clientes(await get('?pestana=por_confirmar'))).toEqual(['Duración guardada']); // con 90 min no lo estaría
    const res = await get('?pestana=por_confirmar');
    expect(res.body.items[0].duracion_min).toBe(30);
  });
});

describe('GET /api/barbero/citas: filtros y paginación', () => {
  it('q busca por cliente o por servicio, sin distinguir mayúsculas ni (solo) el inicio', async () => {
    await cita({ cliente: 'Ana Gómez', fecha: '2026-10-03', hora: '10:00' });
    await cita({ cliente: 'Pedro', fecha: '2026-10-03', hora: '11:00', servicio_id: 2 }); // "Combo de prueba"
    expect(clientes(await get('?pestana=todas&q=gómez'))).toEqual(['Ana Gómez']);
    expect(clientes(await get('?pestana=todas&q=COMBO'))).toEqual(['Pedro']);
    expect((await get('?pestana=todas&q=de prueba')).body.total).toBe(2); // nombre de ambos servicios
    expect((await get('?pestana=todas&q=%20%20')).body.total).toBe(2); // solo espacios = sin filtro
  });

  it('q escapa % _ y \\ (no son comodines)', async () => {
    await cita({ cliente: '100% Real', fecha: '2026-10-03', hora: '10:00' });
    await cita({ cliente: 'Juan_Perez', fecha: '2026-10-03', hora: '11:00' });
    await cita({ cliente: 'JuanXPerez', fecha: '2026-10-03', hora: '12:00' });
    await cita({ cliente: 'Ruta\\Larga', fecha: '2026-10-03', hora: '13:00' });
    expect(clientes(await get('?pestana=todas&q=%25'))).toEqual(['100% Real']);
    expect(clientes(await get('?pestana=todas&q=n_p'))).toEqual(['Juan_Perez']);
    expect(clientes(await get(`?pestana=todas&q=${encodeURIComponent('\\')}`))).toEqual(['Ruta\\Larga']);
    expect((await get('?pestana=todas&q=%25%25')).body.total).toBe(0);
  });

  it('desde y hasta (inclusivos) filtran la lista y también los conteos de las pestañas', async () => {
    await cita({ cliente: 'Uno', fecha: '2026-09-30', hora: '10:00' });
    await cita({ cliente: 'Dos', fecha: '2026-10-01', hora: '10:00' });
    await cita({ cliente: 'Tres', fecha: '2026-10-02', hora: '10:00' });
    await cita({ cliente: 'Cuatro', fecha: '2026-10-03', hora: '10:00' });
    const res = await get('?pestana=todas&desde=2026-10-01&hasta=2026-10-02');
    expect(clientes(res)).toEqual(['Tres', 'Dos']);
    expect(res.body.conteos).toMatchObject({ todas: 2, por_confirmar: 2 });
    expect(clientes(await get('?pestana=todas&desde=2026-10-03'))).toEqual(['Cuatro']);
    expect(clientes(await get('?pestana=todas&hasta=2026-09-30'))).toEqual(['Uno']);
    expect((await get('?pestana=hoy&desde=2026-10-05')).body.total).toBe(0); // el rango no incluye hoy
  });

  it('combina q, fechas y pestaña', async () => {
    await cita({ cliente: 'Ana Uno', fecha: '2026-10-02', hora: '10:00' });
    await cita({ cliente: 'Ana Dos', fecha: '2026-10-03', hora: '10:00', estado: 'completada' });
    await cita({ cliente: 'Luis', fecha: '2026-10-03', hora: '11:00' });
    expect(clientes(await get('?pestana=por_confirmar&q=ana&desde=2026-10-03'))).toEqual([]);
    expect(clientes(await get('?pestana=completadas&q=ana&desde=2026-10-03'))).toEqual(['Ana Dos']);
  });

  it('pagina con limite y devuelve el total; el límite máximo es 50', async () => {
    for (let i = 0; i < 12; i += 1) await cita({ cliente: `C${String(i).padStart(2, '0')}`, fecha: '2026-09-10', hora: `${String(8 + i).padStart(2, '0')}:00`, estado: 'completada' });
    const p1 = await get('?pestana=completadas&limite=5');
    const p3 = await get('?pestana=completadas&limite=5&pagina=3');
    expect(p1.body).toMatchObject({ pagina: 1, limite: 5, total: 12 });
    expect(clientes(p1)).toEqual(['C11', 'C10', 'C09', 'C08', 'C07']); // más recientes primero
    expect(clientes(p3)).toEqual(['C01', 'C00']);
    expect((await get('?pestana=completadas&limite=50')).body.items).toHaveLength(12);
  });

  it('una página fuera de rango devuelve items vacíos con el total (convención de /api/admin/citas)', async () => {
    await cita({ cliente: 'Única', fecha: '2026-09-10', hora: '10:00', estado: 'completada' });
    const res = await get('?pestana=completadas&pagina=9');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], pagina: 9, total: 1 });
  });
});
