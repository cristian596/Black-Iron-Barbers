import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { firmarToken, insertarCita } from './utilsPrueba.js';

// Fase 7: el admin crea y edita servicios de las dos áreas. La categoría debe ser del mismo área, el área no cambia si el
// servicio ya tiene citas, y la asesoría gratis sembrada conserva el precio 0. Crea sus propios datos ("F7 Prueba …").

const app = crearApp();
let admin;
const api = (metodo, ruta) => request(app)[metodo](`/api/admin${ruta}`).set('Authorization', `Bearer ${admin}`);

let catBarberia;
let catAsesoria;

const limpiar = async () => {
  await pool.query("DELETE FROM citas WHERE servicio_id IN (SELECT id FROM servicios WHERE nombre LIKE 'F7 Prueba %')");
  await pool.query("DELETE FROM servicios WHERE nombre LIKE 'F7 Prueba %'");
  await pool.query("DELETE FROM categorias WHERE nombre LIKE 'Cat F7 %'");
};

const valido = (categoriaId, extra = {}) => ({
  nombre: 'F7 Prueba Servicio',
  precio: 30000,
  duracion_min: 40,
  tipo: 'original',
  categoria_id: categoriaId,
  descripcion: 'Descripción de prueba',
  ...extra,
});

beforeAll(async () => {
  await pool.query("SELECT setval('servicios_id_seq', GREATEST((SELECT MAX(id) FROM servicios), 2))");
  admin = firmarToken('admin');
  await limpiar();
  const b = await pool.query("INSERT INTO categorias (nombre, slug, orden, area) VALUES ('Cat F7 Barberia', 'cat-f7-barberia', 900, 'barberia') RETURNING id");
  const a = await pool.query("INSERT INTO categorias (nombre, slug, orden, area) VALUES ('Cat F7 Asesoria', 'cat-f7-asesoria', 901, 'asesoria') RETURNING id");
  catBarberia = b.rows[0].id;
  catAsesoria = a.rows[0].id;
});

beforeEach(async () => {
  await pool.query("DELETE FROM citas WHERE servicio_id IN (SELECT id FROM servicios WHERE nombre LIKE 'F7 Prueba %')");
  await pool.query("DELETE FROM servicios WHERE nombre LIKE 'F7 Prueba %'");
});
afterAll(limpiar);

describe('POST /api/admin/servicios: area', () => {
  it('por defecto es barbería; la respuesta trae area y el área de su categoría', async () => {
    const res = await api('post', '/servicios').send(valido(catBarberia));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ area: 'barberia', precio_fijo: false });
    expect(res.body.categoria).toMatchObject({ id: catBarberia, area: 'barberia' });
  });

  it('crea una asesoría con una categoría de asesoría', async () => {
    const res = await api('post', '/servicios').send(valido(catAsesoria, { area: 'asesoria' }));
    expect(res.status).toBe(201);
    expect(res.body.area).toBe('asesoria');
    const publico = await request(app).get('/api/servicios?area=asesoria');
    expect(publico.body.some((s) => s.nombre === 'F7 Prueba Servicio')).toBe(true);
    const cortes = await request(app).get('/api/servicios?area=barberia');
    expect(cortes.body.some((s) => s.nombre === 'F7 Prueba Servicio')).toBe(false);
  });

  it.each(['otra', '', 'BARBERIA', null, 5])('un área inválida (%j) → 400 DATOS_INVALIDOS con campo', async (area) => {
    const res = await api('post', '/servicios').send(valido(catBarberia, { area }));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'DATOS_INVALIDOS', campo: 'area' });
  });

  it('una categoría de OTRA área → 400 CATEGORIA_AREA_INCOMPATIBLE (en los dos sentidos) y no se crea nada', async () => {
    const a = await api('post', '/servicios').send(valido(catAsesoria)); // barbería por defecto + categoría de asesoría
    expect(a.status).toBe(400);
    expect(a.body).toMatchObject({ codigo: 'CATEGORIA_AREA_INCOMPATIBLE', campo: 'categoria_id' });
    const b = await api('post', '/servicios').send(valido(catBarberia, { area: 'asesoria' }));
    expect(b.status).toBe(400);
    expect(b.body.codigo).toBe('CATEGORIA_AREA_INCOMPATIBLE');
    const { rows } = await pool.query("SELECT 1 FROM servicios WHERE nombre LIKE 'F7 Prueba %'");
    expect(rows).toHaveLength(0);
  });
});

describe('PATCH /api/admin/servicios/:id: area', () => {
  const crear = async (categoria, extra) => (await api('post', '/servicios').send(valido(categoria, extra))).body.id;

  it('sin historial se puede cambiar el área si se manda también una categoría del nuevo área', async () => {
    const id = await crear(catBarberia);
    const res = await api('patch', `/servicios/${id}`).send({ area: 'asesoria', categoria_id: catAsesoria });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ area: 'asesoria' });
    expect(res.body.categoria.id).toBe(catAsesoria);
  });

  it('cambiar el área sin cambiar la categoría (que es del área anterior) → 400 CATEGORIA_AREA_INCOMPATIBLE y no cambia nada', async () => {
    const id = await crear(catBarberia);
    const res = await api('patch', `/servicios/${id}`).send({ area: 'asesoria' });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('CATEGORIA_AREA_INCOMPATIBLE');
    const { rows } = await pool.query('SELECT area FROM servicios WHERE id = $1', [id]);
    expect(rows[0].area).toBe('barberia');
  });

  it('mover un servicio a una categoría de otra área (sin cambiar su área) → 400 CATEGORIA_AREA_INCOMPATIBLE', async () => {
    const id = await crear(catBarberia);
    const res = await api('patch', `/servicios/${id}`).send({ categoria_id: catAsesoria });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('CATEGORIA_AREA_INCOMPATIBLE');
  });

  it('con historial (líneas en cita_servicios) el área NO cambia → 409 SERVICIO_CON_HISTORIAL', async () => {
    const id = await crear(catBarberia);
    await insertarCita({ fecha: '2030-01-10', servicio_id: id, estado: 'pendiente' });
    const res = await api('patch', `/servicios/${id}`).send({ area: 'asesoria', categoria_id: catAsesoria });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ codigo: 'SERVICIO_CON_HISTORIAL', campo: 'area' });
    const { rows } = await pool.query('SELECT area, categoria_id FROM servicios WHERE id = $1', [id]);
    expect(rows[0]).toEqual({ area: 'barberia', categoria_id: catBarberia });
  });

  it('con historial, mandar la MISMA área y editar otros campos sigue funcionando', async () => {
    const id = await crear(catBarberia);
    await insertarCita({ fecha: '2030-01-10', servicio_id: id, estado: 'pendiente' });
    const res = await api('patch', `/servicios/${id}`).send({ area: 'barberia', precio: 35000 });
    expect(res.status).toBe(200);
    expect(res.body.precio).toBe(35000);
  });

  it('un área inválida → 400', async () => {
    const id = await crear(catBarberia);
    const res = await api('patch', `/servicios/${id}`).send({ area: 'otra' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'DATOS_INVALIDOS', campo: 'area' });
  });
});

describe('GET /api/admin/servicios y /categorias: area', () => {
  it('la lista trae area y se filtra con ?area= (inválido o repetido → 400)', async () => {
    await api('post', '/servicios').send(valido(catBarberia, { nombre: 'F7 Prueba Corte' }));
    await api('post', '/servicios').send(valido(catAsesoria, { nombre: 'F7 Prueba Asesoría', area: 'asesoria' }));
    const nombres = async (consulta) => (await api('get', `/servicios${consulta}`)).body.filter((s) => s.nombre.startsWith('F7 Prueba')).map((s) => s.nombre);
    expect(await nombres('?area=asesoria')).toEqual(['F7 Prueba Asesoría']);
    expect(await nombres('?area=barberia')).toEqual(['F7 Prueba Corte']);
    expect((await nombres('')).sort()).toEqual(['F7 Prueba Asesoría', 'F7 Prueba Corte']);
    for (const q of ['?area=otra', '?area=', '?area=barberia&area=asesoria']) {
      expect((await api('get', `/servicios${q}`)).status, q).toBe(400);
    }
  });

  it('las categorías del admin traen su área', async () => {
    const lista = (await api('get', '/categorias')).body;
    expect(lista.find((c) => c.id === catAsesoria).area).toBe('asesoria');
    expect(lista.find((c) => c.id === catBarberia).area).toBe('barberia');
  });
});

describe('asesoría gratis sembrada: el precio es fijo', () => {
  let id;
  beforeEach(async () => {
    await pool.query("UPDATE servicios SET clave_seed = NULL WHERE clave_seed = 'asesoria-gratis'"); // por si la base de pruebas ya la tuviera
    const { rows } = await pool.query(
      `INSERT INTO servicios (nombre, descripcion, precio, duracion_min, tipo, categoria_id, activo, area, clave_seed)
       VALUES ('F7 Prueba Gratis', 'x', 0, 15, 'original', $1, true, 'asesoria', 'asesoria-gratis') RETURNING id`,
      [catAsesoria]
    );
    id = rows[0].id;
  });
  afterAll(async () => {
    await pool.query("UPDATE servicios SET clave_seed = NULL WHERE nombre = 'F7 Prueba Gratis'");
  });

  it('cambiarle el precio → 409 PRECIO_FIJO y sigue en 0; la respuesta lo marca como precio_fijo', async () => {
    const res = await api('patch', `/servicios/${id}`).send({ precio: 5000 });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ codigo: 'PRECIO_FIJO', campo: 'precio' });
    const { rows } = await pool.query('SELECT precio FROM servicios WHERE id = $1', [id]);
    expect(rows[0].precio).toBe(0);
    const lista = (await api('get', '/servicios?area=asesoria')).body.find((s) => s.id === id);
    expect(lista.precio_fijo).toBe(true);
  });

  it('con el mismo precio (0) y otros campos, o desactivándola, sí se permite', async () => {
    expect((await api('patch', `/servicios/${id}`).send({ precio: 0, descripcion: 'Nueva descripción' })).status).toBe(200);
    const apagada = await api('patch', `/servicios/${id}`).send({ activo: false });
    expect(apagada.status).toBe(200);
    expect(apagada.body.activo).toBe(false);
  });

  it('otra asesoría (sin esa clave) sí puede cambiar de precio', async () => {
    const { body } = await api('post', '/servicios').send(valido(catAsesoria, { area: 'asesoria', nombre: 'F7 Prueba Otra' }));
    const res = await api('patch', `/servicios/${body.id}`).send({ precio: 0 });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/admin/empleados: cortes_mes cuenta según el área del empleado', () => {
  const ASESOR = 9701;
  afterAll(async () => {
    await pool.query('DELETE FROM citas WHERE barbero_id = $1', [ASESOR]);
    await pool.query('DELETE FROM barberos WHERE id = $1', [ASESOR]);
  });

  it('un asesor cuenta sus asesorías del mes; un corte anterior a su cambio de área no entra', async () => {
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
    await pool.query('DELETE FROM citas WHERE barbero_id = $1', [ASESOR]);
    await pool.query('DELETE FROM barberos WHERE id = $1', [ASESOR]);
    await pool.query("INSERT INTO barberos (id, nombre, cargo, area) VALUES ($1, 'F7 Prueba Asesor', 'Asesor', 'asesoria')", [ASESOR]);
    const { body } = await api('post', '/servicios').send(valido(catAsesoria, { area: 'asesoria', nombre: 'F7 Prueba Asesoria Mes' }));
    await insertarCita({ fecha: hoy, hora: '07:00', barbero_id: ASESOR, servicio_id: body.id, estado: 'completada' });
    await pool.query('ALTER TABLE cita_servicios DISABLE TRIGGER cita_servicios_area_profesional');
    try {
      await insertarCita({ fecha: hoy, hora: '08:00', barbero_id: ASESOR, servicio_id: 1, estado: 'completada' }); // corte de antes
    } finally {
      await pool.query('ALTER TABLE cita_servicios ENABLE TRIGGER cita_servicios_area_profesional');
    }
    const lista = (await api('get', '/empleados')).body;
    expect(lista.find((e) => e.id === ASESOR)).toMatchObject({ area: 'asesoria', cortes_mes: 1 });
  });
});

describe('servicios del catálogo sembrado (con clave_seed): el área no cambia', () => {
  let id;
  beforeEach(async () => {
    await pool.query("DELETE FROM servicios WHERE clave_seed = 'f7-area-fija'");
    const { rows } = await pool.query(
      `INSERT INTO servicios (nombre, descripcion, precio, duracion_min, tipo, categoria_id, activo, area, clave_seed)
       VALUES ('F7 Prueba Sembrado', 'x', 10000, 30, 'original', $1, true, 'asesoria', 'f7-area-fija') RETURNING id`,
      [catAsesoria]
    );
    id = rows[0].id;
  });
  afterAll(async () => {
    await pool.query("DELETE FROM servicios WHERE clave_seed = 'f7-area-fija'");
  });

  it('cambiar el área (aunque no tenga historial) → 409 AREA_FIJA y no cambia nada', async () => {
    const res = await api('patch', `/servicios/${id}`).send({ area: 'barberia', categoria_id: catBarberia });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ codigo: 'AREA_FIJA', campo: 'area' });
    const { rows } = await pool.query('SELECT area, categoria_id FROM servicios WHERE id = $1', [id]);
    expect(rows[0]).toEqual({ area: 'asesoria', categoria_id: catAsesoria });
  });

  it('mandar el mismo área no es un cambio: se permite y se editan los demás campos; la respuesta marca area_fija', async () => {
    const res = await api('patch', `/servicios/${id}`).send({ area: 'asesoria', precio: 12000 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ precio: 12000, area: 'asesoria', area_fija: true });
  });

  it('un servicio creado por el admin (sin clave_seed) sigue pudiendo cambiar de área sin historial', async () => {
    const creado = (await api('post', '/servicios').send(valido(catBarberia, { nombre: 'F7 Prueba Libre' }))).body;
    expect(creado.area_fija).toBe(false);
    const res = await api('patch', `/servicios/${creado.id}`).send({ area: 'asesoria', categoria_id: catAsesoria });
    expect(res.status).toBe(200);
    expect(res.body.area).toBe('asesoria');
  });
});
