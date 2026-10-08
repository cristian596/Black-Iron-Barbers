import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { firmarToken, insertarCita, reiniciarContador } from './utilsPrueba.js';
import { esConflictoDeHorario, esErrorAreaProfesional, esAreaValida, AREAS } from '../utils/areas.js';

// Fase 2 de asesorías: todo lo existente respeta el área. Las pruebas crean sus propios datos (ids 91xx, nombres
// "Prueba Area…") y los borran: no dependen del seed del catálogo.

const app = crearApp();
const FECHA = '2030-07-16';

const ASESOR = 9101; // barbero con area 'asesoria'
const CAT_ASESORIA = 9101;
const CAT_CORTES = 9102;
const CAT_MIXTA = 9103; // categoría de barbería con un servicio de cada área (para el conteo de total_servicios)
const SERV_ASESORIA = 9101; // area asesoria, 30 min
const SERV_CORTE = 9102; // area barberia, 30 min
const SERV_CORTE_2 = 9103; // area barberia
const SERV_MIXTO_ASESORIA = 9104; // area asesoria, dentro de la categoría mixta
const SERV_MIXTO_CORTE = 9105; // area barberia, dentro de la categoría mixta
const IDS_SERVICIOS = [SERV_ASESORIA, SERV_CORTE, SERV_CORTE_2, SERV_MIXTO_ASESORIA, SERV_MIXTO_CORTE];

let admin;
let barbero1;

const credenciales = () => ({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
});

const limpiar = async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  await pool.query("DELETE FROM usuarios WHERE usuario LIKE 'prueba_area_%'");
  await pool.query("DELETE FROM barberos WHERE nombre LIKE 'Prueba Area%'");
  await pool.query('UPDATE barberos SET area = $1, activo = true WHERE id IN (1, 2)', ['barberia']);
};

const borrarCatalogoPrueba = async () => {
  await pool.query('DELETE FROM servicios WHERE id = ANY($1::int[])', [IDS_SERVICIOS]);
  await pool.query('DELETE FROM categorias WHERE id = ANY($1::int[])', [[CAT_ASESORIA, CAT_CORTES, CAT_MIXTA]]);
};

beforeAll(async () => {
  await limpiar();
  await borrarCatalogoPrueba();
  await pool.query('DELETE FROM barberos WHERE id = $1', [ASESOR]);
  await pool.query("SELECT setval('barberos_id_seq', GREATEST((SELECT MAX(id) FROM barberos), 2))");
  await pool.query(
    `INSERT INTO barberos (id, nombre, cargo, especialidad, area) VALUES ($1, 'Prueba Area Asesora', 'Asesora de Imagen', 'Asesoria', 'asesoria')`,
    [ASESOR]
  );
  await pool.query(
    `INSERT INTO categorias (id, nombre, slug, orden, area) VALUES
       ($1, 'Prueba Area Asesorias', 'prueba-area-asesorias', 9101, 'asesoria'),
       ($2, 'Prueba Area Cortes', 'prueba-area-cortes', 9102, 'barberia'),
       ($3, 'Prueba Area Mixta', 'prueba-area-mixta', 9103, 'barberia')`,
    [CAT_ASESORIA, CAT_CORTES, CAT_MIXTA]
  );
  await pool.query(
    `INSERT INTO servicios (id, nombre, duracion_min, precio, categoria_id, tipo, descripcion, area) VALUES
       ($1, 'Prueba Area asesoría', 30, 0, $6, 'original', 'x', 'asesoria'),
       ($2, 'Prueba Area corte', 30, 10000, $7, 'original', 'x', 'barberia'),
       ($3, 'Prueba Area corte 2', 30, 12000, $7, 'elite', 'x', 'barberia'),
       ($4, 'Prueba Area mixto asesoría', 30, 5000, $8, 'original', 'x', 'asesoria'),
       ($5, 'Prueba Area mixto corte', 30, 5000, $8, 'original', 'x', 'barberia')`,
    [SERV_ASESORIA, SERV_CORTE, SERV_CORTE_2, SERV_MIXTO_ASESORIA, SERV_MIXTO_CORTE, CAT_ASESORIA, CAT_CORTES, CAT_MIXTA]
  );
  admin = firmarToken('admin');
  barbero1 = firmarToken('barbero');
});

beforeEach(async () => {
  reiniciarContador();
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  // Los empleados que crea cada prueba no pasan a la siguiente (la asesora fija sí se conserva).
  await pool.query("DELETE FROM usuarios WHERE usuario LIKE 'prueba_area_%'");
  await pool.query("DELETE FROM barberos WHERE nombre LIKE 'Prueba Area%' AND id <> $1", [ASESOR]);
  await pool.query('UPDATE barberos SET area = $1, activo = true WHERE id IN (1, 2)', ['barberia']);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await limpiar();
  await borrarCatalogoPrueba();
  await pool.query('DELETE FROM barberos WHERE id = $1', [ASESOR]);
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const reservar = (extra = {}) =>
  request(app).post('/api/citas').send({
    cliente: 'Cliente de prueba',
    correo: 'cliente@example.com',
    telefono: '3001234567',
    consentimiento: true,
    servicio_id: SERV_CORTE,
    fecha: FECHA,
    hora: '10:00',
    ...extra,
  });
const disponibilidad = (query) => request(app).get('/api/disponibilidad').query({ fecha: FECHA, ...query });
const contarCitas = async (barberoId) =>
  (await pool.query('SELECT COUNT(*)::int AS n FROM citas WHERE ($1::int IS NULL OR barbero_id = $1)', [barberoId ?? null])).rows[0].n;
const ids = (cuerpo) => cuerpo.map((x) => x.id);

describe('Utilidades de área', () => {
  it('solo existen dos áreas y se validan de forma estricta', () => {
    expect(AREAS).toEqual(['barberia', 'asesoria']);
    expect(esAreaValida('barberia')).toBe(true);
    expect(esAreaValida('asesoria')).toBe(true);
    for (const malo of ['', 'Barberia', 'otra', undefined, null, ['barberia']]) expect(esAreaValida(malo)).toBe(false);
  });

  it('esConflictoDeHorario distingue por código y por restricción', () => {
    expect(esConflictoDeHorario({ code: '23P01', constraint: 'citas_sin_solapamiento' })).toBe(true);
    expect(esConflictoDeHorario({ code: '23P01' })).toBe(true); // deadlock reintentado se reclasifica así
    expect(esConflictoDeHorario({ code: '23505', constraint: 'citas_pkey' })).toBe(true);
    expect(esConflictoDeHorario({ code: '23505', constraint: 'asesoria_gratis_usos_correo_norm_key' })).toBe(false);
    expect(esConflictoDeHorario({ code: '23505', constraint: 'asesoria_gratis_usos_telefono_norm_key' })).toBe(false);
    expect(esConflictoDeHorario({ code: 'BI001', constraint: 'cita_servicios_area_profesional' })).toBe(false);
    expect(esConflictoDeHorario(new Error('otro'))).toBe(false);
  });

  it('el error REAL del trigger de la base se reconoce como área incompatible y nunca como conflicto de horario', async () => {
    const cliente = await pool.connect();
    let error;
    try {
      await cliente.query('BEGIN');
      const { rows } = await cliente.query(
        `INSERT INTO citas (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio)
         VALUES ('T', 't@t.com', '3001234567', $1, $2, $3, '15:00', 30, 0) RETURNING id`,
        [SERV_CORTE, ASESOR, FECHA]
      );
      await cliente.query(
        `INSERT INTO cita_servicios (cita_id, servicio_id, orden, nombre, duracion_min, precio) VALUES ($1, $2, 1, 'x', 30, 0)`,
        [rows[0].id, SERV_CORTE]
      );
      await cliente.query('COMMIT'); // el trigger diferido lanza aquí
    } catch (err) {
      error = err;
      await cliente.query('ROLLBACK').catch(() => {});
    } finally {
      cliente.release();
    }
    expect(error?.code).toBe('BI001');
    expect(error.constraint).toBe('cita_servicios_area_profesional');
    expect(esErrorAreaProfesional(error)).toBe(true);
    expect(esConflictoDeHorario(error)).toBe(false);
  });
});

describe('GET /api/servicios?area=', () => {
  const listar = (query = {}) => request(app).get('/api/servicios').query(query);

  it('sin area devuelve todo (compatible): cortes y asesorías', async () => {
    const res = await listar();
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual(expect.arrayContaining([SERV_ASESORIA, SERV_CORTE, SERV_MIXTO_ASESORIA]));
  });

  it('area=barberia no contiene ninguna asesoría', async () => {
    const res = await listar({ area: 'barberia' });
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual(expect.arrayContaining([SERV_CORTE, SERV_CORTE_2, SERV_MIXTO_CORTE, 1, 2]));
    expect(ids(res.body)).not.toContain(SERV_ASESORIA);
    expect(ids(res.body)).not.toContain(SERV_MIXTO_ASESORIA);
  });

  it('area=asesoria solo trae asesorías', async () => {
    const res = await listar({ area: 'asesoria' });
    expect(res.status).toBe(200);
    expect(ids(res.body).sort()).toEqual([SERV_ASESORIA, SERV_MIXTO_ASESORIA]);
  });

  it('funciona junto a agrupar=categoria y a los demás filtros', async () => {
    const res = await listar({ area: 'asesoria', agrupar: 'categoria' });
    expect(res.status).toBe(200);
    expect(res.body.flatMap((g) => ids(g.servicios)).sort()).toEqual([SERV_ASESORIA, SERV_MIXTO_ASESORIA]);
    const porTipo = await listar({ area: 'barberia', tipo: 'elite' });
    expect(ids(porTipo.body)).toContain(SERV_CORTE_2);
    expect(ids(porTipo.body)).not.toContain(SERV_CORTE);
  });

  it.each([['otra'], [''], ['Barberia'], ['asesoria,barberia']])('area=%j inválida → 400', async (valor) => {
    const res = await listar({ area: valor });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/area/);
  });

  it('area repetida (?area=a&area=b o area[]=) → 400', async () => {
    expect((await request(app).get('/api/servicios?area=barberia&area=asesoria')).status).toBe(400);
    expect((await request(app).get('/api/servicios?area[]=barberia')).status).toBe(400);
  });
});

describe('GET /api/categorias?area=', () => {
  const listar = (query = {}) => request(app).get('/api/categorias').query(query);
  const total = (cuerpo, id) => cuerpo.find((c) => c.id === id)?.total_servicios;

  it('sin area devuelve todas las activas y cuenta todos sus servicios activos', async () => {
    const res = await listar();
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual(expect.arrayContaining([CAT_ASESORIA, CAT_CORTES, CAT_MIXTA]));
    expect(total(res.body, CAT_MIXTA)).toBe(2);
  });

  it('area=barberia no lista la categoría de asesorías y total_servicios cuenta solo servicios de barbería', async () => {
    const res = await listar({ area: 'barberia' });
    expect(res.status).toBe(200);
    expect(ids(res.body)).not.toContain(CAT_ASESORIA);
    expect(ids(res.body)).toEqual(expect.arrayContaining([CAT_CORTES, CAT_MIXTA]));
    expect(total(res.body, CAT_MIXTA)).toBe(1); // 1 de barbería (el de asesoría no cuenta)
    expect(total(res.body, CAT_CORTES)).toBe(2);
  });

  it('area=asesoria solo lista categorías de asesoría, con su conteo', async () => {
    const res = await listar({ area: 'asesoria' });
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual([CAT_ASESORIA]);
    expect(total(res.body, CAT_ASESORIA)).toBe(1);
  });

  it('un servicio inactivo no se cuenta en ningún caso', async () => {
    await pool.query('UPDATE servicios SET activo = false WHERE id = $1', [SERV_CORTE_2]);
    try {
      expect(total((await listar({ area: 'barberia' })).body, CAT_CORTES)).toBe(1);
    } finally {
      await pool.query('UPDATE servicios SET activo = true WHERE id = $1', [SERV_CORTE_2]);
    }
  });

  it.each([['otra'], [''], ['ASESORIA']])('area=%j inválida → 400', async (valor) => {
    const res = await listar({ area: valor });
    expect(res.status).toBe(400);
  });

  it('area repetida → 400', async () => {
    expect((await request(app).get('/api/categorias?area=barberia&area=asesoria')).status).toBe(400);
  });
});

describe('GET /api/barberos', () => {
  it('sigue devolviendo a todo el personal activo y añade el área de cada uno', async () => {
    const res = await request(app).get('/api/barberos');
    expect(res.status).toBe(200);
    for (const b of res.body) expect(AREAS).toContain(b.area);
    expect(res.body.find((b) => b.id === ASESOR)).toMatchObject({ nombre: 'Prueba Area Asesora', area: 'asesoria' });
    expect(res.body.find((b) => b.id === 1)).toMatchObject({ area: 'barberia' });
    expect(res.body.find((b) => b.id === 2)).toMatchObject({ area: 'barberia' });
  });

  it('un asesor inactivo no aparece (como cualquier inactivo)', async () => {
    await pool.query('UPDATE barberos SET activo = false WHERE id = $1', [ASESOR]);
    try {
      expect(ids((await request(app).get('/api/barberos')).body)).not.toContain(ASESOR);
    } finally {
      await pool.query('UPDATE barberos SET activo = true WHERE id = $1', [ASESOR]);
    }
  });
});

describe('GET /api/disponibilidad y las áreas', () => {
  it('"cualquier barbero" nunca cuenta al asesor: con los barberos ocupados no hay hora aunque el asesor esté libre', async () => {
    await insertarCita({ fecha: FECHA, hora: '10:00', barbero_id: 1, estado: 'pendiente', servicio_id: SERV_CORTE });
    await insertarCita({ fecha: FECHA, hora: '10:00', barbero_id: 2, estado: 'pendiente', servicio_id: SERV_CORTE });

    const res = await disponibilidad({ servicio: SERV_CORTE });
    expect(res.status).toBe(200);
    expect(res.body.barbero_id).toBeNull();
    expect(res.body.horas).not.toContain('10:00');
    expect(res.body.horas).toContain('09:00');
    expect(res.body.horas).toContain('10:30');
  });

  it('lo mismo con varios servicios (servicios=a,b)', async () => {
    await insertarCita({ fecha: FECHA, hora: '11:00', barbero_id: 1, estado: 'pendiente', servicio_id: SERV_CORTE });
    await insertarCita({ fecha: FECHA, hora: '11:00', barbero_id: 2, estado: 'pendiente', servicio_id: SERV_CORTE });

    const res = await disponibilidad({ servicios: `${SERV_CORTE},${SERV_CORTE_2}` });
    expect(res.status).toBe(200);
    expect(res.body.horas).not.toContain('11:00');
  });

  it('barbero=<asesor> → 400 PROFESIONAL_INCOMPATIBLE con campo', async () => {
    const res = await disponibilidad({ servicio: SERV_CORTE, barbero: ASESOR });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'PROFESIONAL_INCOMPATIBLE', campo: 'barbero' });
  });

  it('barbero=<barbero de barbería> sigue funcionando', async () => {
    const res = await disponibilidad({ servicios: String(SERV_CORTE), barbero: 1 });
    expect(res.status).toBe(200);
    expect(res.body.barbero_id).toBe(1);
  });

  it.each([
    ['servicio', { servicio: SERV_ASESORIA }],
    ['servicios', { servicios: String(SERV_ASESORIA) }],
    ['mezclado con un corte', { servicios: `${SERV_CORTE},${SERV_ASESORIA}` }],
  ])('un servicio de asesoría (%s) → 400 ASESORIA_NO_DISPONIBLE_AUN (temporal)', async (_n, query) => {
    const res = await disponibilidad(query);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'ASESORIA_NO_DISPONIBLE_AUN', servicios_asesoria: [SERV_ASESORIA] });
  });

  it('asesoría + id del asesor: gana el código de asesoría (el servicio se valida primero)', async () => {
    const res = await disponibilidad({ servicio: SERV_ASESORIA, barbero: ASESOR });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('ASESORIA_NO_DISPONIBLE_AUN');
  });
});

describe('POST /api/citas y las áreas', () => {
  it('la asignación automática no elige al asesor: con 1 y 2 ocupados responde 409 y no crea cita', async () => {
    await insertarCita({ fecha: FECHA, hora: '10:00', barbero_id: 1, estado: 'pendiente', servicio_id: SERV_CORTE });
    await insertarCita({ fecha: FECHA, hora: '10:00', barbero_id: 2, estado: 'pendiente', servicio_id: SERV_CORTE });

    const res = await reservar({ hora: '10:00' });
    expect(res.status).toBe(409);
    expect(await contarCitas(ASESOR)).toBe(0);
  });

  it('en una hora libre se asigna a un barbero de barbería, nunca al asesor', async () => {
    const asignados = new Set();
    for (const hora of ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']) {
      const res = await reservar({ hora, correo: `c${hora}@example.com` });
      expect(res.status).toBe(201);
      asignados.add(res.body.barbero_id);
    }
    expect([...asignados].every((id) => [1, 2].includes(id))).toBe(true);
    expect(await contarCitas(ASESOR)).toBe(0);
  });

  it('barbero_id de un asesor → 400 PROFESIONAL_INCOMPATIBLE y no se crea nada', async () => {
    const res = await reservar({ barbero_id: ASESOR });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'PROFESIONAL_INCOMPATIBLE', campo: 'barbero_id' });
    expect(await contarCitas()).toBe(0);
  });

  it('barbero_id de un barbero de barbería sigue funcionando', async () => {
    const res = await reservar({ barbero_id: 2 });
    expect(res.status).toBe(201);
    expect(res.body.barbero_id).toBe(2);
  });

  it.each([
    ['servicio_id', { servicio_id: SERV_ASESORIA }],
    ['servicios_ids', { servicio_id: undefined, servicios_ids: [SERV_ASESORIA] }],
    ['combo con un corte', { servicio_id: undefined, servicios_ids: [SERV_CORTE, SERV_ASESORIA] }],
  ])('un servicio de asesoría (%s) → 400 ASESORIA_NO_DISPONIBLE_AUN y no se crea nada', async (_n, extra) => {
    const res = await reservar(extra);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'ASESORIA_NO_DISPONIBLE_AUN', servicios_asesoria: [SERV_ASESORIA] });
    expect(await contarCitas()).toBe(0);
  });

  it('el error del trigger (carrera: el barbero cambia de área justo antes del COMMIT) llega como 400 PROFESIONAL_INCOMPATIBLE, nunca 500 ni "horario ocupado"', async () => {
    const lateral = new pg.Pool(credenciales()); // otra conexión: el pool de la app queda libre para la reserva
    const original = pool.connect.bind(pool);
    let interceptando = true; // el interruptor garantiza que nada de esto sobreviva a la prueba aunque el restore falle
    const espia = vi.spyOn(pool, 'connect').mockImplementation((alTerminar) => {
      if (!interceptando || typeof alTerminar === 'function') return original(alTerminar); // pool.query usa la forma con callback
      return original().then((cliente) => {
        const consultar = cliente.query.bind(cliente);
        cliente.query = async (...args) => {
          if (interceptando && args[0] === 'COMMIT') await lateral.query("UPDATE barberos SET area = 'asesoria' WHERE id = 1");
          return consultar(...args);
        };
        return cliente;
      });
    });

    try {
      const res = await reservar({ barbero_id: 1, hora: '14:00' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ codigo: 'PROFESIONAL_INCOMPATIBLE', campo: 'barbero_id' });
      expect(res.body.error).not.toMatch(/horario ya está reservado/);
      expect(await contarCitas()).toBe(0); // el COMMIT fallido no dejó cita ni líneas
      expect((await pool.query('SELECT COUNT(*)::int AS n FROM cita_servicios')).rows[0].n).toBe(0);
    } finally {
      interceptando = false;
      espia.mockRestore();
      await lateral.query("UPDATE barberos SET area = 'barberia' WHERE id = 1");
      await lateral.end();
    }
  });
});

describe('PATCH /api/citas/:id (reasignación del admin) y las áreas', () => {
  const reasignar = (citaId, barberoId) =>
    request(app).patch(`/api/citas/${citaId}`).set(auth(admin)).send({ barbero_id: barberoId });

  it('un corte no se puede reasignar al asesor: 409 PROFESIONAL_INCOMPATIBLE y la cita no cambia', async () => {
    const citaId = await insertarCita({ fecha: FECHA, hora: '10:00', barbero_id: 1, estado: 'pendiente', servicio_id: SERV_CORTE });

    const res = await reasignar(citaId, ASESOR);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ codigo: 'PROFESIONAL_INCOMPATIBLE', campo: 'barbero_id' });
    expect((await pool.query('SELECT barbero_id FROM citas WHERE id = $1', [citaId])).rows[0].barbero_id).toBe(1);
  });

  it('un corte sí se reasigna a otro barbero de barbería', async () => {
    const citaId = await insertarCita({ fecha: FECHA, hora: '10:00', barbero_id: 1, estado: 'pendiente', servicio_id: SERV_CORTE });
    const res = await reasignar(citaId, 2);
    expect(res.status).toBe(200);
    expect(res.body.barbero_id).toBe(2);
  });

  it('una asesoría no se puede reasignar a un barbero de barbería', async () => {
    const citaId = await insertarCita({ fecha: FECHA, hora: '10:00', barbero_id: ASESOR, estado: 'pendiente', servicio_id: SERV_ASESORIA });

    const res = await reasignar(citaId, 1);
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('PROFESIONAL_INCOMPATIBLE');
    expect((await pool.query('SELECT barbero_id FROM citas WHERE id = $1', [citaId])).rows[0].barbero_id).toBe(ASESOR);
  });

  it('el barbero sigue sin poder reasignar (403) y el 404/400 de siempre no cambian', async () => {
    const citaId = await insertarCita({ fecha: FECHA, hora: '10:00', barbero_id: 1, estado: 'pendiente', servicio_id: SERV_CORTE });
    const prohibido = await request(app).patch(`/api/citas/${citaId}`).set(auth(barbero1)).send({ barbero_id: 2 });
    expect(prohibido.status).toBe(403);
    expect((await reasignar(citaId, 987654)).status).toBe(400);
  });
});

describe('Empleados con área (/api/admin/empleados)', () => {
  const api = (metodo, ruta) => request(app)[metodo](`/api/admin${ruta}`).set(auth(admin));
  const nuevo = (extra = {}) => ({
    nombre: 'Prueba Area Empleado',
    usuario: 'prueba_area_empleado',
    contrasena: 'clave-segura-1',
    ...extra,
  });
  const crear = async (extra = {}) => {
    const res = await api('post', '/empleados').send(nuevo(extra));
    expect(res.status).toBe(201);
    return res.body;
  };

  it('por defecto crea barberos de barbería; acepta area asesoria', async () => {
    const barbero = await crear();
    expect(barbero.area).toBe('barberia');

    const asesora = await crear({ nombre: 'Prueba Area Asesora Dos', usuario: 'prueba_area_asesora2', area: 'asesoria' });
    expect(asesora.area).toBe('asesoria');
    expect((await pool.query('SELECT area FROM barberos WHERE id = $1', [asesora.id])).rows[0].area).toBe('asesoria');
  });

  it('area inválida → 400 DATOS_INVALIDOS con campo, y no deja un barbero huérfano', async () => {
    const antes = await contarBarberos();
    for (const malo of ['otra', '', 'Barberia', null, 5]) {
      const res = await api('post', '/empleados').send(nuevo({ area: malo }));
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ codigo: 'DATOS_INVALIDOS', campo: 'area' });
    }
    expect(await contarBarberos()).toBe(antes);
  });

  it('el listado incluye el área de cada empleado', async () => {
    const res = await api('get', '/empleados');
    expect(res.status).toBe(200);
    for (const e of res.body) expect(AREAS).toContain(e.area);
    expect(res.body.find((e) => e.id === ASESOR).area).toBe('asesoria');
  });

  it('PATCH cambia el área cuando no hay citas pendientes ni futuras', async () => {
    const barbero = await crear();
    const res = await api('patch', `/empleados/${barbero.id}`).send({ area: 'asesoria' });
    expect(res.status).toBe(200);
    expect(res.body.area).toBe('asesoria');
  });

  it('PATCH con citas pendientes → 409 AREA_CON_CITAS_PENDIENTES y el área no cambia', async () => {
    const barbero = await crear();
    await insertarCita({ fecha: FECHA, hora: '10:00', barbero_id: barbero.id, estado: 'pendiente', servicio_id: SERV_CORTE });

    const res = await api('patch', `/empleados/${barbero.id}`).send({ area: 'asesoria' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ codigo: 'AREA_CON_CITAS_PENDIENTES', campo: 'area', citas_pendientes: 1 });
    expect((await pool.query('SELECT area FROM barberos WHERE id = $1', [barbero.id])).rows[0].area).toBe('barberia');

    // Al cancelar la cita ya no estorba
    await pool.query("UPDATE citas SET estado = 'cancelada' WHERE barbero_id = $1", [barbero.id]);
    expect((await api('patch', `/empleados/${barbero.id}`).send({ area: 'asesoria' })).status).toBe(200);
  });

  it('una cita futura (aunque esté completada) también bloquea; el historial pasado y las canceladas no', async () => {
    const barbero = await crear();
    await insertarCita({ fecha: '2020-01-10', hora: '10:00', barbero_id: barbero.id, estado: 'completada', servicio_id: SERV_CORTE });
    await insertarCita({ fecha: FECHA, hora: '11:00', barbero_id: barbero.id, estado: 'cancelada', servicio_id: SERV_CORTE });
    expect((await api('patch', `/empleados/${barbero.id}`).send({ area: 'asesoria' })).status).toBe(200);

    const otro = await crear({ nombre: 'Prueba Area Otro', usuario: 'prueba_area_otro' });
    await insertarCita({ fecha: '2099-01-10', hora: '10:00', barbero_id: otro.id, estado: 'completada', servicio_id: SERV_CORTE });
    expect((await api('patch', `/empleados/${otro.id}`).send({ area: 'asesoria' })).status).toBe(409);
  });

  it('mandar el mismo área (o editar otros campos) con citas pendientes no estorba', async () => {
    const barbero = await crear();
    await insertarCita({ fecha: FECHA, hora: '10:00', barbero_id: barbero.id, estado: 'pendiente', servicio_id: SERV_CORTE });
    expect((await api('patch', `/empleados/${barbero.id}`).send({ area: 'barberia' })).status).toBe(200);
    expect((await api('patch', `/empleados/${barbero.id}`).send({ cargo: 'Senior' })).status).toBe(200);
  });

  it('PATCH con area inválida → 400', async () => {
    const barbero = await crear();
    const res = await api('patch', `/empleados/${barbero.id}`).send({ area: 'otra' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'DATOS_INVALIDOS', campo: 'area' });
  });
});

const contarBarberos = async () => (await pool.query('SELECT COUNT(*)::int AS n FROM barberos')).rows[0].n;

describe('verificarToken expone el área', () => {
  const entrar = async (usuario, contrasena) =>
    (await request(app).post('/api/auth/login').send({ usuario, contrasena })).body;

  it('login y /api/auth/sesion devuelven el área del barbero ligado (asesoria / barberia) y null para el admin', async () => {
    const hash = await bcrypt.hash('clave-asesora-1', 10);
    await pool.query(`INSERT INTO usuarios (usuario, contrasena, rol, barbero_id) VALUES ('prueba_area_login', $1, 'barbero', $2)`, [hash, ASESOR]);

    const asesora = await entrar('prueba_area_login', 'clave-asesora-1');
    expect(asesora.usuario.area).toBe('asesoria');
    const sesion = await request(app).get('/api/auth/sesion').set(auth(asesora.token));
    expect(sesion.status).toBe(200);
    expect(sesion.body.usuario).toMatchObject({ rol: 'barbero', barbero_id: ASESOR, area: 'asesoria' });

    const normal = await request(app).get('/api/auth/sesion').set(auth(barbero1));
    expect(normal.body.usuario.area).toBe('barberia');

    const adm = await request(app).get('/api/auth/sesion').set(auth(admin));
    expect(adm.body.usuario.area).toBeNull();
  });

  it('el área sale de la base en cada petición: si cambia, la siguiente la refleja', async () => {
    await pool.query('UPDATE barberos SET area = $1 WHERE id = 1', ['asesoria']);
    const res = await request(app).get('/api/auth/sesion').set(auth(barbero1));
    expect(res.body.usuario.area).toBe('asesoria');
  });
});
