import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { firmarToken } from './utilsPrueba.js';

const app = crearApp();

let admin;
let barbero;
const api = (metodo, ruta, token = admin) => request(app)[metodo](`/api/admin${ruta}`).set('Authorization', `Bearer ${token}`);
const get = (ruta, token) => api('get', ruta, token);
const post = (ruta, cuerpo, token) => api('post', ruta, token).send(cuerpo);
const patch = (ruta, cuerpo, token) => api('patch', ruta, token).send(cuerpo);

const idsCategorias = [];

const limpiar = async () => {
  // Por nombre (sin distinguir mayúsculas: algunas pruebas renombran) y por categoría de prueba.
  const categorias = "SELECT id FROM categorias WHERE nombre ILIKE 'Cat Prueba%' OR id = ANY($1::int[])";
  const propios = `SELECT id FROM servicios WHERE nombre ILIKE 'Prueba %' OR categoria_id IN (${categorias})`;
  const ids = [...idsCategorias];
  await pool.query(`DELETE FROM citas WHERE servicio_id IN (${propios})`, [ids]);
  await pool.query(`DELETE FROM servicios WHERE id IN (${propios})`, [ids]);
  await pool.query(`DELETE FROM categorias WHERE id IN (${categorias})`, [ids]);
  idsCategorias.length = 0;
  await pool.query('UPDATE servicios SET precio = 50000, duracion_min = 30, activo = true WHERE id = 1');
  await pool.query('UPDATE servicios SET precio = 100000, duracion_min = 90, activo = true WHERE id = 2');
};

const crearCategoria = async (nombre, extra = {}) => {
  const res = await post('/categorias', { nombre, ...extra });
  if (res.status === 201) idsCategorias.push(res.body.id);
  return res;
};

const servicioValido = (categoriaId, extra = {}) => ({
  nombre: 'Prueba Corte',
  precio: 20000,
  duracion_min: 30,
  tipo: 'original',
  categoria_id: categoriaId,
  descripcion: 'Descripción de prueba',
  ...extra,
});

let categoria; // categoría activa disponible en cada prueba

beforeAll(async () => {
  // globalSetup inserta los servicios 1 y 2 con id fijo sin avanzar la secuencia.
  await pool.query("SELECT setval('servicios_id_seq', GREATEST((SELECT MAX(id) FROM servicios), 2))");
  admin = firmarToken('admin');
  barbero = firmarToken('barbero');
});

beforeEach(async () => {
  await limpiar();
  categoria = (await crearCategoria('Cat Prueba Base')).body;
});

afterEach(limpiar);
afterAll(limpiar);

const RUTAS = [
  ['get', '/servicios'],
  ['post', '/servicios'],
  ['patch', '/servicios/1'],
  ['get', '/categorias'],
  ['post', '/categorias'],
  ['patch', '/categorias/1'],
];

describe('permisos', () => {
  it.each(RUTAS)('%s /api/admin%s: 401 sin token', async (metodo, ruta) => {
    expect((await request(app)[metodo](`/api/admin${ruta}`)).status).toBe(401);
  });

  it.each(RUTAS)('%s /api/admin%s: 403 con rol barbero', async (metodo, ruta) => {
    const res = await api(metodo, ruta, barbero).send({});
    expect(res.status).toBe(403);
  });

  it('el admin accede (200 al listar)', async () => {
    expect((await get('/servicios')).status).toBe(200);
    expect((await get('/categorias')).status).toBe(200);
  });
});

describe('no existe ningún DELETE', () => {
  it.each(['/servicios/1', '/categorias/1', '/servicios', '/categorias'])('DELETE /api/admin%s → 404 y no borra nada', async (ruta) => {
    const antes = (await pool.query('SELECT COUNT(*)::int AS n FROM servicios')).rows[0].n;
    const res = await api('delete', ruta);
    expect(res.status).toBe(404);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM servicios')).rows[0].n).toBe(antes);
  });

  it('tampoco por PUT: solo existen GET, POST y PATCH', async () => {
    expect((await api('put', '/servicios/1').send({ nombre: 'x' })).status).toBe(404);
  });
});

describe('GET /api/admin/servicios', () => {
  beforeEach(async () => {
    await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba Alfa', tipo: 'elite', precio: 30000 }));
    await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba 100% Beta', precio: 10000, activo: false }));
    await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba Gamma_x', precio: 20000 }));
  });

  it('incluye los inactivos, con la categoría (y su estado) y los datos completos', async () => {
    const res = await get(`/servicios?categoria=${categoria.slug}`);

    expect(res.status).toBe(200);
    expect(res.body.map((s) => [s.nombre, s.activo])).toEqual([
      ['Prueba 100% Beta', false],
      ['Prueba Gamma_x', true],
      ['Prueba Alfa', true],
    ]); // por precio ascendente dentro de la categoría
    expect(res.body[2]).toEqual({
      id: expect.any(Number),
      nombre: 'Prueba Alfa',
      descripcion: 'Descripción de prueba',
      precio: 30000,
      duracion_min: 30,
      tipo: 'elite',
      activo: true,
      // fase 7 (campos nuevos): área del servicio, si su precio es fijo y el área de su categoría
      area: 'barberia',
      precio_fijo: false,
      categoria: { id: categoria.id, nombre: 'Cat Prueba Base', slug: categoria.slug, activo: true, area: 'barberia' },
    });
  });

  it('filtra por activo, categoría y búsqueda (con % y _ literales)', async () => {
    const inactivos = await get(`/servicios?categoria=${categoria.slug}&activo=false`);
    expect(inactivos.body.map((s) => s.nombre)).toEqual(['Prueba 100% Beta']);

    const activos = await get(`/servicios?categoria=${categoria.slug}&activo=true`);
    expect(activos.body).toHaveLength(2);

    expect((await get(`/servicios?q=${encodeURIComponent('%')}`)).body.map((s) => s.nombre)).toEqual(['Prueba 100% Beta']);
    expect((await get(`/servicios?q=${encodeURIComponent('gamma_')}`)).body.map((s) => s.nombre)).toEqual(['Prueba Gamma_x']);
    expect((await get('/servicios?q=prueba%20alfa')).body).toHaveLength(1);
  });

  it('el catálogo anterior sin categoría también aparece (con categoria null)', async () => {
    const res = await get('/servicios');
    const viejo = res.body.find((s) => s.id === 1);
    expect(viejo.categoria).toBeNull();
    expect(viejo.tipo).toBeNull();
  });

  it.each([
    ['otro=1', /desconocido/],
    ['activo=si', /activo/],
    ['activo=true&activo=false', /una sola vez/],
    ['categoria=NO%20valida', /slug/],
    ['categoria=no-existe', /no existe/],
    [`q=${'a'.repeat(101)}`, /100 caracteres/],
  ])('?%s → 400', async (consulta, mensaje) => {
    const res = await get(`/servicios?${consulta}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(mensaje);
    expect(res.body.codigo).toBeDefined();
  });
});

describe('POST /api/admin/servicios: validaciones', () => {
  const rechazado = async (cuerpo, campo, codigo = 'DATOS_INVALIDOS', estado = 400) => {
    const res = await post('/servicios', cuerpo);
    expect(res.status, JSON.stringify(res.body)).toBe(estado);
    expect(res.body.codigo).toBe(codigo);
    if (campo) expect(res.body.campo).toBe(campo);
    return res;
  };

  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['151 caracteres', 'P'.repeat(151)],
    ['número', 12],
    ['null', null],
  ])('nombre %s → 400', async (_n, nombre) => {
    await rechazado(servicioValido(categoria.id, { nombre }), 'nombre');
  });

  it.each([
    ['negativo', -1],
    ['decimal', 1.5],
    ['texto', '100'],
    ['null', null],
    ['más que un entero de 32 bits', 2147483648],
  ])('precio %s → 400', async (_n, precio) => {
    await rechazado(servicioValido(categoria.id, { precio }), 'precio');
  });

  it.each([
    ['cero', 0],
    ['601', 601],
    ['decimal', 1.5],
    ['texto', '30'],
    ['negativo', -5],
  ])('duracion_min %s → 400', async (_n, duracion_min) => {
    await rechazado(servicioValido(categoria.id, { duracion_min }), 'duracion_min');
  });

  it.each(['oro', 'VIP', '', null, 3])('tipo %s → 400', async (tipo) => {
    await rechazado(servicioValido(categoria.id, { tipo }), 'tipo');
  });

  it.each([['vacía', ''], ['501 caracteres', 'd'.repeat(501)], ['solo espacios', '  '], ['número', 5]])(
    'descripción %s → 400',
    async (_n, descripcion) => {
      await rechazado(servicioValido(categoria.id, { descripcion }), 'descripcion');
    }
  );

  it('categoria_id con formato inválido → 400; inexistente o inactiva → CATEGORIA_NO_DISPONIBLE', async () => {
    await rechazado(servicioValido('1'), 'categoria_id');
    await rechazado(servicioValido(0), 'categoria_id');
    await rechazado(servicioValido(99999999), 'categoria_id', 'CATEGORIA_NO_DISPONIBLE');

    const inactiva = (await crearCategoria('Cat Prueba Inactiva', { activo: false })).body;
    await rechazado(servicioValido(inactiva.id), 'categoria_id', 'CATEGORIA_NO_DISPONIBLE');
  });

  it('campos obligatorios y desconocidos', async () => {
    for (const campo of ['nombre', 'precio', 'duracion_min', 'tipo', 'categoria_id', 'descripcion']) {
      const cuerpo = servicioValido(categoria.id);
      delete cuerpo[campo];
      await rechazado(cuerpo, campo);
    }
    await rechazado(servicioValido(categoria.id, { rareza: 1 }), 'rareza');
    await rechazado(servicioValido(categoria.id, { id: 5 }), 'id');
    await rechazado(servicioValido(categoria.id, { activo: 'true' }), 'activo');
  });

  it('un cuerpo que no es un objeto (arreglo, vacío) → 400', async () => {
    expect((await api('post', '/servicios').send([1, 2])).status).toBe(400);
    expect((await post('/servicios', {})).status).toBe(400);
  });

  it('el id viene de la base: no se puede imponer', async () => {
    const res = await post('/servicios', servicioValido(categoria.id, { id: 777 }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/admin/servicios: alta', () => {
  it('crea el servicio activo, recorta el nombre y devuelve 201 con su forma completa', async () => {
    const res = await post('/servicios', servicioValido(categoria.id, { nombre: '  Prueba Nuevo  ', descripcion: ' Desc ' }));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      nombre: 'Prueba Nuevo',
      descripcion: 'Desc',
      precio: 20000,
      duracion_min: 30,
      tipo: 'original',
      activo: true,
      // fase 7 (campos nuevos): área del servicio, si su precio es fijo y el área de su categoría
      area: 'barberia',
      precio_fijo: false,
      categoria: { id: categoria.id, nombre: 'Cat Prueba Base', slug: categoria.slug, activo: true, area: 'barberia' },
    });
    const { rows } = await pool.query('SELECT clave_seed FROM servicios WHERE id = $1', [res.body.id]);
    expect(rows[0].clave_seed).toBeNull(); // el seed nunca lo tocará
  });

  it('acepta los límites: precio 0 (gratis), duración 1 y 600, nombre de 150 caracteres, descripción de 500, y activo false', async () => {
    const cero = await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba Gratis', precio: 0, duracion_min: 1 }));
    expect(cero.status).toBe(201);
    expect(cero.body.precio).toBe(0);
    const largo = await post('/servicios', servicioValido(categoria.id, { nombre: `Prueba ${'x'.repeat(143)}`, duracion_min: 600, descripcion: 'd'.repeat(500) }));
    expect(largo.status).toBe(201);
    const apagado = await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba Apagado', activo: false }));
    expect(apagado.body.activo).toBe(false);
  });

  it('el nombre es único sin distinguir mayúsculas: 409 NOMBRE_DUPLICADO', async () => {
    await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba Duplicado' }));

    for (const nombre of ['Prueba Duplicado', 'prueba duplicado', 'PRUEBA DUPLICADO', '  Prueba Duplicado  ']) {
      const res = await post('/servicios', servicioValido(categoria.id, { nombre }));
      expect(res.status, nombre).toBe(409);
      expect(res.body).toMatchObject({ codigo: 'NOMBRE_DUPLICADO', campo: 'nombre' });
    }
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM servicios WHERE lower(nombre) = 'prueba duplicado'");
    expect(rows[0].n).toBe(1);
  });

  it('el servicio nuevo aparece de inmediato en la API pública, y al desactivarlo desaparece', async () => {
    const creado = (await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba Visible' }))).body;

    const publico = await request(app).get('/api/servicios');
    expect(publico.body.map((s) => s.nombre)).toContain('Prueba Visible');
    expect((await request(app).get(`/api/servicios/${creado.id}`)).status).toBe(200);

    await patch(`/servicios/${creado.id}`, { activo: false });
    expect((await request(app).get('/api/servicios')).body.map((s) => s.nombre)).not.toContain('Prueba Visible');
    expect((await request(app).get(`/api/servicios/${creado.id}`)).status).toBe(404);
  });
});

describe('PATCH /api/admin/servicios/:id', () => {
  let servicio;
  beforeEach(async () => {
    servicio = (await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba Editable' }))).body;
  });

  it('edita cada campo (nombre, precio, duración, tipo, categoría, descripción) y devuelve el servicio actualizado', async () => {
    const otra = (await crearCategoria('Cat Prueba Otra')).body;
    const res = await patch(`/servicios/${servicio.id}`, {
      nombre: 'Prueba Editado',
      precio: 0,
      duracion_min: 45,
      tipo: 'vip',
      categoria_id: otra.id,
      descripcion: 'Nueva descripción',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: servicio.id,
      nombre: 'Prueba Editado',
      precio: 0,
      duracion_min: 45,
      tipo: 'vip',
      descripcion: 'Nueva descripción',
      activo: true,
      categoria: { id: otra.id },
    });
  });

  it('un solo campo cambia solo ese campo', async () => {
    const res = await patch(`/servicios/${servicio.id}`, { precio: 12345 });
    expect(res.body).toMatchObject({ precio: 12345, nombre: 'Prueba Editable', duracion_min: 30, tipo: 'original' });
  });

  it('activa y desactiva con activo', async () => {
    expect((await patch(`/servicios/${servicio.id}`, { activo: false })).body.activo).toBe(false);
    expect((await patch(`/servicios/${servicio.id}`, { activo: true })).body.activo).toBe(true);
  });

  it('sin campos → 400; campo desconocido → 400; valores inválidos → 400 con el campo', async () => {
    expect((await patch(`/servicios/${servicio.id}`, {})).body.codigo).toBe('DATOS_INVALIDOS');
    expect((await patch(`/servicios/${servicio.id}`, { slug: 'x' })).status).toBe(400);
    expect((await patch(`/servicios/${servicio.id}`, { precio: -5 })).body).toMatchObject({ codigo: 'DATOS_INVALIDOS', campo: 'precio' });
    expect((await patch(`/servicios/${servicio.id}`, { duracion_min: 601 })).body.campo).toBe('duracion_min');
    expect((await patch(`/servicios/${servicio.id}`, { nombre: '' })).body.campo).toBe('nombre');
    expect((await patch(`/servicios/${servicio.id}`, { categoria_id: 9999999 })).body.codigo).toBe('CATEGORIA_NO_DISPONIBLE');
  });

  it('id inexistente → 404 SERVICIO_NO_ENCONTRADO; id no numérico → 400; id enorme → 404', async () => {
    expect((await patch('/servicios/99999999', { precio: 1 })).body.codigo).toBe('SERVICIO_NO_ENCONTRADO');
    expect((await patch('/servicios/abc', { precio: 1 })).body.codigo).toBe('ID_INVALIDO');
    expect((await patch('/servicios/99999999999999', { precio: 1 })).status).toBe(404);
  });

  it('renombrar a un nombre existente (sin distinguir mayúsculas) → 409 NOMBRE_DUPLICADO; el mismo nombre no es conflicto', async () => {
    await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba Otro' }));

    const choque = await patch(`/servicios/${servicio.id}`, { nombre: 'PRUEBA OTRO' });
    expect(choque.status).toBe(409);
    expect(choque.body.codigo).toBe('NOMBRE_DUPLICADO');

    expect((await patch(`/servicios/${servicio.id}`, { nombre: 'Prueba Editable', precio: 1 })).status).toBe(200);
    expect((await patch(`/servicios/${servicio.id}`, { nombre: 'prueba editable' })).status).toBe(200); // solo cambia mayúsculas de sí mismo
  });

  it('filas existentes que ya se parecen ("Exfoliación Facial" / "Exfoliación facial") se pueden seguir editando sin renombrarlas', async () => {
    const ids = [];
    for (const nombre of ['Prueba Par', 'prueba PAR']) {
      const { rows } = await pool.query(
        "INSERT INTO servicios (nombre, duracion_min, precio, categoria_id, tipo, descripcion) VALUES ($1, 30, 1000, $2, 'original', 'x') RETURNING id",
        [nombre, categoria.id]
      );
      ids.push(rows[0].id);
    }

    expect((await patch(`/servicios/${ids[0]}`, { precio: 2000 })).status).toBe(200);
    expect((await patch(`/servicios/${ids[1]}`, { nombre: 'prueba PAR', activo: false })).status).toBe(200);
    expect((await patch(`/servicios/${ids[1]}`, { nombre: 'Prueba PAR' })).body.codigo).toBe('NOMBRE_DUPLICADO'); // un nombre nuevo sí se valida
  });

  it('no se puede mover a una categoría inactiva ni reactivar un servicio cuya categoría está inactiva', async () => {
    const inactiva = (await crearCategoria('Cat Prueba Inactiva')).body;
    await patch(`/categorias/${inactiva.id}`, { activo: false });

    expect((await patch(`/servicios/${servicio.id}`, { categoria_id: inactiva.id })).body.codigo).toBe('CATEGORIA_NO_DISPONIBLE');

    // Servicio inactivo cuya categoría se desactivó después: reactivarlo se rechaza
    await patch(`/servicios/${servicio.id}`, { activo: false });
    await patch(`/categorias/${categoria.id}`, { activo: false });
    const res = await patch(`/servicios/${servicio.id}`, { activo: true });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('CATEGORIA_NO_DISPONIBLE');
    // ...pero sí se puede reactivar cambiándole la categoría a una activa en la misma petición
    const otra = (await crearCategoria('Cat Prueba Activa')).body;
    expect((await patch(`/servicios/${servicio.id}`, { activo: true, categoria_id: otra.id })).status).toBe(200);
  });

  it('un servicio del catálogo anterior (sin categoría, tipo ni descripción) no se activa hasta completarlos: SERVICIO_INCOMPLETO', async () => {
    await pool.query('UPDATE servicios SET activo = false WHERE id = 1');

    const incompleto = await patch('/servicios/1', { activo: true });
    expect(incompleto.status).toBe(400);
    expect(incompleto.body.codigo).toBe('SERVICIO_INCOMPLETO');

    const completo = await patch('/servicios/1', {
      activo: true,
      categoria_id: categoria.id,
      tipo: 'elite',
      descripcion: 'Completado por el admin',
    });
    expect(completo.status).toBe(200);
    expect(completo.body).toMatchObject({ id: 1, activo: true, tipo: 'elite' });
    await pool.query('UPDATE servicios SET categoria_id = NULL, tipo = NULL, descripcion = NULL WHERE id = 1');
  });

  it('editar un servicio inactivo (aunque sea del catálogo anterior) funciona sin exigir lo demás', async () => {
    await pool.query('UPDATE servicios SET activo = false WHERE id = 2');
    expect((await patch('/servicios/2', { precio: 111000 })).status).toBe(200);
  });
});

describe('editar precio o duración no altera las citas existentes (snapshot)', () => {
  it('la cita conserva el precio y la duración con que se reservó; las nuevas usan los actuales', async () => {
    const servicio = (await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba Snapshot', precio: 30000, duracion_min: 30 }))).body;
    const { rows } = await pool.query(
      `INSERT INTO citas (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado)
       VALUES ('Cliente snapshot', 'c@example.com', '3001234567', $1, 1, '2031-03-10', '10:00', 30, 30000, 'pendiente') RETURNING id`,
      [servicio.id]
    );

    const res = await patch(`/servicios/${servicio.id}`, { precio: 99999, duracion_min: 45 });
    expect(res.status).toBe(200);

    const { rows: cita } = await pool.query('SELECT precio, duracion_min FROM citas WHERE id = $1', [rows[0].id]);
    expect(cita[0]).toEqual({ precio: 30000, duracion_min: 30 });

    // y el listado del admin sigue mostrando el precio de la cita original
    const lista = await get('/citas?q=snapshot&desde=2031-03-10&hasta=2031-03-10');
    expect(lista.body.items[0]).toMatchObject({ precio: 30000, duracion_min: 30 });

    // una reserva nueva guarda el precio y la duración actuales
    const nueva = await request(app).post('/api/citas').send({
      cliente: 'Cliente nuevo', correo: 'n@example.com', telefono: '3001234567', consentimiento: true,
      servicio_id: servicio.id, barbero_id: 2, fecha: '2031-03-11', hora: '10:00',
    });
    expect(nueva.status).toBe(201);
    expect(nueva.body).toMatchObject({ precio: 99999, duracion_min: 45 });
    await pool.query("DELETE FROM citas WHERE fecha IN ('2031-03-10', '2031-03-11')");
  });

  it('un servicio desactivado no se puede reservar (SERVICIO_NO_DISPONIBLE) pero sus citas anteriores siguen ahí', async () => {
    const servicio = (await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba Apagar' }))).body;
    await pool.query(
      `INSERT INTO citas (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio)
       VALUES ('Cliente previo', 'c@example.com', '3001234567', $1, 1, '2031-04-10', '10:00', 30, 20000)`,
      [servicio.id]
    );
    await patch(`/servicios/${servicio.id}`, { activo: false });

    const reserva = await request(app).post('/api/citas').send({
      cliente: 'Otro', correo: 'o@example.com', telefono: '3001234567', consentimiento: true,
      servicio_id: servicio.id, barbero_id: 2, fecha: '2031-04-11', hora: '10:00',
    });
    expect(reserva.status).toBe(400);
    expect(reserva.body.codigo).toBe('SERVICIO_NO_DISPONIBLE');
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM citas WHERE fecha = '2031-04-10'");
    expect(rows[0].n).toBe(1);
    await pool.query("DELETE FROM citas WHERE fecha = '2031-04-10'");
  });
});

describe('GET /api/admin/categorias', () => {
  it('lista todas (activas e inactivas) en orden, con el total de servicios activos e inactivos', async () => {
    const inactiva = (await crearCategoria('Cat Prueba Apagada', { orden: 9000, activo: false })).body;
    await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba Uno' }));
    await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba Dos', activo: false }));

    const res = await get('/categorias');

    const base = res.body.find((c) => c.id === categoria.id);
    expect(base).toEqual({
      id: categoria.id, nombre: 'Cat Prueba Base', slug: categoria.slug, orden: categoria.orden, activo: true, area: 'barberia', // fase 7: área de la categoría
      total_servicios: 1, total_inactivos: 1,
    });
    expect(res.body.find((c) => c.id === inactiva.id)).toMatchObject({ activo: false, total_servicios: 0 });
    const ordenes = res.body.map((c) => c.orden);
    expect([...ordenes].sort((a, b) => a - b)).toEqual(ordenes);
  });

  it('parámetros desconocidos → 400', async () => {
    expect((await get('/categorias?x=1')).status).toBe(400);
  });
});

describe('POST /api/admin/categorias', () => {
  it('genera el slug del nombre (sin tildes ni símbolos), con orden siguiente y activa por defecto', async () => {
    const maximo = (await pool.query('SELECT COALESCE(MAX(orden), 0)::int AS m FROM categorias')).rows[0].m;
    const res = await crearCategoria('Cat Prueba Ñandú & Cía!');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: 'Cat Prueba Ñandú & Cía!', slug: 'cat-prueba-nandu-cia', orden: maximo + 1, activo: true, total_servicios: 0 });
    // el slug sirve para el filtro de la API pública
    expect(res.body.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('si el slug ya existe agrega un sufijo (-2, -3…)', async () => {
    await pool.query("INSERT INTO categorias (nombre, slug, orden) VALUES ('Cat Prueba Slug Ocupado', 'cat-prueba-nueva', 1)");
    const primera = await crearCategoria('Cat Prueba Nueva');
    const segunda = await crearCategoria('Cat Prueba  Nueva!!'); // distinto nombre, mismo slug base

    expect(primera.body.slug).toBe('cat-prueba-nueva-2');
    expect(segunda.body.slug).toBe('cat-prueba-nueva-3');
  });

  it('un nombre sin letras ni números usa el slug base "categoria"', async () => {
    const res = await crearCategoria('¿¿¿???');
    expect(res.status).toBe(201);
    expect(res.body.slug).toMatch(/^categoria(-\d+)?$/);
  });

  it('acepta orden y activo; valida nombre, orden y activo; el slug no se puede indicar', async () => {
    const ok = await crearCategoria('Cat Prueba Orden', { orden: 42, activo: false });
    expect(ok.body).toMatchObject({ orden: 42, activo: false });

    for (const [cuerpo, campo] of [
      [{ nombre: '' }, 'nombre'], [{ nombre: 'x'.repeat(101) }, 'nombre'], [{ nombre: 5 }, 'nombre'], [{}, 'nombre'],
      [{ nombre: 'Cat Prueba V', orden: -1 }, 'orden'], [{ nombre: 'Cat Prueba V', orden: 1.5 }, 'orden'],
      [{ nombre: 'Cat Prueba V', orden: '3' }, 'orden'], [{ nombre: 'Cat Prueba V', activo: 'no' }, 'activo'],
      [{ nombre: 'Cat Prueba V', color: 'rojo' }, 'color'],
    ]) {
      const res = await post('/categorias', cuerpo);
      expect(res.status, JSON.stringify(cuerpo)).toBe(400);
      expect(res.body).toMatchObject({ codigo: 'DATOS_INVALIDOS', campo });
    }
    const conSlug = await post('/categorias', { nombre: 'Cat Prueba Slug', slug: 'mio' });
    expect(conSlug.status).toBe(400);
    expect(conSlug.body.codigo).toBe('SLUG_NO_EDITABLE');
  });

  it('el nombre es único sin distinguir mayúsculas: 409 NOMBRE_DUPLICADO', async () => {
    const res = await post('/categorias', { nombre: 'cat prueba BASE' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ codigo: 'NOMBRE_DUPLICADO', campo: 'nombre' });
  });
});

describe('PATCH /api/admin/categorias/:id', () => {
  it('renombra y cambia el orden sin tocar el slug', async () => {
    const res = await patch(`/categorias/${categoria.id}`, { nombre: 'Cat Prueba Renombrada', orden: 77 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: categoria.id, nombre: 'Cat Prueba Renombrada', orden: 77, slug: categoria.slug });
  });

  it('el slug no es editable: 400 SLUG_NO_EDITABLE', async () => {
    const res = await patch(`/categorias/${categoria.id}`, { slug: 'otro' });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('SLUG_NO_EDITABLE');
    expect((await pool.query('SELECT slug FROM categorias WHERE id = $1', [categoria.id])).rows[0].slug).toBe(categoria.slug);
  });

  it('desactivar una categoría con servicios activos → 409 CATEGORIA_CON_SERVICIOS; sin ellos funciona', async () => {
    const servicio = (await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba En Categoria' }))).body;

    const bloqueada = await patch(`/categorias/${categoria.id}`, { activo: false });
    expect(bloqueada.status).toBe(409);
    expect(bloqueada.body).toMatchObject({ codigo: 'CATEGORIA_CON_SERVICIOS', total_servicios: 1 });
    expect((await pool.query('SELECT activo FROM categorias WHERE id = $1', [categoria.id])).rows[0].activo).toBe(true);

    await patch(`/servicios/${servicio.id}`, { activo: false });
    const ok = await patch(`/categorias/${categoria.id}`, { activo: false });
    expect(ok.status).toBe(200);
    expect(ok.body.activo).toBe(false);
    expect((await patch(`/categorias/${categoria.id}`, { activo: true })).body.activo).toBe(true);
  });

  it('una categoría inactiva no aparece en la API pública; la activa sí', async () => {
    await post('/servicios', servicioValido(categoria.id, { nombre: 'Prueba Publica' }));
    const visible = await request(app).get('/api/categorias');
    expect(visible.body.map((c) => c.slug)).toContain(categoria.slug);

    const otra = (await crearCategoria('Cat Prueba Oculta', { activo: false })).body;
    expect((await request(app).get('/api/categorias')).body.map((c) => c.slug)).not.toContain(otra.slug);
    // y sus servicios, si por algún motivo quedaran activos, tampoco se muestran
    await pool.query(
      "INSERT INTO servicios (nombre, duracion_min, precio, categoria_id, tipo, descripcion) VALUES ('Prueba En Oculta', 20, 1000, $1, 'original', 'x')",
      [otra.id]
    );
    expect((await request(app).get('/api/servicios')).body.map((s) => s.nombre)).not.toContain('Prueba En Oculta');
    expect((await request(app).get('/api/servicios?agrupar=categoria')).body.map((g) => g.categoria?.slug)).not.toContain(otra.slug);
  });

  it('errores: sin campos 400, desconocido 400, valores inválidos 400, no existe 404, id inválido 400, nombre duplicado 409', async () => {
    expect((await patch(`/categorias/${categoria.id}`, {})).body.codigo).toBe('DATOS_INVALIDOS');
    expect((await patch(`/categorias/${categoria.id}`, { color: 1 })).status).toBe(400);
    expect((await patch(`/categorias/${categoria.id}`, { orden: -3 })).body.campo).toBe('orden');
    expect((await patch(`/categorias/${categoria.id}`, { activo: 1 })).body.campo).toBe('activo');
    expect((await patch('/categorias/99999999', { nombre: 'x' })).body.codigo).toBe('CATEGORIA_NO_ENCONTRADA');
    expect((await patch('/categorias/abc', { nombre: 'x' })).body.codigo).toBe('ID_INVALIDO');

    const otra = (await crearCategoria('Cat Prueba Otra Mas')).body;
    const choque = await patch(`/categorias/${otra.id}`, { nombre: 'CAT PRUEBA BASE' });
    expect(choque.status).toBe(409);
    expect(choque.body.codigo).toBe('NOMBRE_DUPLICADO');
    expect((await patch(`/categorias/${otra.id}`, { nombre: 'cat prueba otra mas' })).status).toBe(200); // su propio nombre
  });
});
