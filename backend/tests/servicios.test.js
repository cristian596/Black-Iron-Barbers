import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';

const app = crearApp();

// Datos propios: no dependen del catálogo real. Los servicios 1 y 2 de la base de pruebas
// (sin categoría) se desactivan mientras corre este archivo para que los listados sean exactos
// y se restauran al terminar; los archivos de prueba corren en serie (fileParallelism: false).
const SLUGS_PROPIOS = ['cat-uno', 'cat-dos', 'cat-vacia'];
const FECHA_RESERVA = '2030-09-07';

const nombres = (res) => res.body.map((s) => s.nombre);
const ALFA = 'Alfa corte';
const BETA = 'Beta barba';
const GAMMA = 'Gamma 100% pro';
const DELTA = 'Delta_under';
const EPSILON = 'Epsilon corte';
const THETA = 'Theta gratis';

let ids = {};

const limpiar = async () => {
  await pool.query('DELETE FROM citas WHERE fecha = $1', [FECHA_RESERVA]);
  await pool.query(
    `DELETE FROM servicios WHERE categoria_id IN (SELECT id FROM categorias WHERE slug = ANY($1::varchar[]))`,
    [SLUGS_PROPIOS]
  );
  await pool.query('DELETE FROM categorias WHERE slug = ANY($1::varchar[])', [SLUGS_PROPIOS]);
};

const crearServicio = async (nombre, categoriaId, tipo, precio, duracion, activo = true) => {
  const { rows } = await pool.query(
    `INSERT INTO servicios (nombre, descripcion, categoria_id, tipo, precio, duracion_min, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [nombre, `Descripción de ${nombre}`, categoriaId, tipo, precio, duracion, activo]
  );
  return rows[0].id;
};

beforeAll(async () => {
  await limpiar();
  // globalSetup inserta los servicios 1 y 2 con id fijo sin avanzar la secuencia.
  await pool.query(`SELECT setval('servicios_id_seq', GREATEST((SELECT MAX(id) FROM servicios), 2))`);
  await pool.query('UPDATE servicios SET activo = false WHERE id IN (1, 2)');

  const crearCategoria = async (nombre, slug, orden) => {
    const { rows } = await pool.query('INSERT INTO categorias (nombre, slug, orden) VALUES ($1, $2, $3) RETURNING id', [nombre, slug, orden]);
    return rows[0].id;
  };
  // Se insertan en orden inverso al de "orden" para comprobar que el orden no depende del id.
  const vacia = await crearCategoria('Cat Vacía', 'cat-vacia', 30);
  const dos = await crearCategoria('Cat Dos', 'cat-dos', 20);
  const uno = await crearCategoria('Cat Uno', 'cat-uno', 10);

  ids = {
    uno, dos, vacia,
    alfa: await crearServicio(ALFA, uno, 'original', 10000, 30),
    beta: await crearServicio(BETA, uno, 'elite', 20000, 20),
    gamma: await crearServicio(GAMMA, uno, 'vip', 30000, 60),
    delta: await crearServicio(DELTA, dos, 'original', 15000, 45),
    epsilon: await crearServicio(EPSILON, dos, 'elite', 20000, 10),
    theta: await crearServicio(THETA, dos, 'original', 0, 5),
    inactivo: await crearServicio('Zeta inactivo', uno, 'vip', 5000, 15, false),
    inactivoVacia: await crearServicio('Eta inactivo', vacia, 'original', 5000, 15, false),
  };
});

afterAll(async () => {
  await limpiar();
  await pool.query('UPDATE servicios SET activo = true WHERE id IN (1, 2)');
});

describe('GET /api/servicios', () => {
  it('devuelve solo activos con los campos de siempre más descripcion, tipo y categoria', async () => {
    const res = await request(app).get('/api/servicios');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
    expect(nombres(res)).not.toContain('Zeta inactivo');
    expect(res.body.find((s) => s.nombre === ALFA)).toEqual({
      id: ids.alfa,
      nombre: ALFA,
      descripcion: `Descripción de ${ALFA}`,
      precio: 10000,
      duracion_min: 30,
      tipo: 'original',
      categoria: { id: ids.uno, nombre: 'Cat Uno', slug: 'cat-uno' },
    });
    for (const servicio of res.body) {
      expect(typeof servicio.id).toBe('number');
      expect(typeof servicio.precio).toBe('number');
      expect(typeof servicio.duracion_min).toBe('number');
    }
  });

  it('sin parámetros ordena por categoría (campo orden, no id), luego precio y nombre', async () => {
    const res = await request(app).get('/api/servicios');
    expect(nombres(res)).toEqual([ALFA, BETA, GAMMA, THETA, DELTA, EPSILON]);
  });

  describe('filtros', () => {
    it('categoria', async () => {
      const res = await request(app).get('/api/servicios').query({ categoria: 'cat-uno' });
      expect(nombres(res)).toEqual([ALFA, BETA, GAMMA]);
    });

    it('categoria existente pero sin servicios activos devuelve lista vacía, no error', async () => {
      const res = await request(app).get('/api/servicios').query({ categoria: 'cat-vacia' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('tipo', async () => {
      const elite = await request(app).get('/api/servicios').query({ tipo: 'elite' });
      expect(nombres(elite)).toEqual([BETA, EPSILON]);
      const original = await request(app).get('/api/servicios').query({ tipo: 'original' });
      expect(nombres(original)).toEqual([ALFA, THETA, DELTA]);
      const vip = await request(app).get('/api/servicios').query({ tipo: 'vip' });
      expect(nombres(vip)).toEqual([GAMMA]);
    });

    it('q busca por nombre sin distinguir mayúsculas ni importar el lugar', async () => {
      const res = await request(app).get('/api/servicios').query({ q: 'CORTE' });
      expect(nombres(res)).toEqual([ALFA, EPSILON]);
      const enElMedio = await request(app).get('/api/servicios').query({ q: 'ta gr' });
      expect(nombres(enElMedio)).toEqual([THETA]);
      const sinCoincidencia = await request(app).get('/api/servicios').query({ q: 'gr ta' });
      expect(nombres(sinCoincidencia)).toEqual([]);
    });

    it('q trata % y _ como caracteres literales', async () => {
      const porcentaje = await request(app).get('/api/servicios').query({ q: '%' });
      expect(nombres(porcentaje)).toEqual([GAMMA]); // sin escapar coincidiría con los 6

      const centoPorciento = await request(app).get('/api/servicios').query({ q: '100%' });
      expect(nombres(centoPorciento)).toEqual([GAMMA]);

      const guion = await request(app).get('/api/servicios').query({ q: 'a_u' });
      expect(nombres(guion)).toEqual([DELTA]);

      // "a_c" sin escapar coincidiría con "Alfa corte" (a, espacio, c)
      const comodin = await request(app).get('/api/servicios').query({ q: 'a_c' });
      expect(comodin.status).toBe(200);
      expect(comodin.body).toEqual([]);
    });

    it('q con una barra invertida no rompe la consulta', async () => {
      const res = await request(app).get('/api/servicios').query({ q: '\\' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('q vacío o solo espacios se ignora', async () => {
      const vacio = await request(app).get('/api/servicios').query({ q: '' });
      expect(vacio.body).toHaveLength(6);
      const espacios = await request(app).get('/api/servicios').query({ q: '   ' });
      expect(espacios.body).toHaveLength(6);
    });

    it('q es seguro ante intentos de inyección SQL', async () => {
      const res = await request(app).get('/api/servicios').query({ q: "'; DROP TABLE servicios; --" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM servicios');
      expect(rows[0].n).toBeGreaterThan(0);
    });

    it('combinados: categoria + tipo, categoria + q + orden', async () => {
      const a = await request(app).get('/api/servicios').query({ categoria: 'cat-dos', tipo: 'elite' });
      expect(nombres(a)).toEqual([EPSILON]);

      const b = await request(app).get('/api/servicios').query({ categoria: 'cat-dos', q: 'corte', ordenar: 'precio', direccion: 'desc' });
      expect(nombres(b)).toEqual([EPSILON]);

      const c = await request(app).get('/api/servicios').query({ categoria: 'cat-uno', tipo: 'vip', q: 'gamma' });
      expect(nombres(c)).toEqual([GAMMA]);

      const sinResultados = await request(app).get('/api/servicios').query({ categoria: 'cat-uno', tipo: 'original', q: 'beta' });
      expect(sinResultados.body).toEqual([]);
    });
  });

  describe('orden', () => {
    const pedir = (ordenar, direccion) => request(app).get('/api/servicios').query({ ordenar, ...(direccion ? { direccion } : {}) });

    it('ordenar=precio (asc por defecto, desempata por nombre)', async () => {
      expect(nombres(await pedir('precio'))).toEqual([THETA, ALFA, DELTA, BETA, EPSILON, GAMMA]);
      expect(nombres(await pedir('precio', 'asc'))).toEqual([THETA, ALFA, DELTA, BETA, EPSILON, GAMMA]);
    });

    it('ordenar=precio&direccion=desc', async () => {
      expect(nombres(await pedir('precio', 'desc'))).toEqual([GAMMA, BETA, EPSILON, DELTA, ALFA, THETA]);
    });

    it('ordenar=duracion asc y desc', async () => {
      expect(nombres(await pedir('duracion', 'asc'))).toEqual([THETA, EPSILON, BETA, ALFA, DELTA, GAMMA]);
      expect(nombres(await pedir('duracion', 'desc'))).toEqual([GAMMA, DELTA, ALFA, BETA, EPSILON, THETA]);
    });

    it('ordenar=nombre asc y desc', async () => {
      expect(nombres(await pedir('nombre', 'asc'))).toEqual([ALFA, BETA, DELTA, EPSILON, GAMMA, THETA]);
      expect(nombres(await pedir('nombre', 'desc'))).toEqual([THETA, GAMMA, EPSILON, DELTA, BETA, ALFA]);
    });

    it('un servicio gratuito (precio 0) se lista con precio 0', async () => {
      const res = await request(app).get('/api/servicios').query({ q: 'gratis' });
      expect(res.body).toHaveLength(1);
      expect(res.body[0].precio).toBe(0);
    });
  });

  describe('agrupar=categoria', () => {
    it('agrupa por categoría en su orden, con el orden por defecto dentro de cada grupo', async () => {
      const res = await request(app).get('/api/servicios').query({ agrupar: 'categoria' });
      expect(res.status).toBe(200);
      expect(res.body.map((g) => g.categoria)).toEqual([
        { id: ids.uno, nombre: 'Cat Uno', slug: 'cat-uno', orden: 10 },
        { id: ids.dos, nombre: 'Cat Dos', slug: 'cat-dos', orden: 20 },
      ]);
      expect(res.body[0].servicios.map((s) => s.nombre)).toEqual([ALFA, BETA, GAMMA]);
      expect(res.body[1].servicios.map((s) => s.nombre)).toEqual([THETA, DELTA, EPSILON]);
      expect(res.body[0].servicios[0].categoria).toEqual({ id: ids.uno, nombre: 'Cat Uno', slug: 'cat-uno' });
    });

    it('omite categorías sin servicios activos (cat-vacia no aparece)', async () => {
      const res = await request(app).get('/api/servicios').query({ agrupar: 'categoria' });
      expect(res.body.map((g) => g.categoria.slug)).not.toContain('cat-vacia');
    });

    it('omite categorías que quedan vacías tras filtrar', async () => {
      const res = await request(app).get('/api/servicios').query({ agrupar: 'categoria', tipo: 'vip' });
      expect(res.body.map((g) => g.categoria.slug)).toEqual(['cat-uno']);
      expect(res.body[0].servicios.map((s) => s.nombre)).toEqual([GAMMA]);
    });

    it('respeta ordenar dentro de cada grupo sin mezclar categorías', async () => {
      const res = await request(app).get('/api/servicios').query({ agrupar: 'categoria', ordenar: 'duracion', direccion: 'desc' });
      expect(res.body.map((g) => g.categoria.slug)).toEqual(['cat-uno', 'cat-dos']);
      expect(res.body[0].servicios.map((s) => s.nombre)).toEqual([GAMMA, ALFA, BETA]);
      expect(res.body[1].servicios.map((s) => s.nombre)).toEqual([DELTA, EPSILON, THETA]);
    });

    it('sin resultados devuelve un arreglo vacío', async () => {
      const res = await request(app).get('/api/servicios').query({ agrupar: 'categoria', q: 'nada-coincide' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('parámetros inválidos → 400 con mensaje claro', () => {
    const casos = [
      ['tipo desconocido', { tipo: 'oro' }, /'tipo'.*original, elite, vip/],
      ['tipo con mayúsculas', { tipo: 'VIP' }, /'tipo'/],
      ['ordenar desconocido', { ordenar: 'color' }, /'ordenar'.*precio, duracion, nombre/],
      ['direccion desconocida', { ordenar: 'precio', direccion: 'arriba' }, /'direccion'.*asc o desc/],
      ['direccion sin ordenar', { direccion: 'desc' }, /'direccion'.*'ordenar'/],
      ['agrupar desconocido', { agrupar: 'tipo' }, /'agrupar'.*categoria/],
      ['categoria con formato inválido', { categoria: 'Cat Uno!' }, /'categoria'.*slug/],
      ['categoria inexistente', { categoria: 'no-existe' }, /'no-existe' no existe/],
      ['q demasiado largo', { q: 'a'.repeat(101) }, /'q'.*100/],
    ];

    for (const [nombre, query, mensaje] of casos) {
      it(nombre, async () => {
        const res = await request(app).get('/api/servicios').query(query);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(mensaje);
      });
    }

    it('acepta q de exactamente 100 caracteres', async () => {
      const res = await request(app).get('/api/servicios').query({ q: 'a'.repeat(100) });
      expect(res.status).toBe(200);
    });

    it('parámetros repetidos (?tipo=a&tipo=b) → 400', async () => {
      for (const url of [
        '/api/servicios?tipo=vip&tipo=elite',
        '/api/servicios?q=a&q=b',
        '/api/servicios?categoria=cat-uno&categoria=cat-dos',
        '/api/servicios?ordenar=precio&ordenar=nombre',
        '/api/servicios?agrupar=categoria&agrupar=categoria',
      ]) {
        const res = await request(app).get(url);
        expect(res.status, url).toBe(400);
        expect(res.body.error).toMatch(/una sola vez/);
      }
    });

    it('parámetros desconocidos o con corchetes (?tipo[]=vip, ?categorai=x) → 400, no se ignoran en silencio', async () => {
      for (const url of ['/api/servicios?tipo[]=vip', '/api/servicios?categorai=cat-uno', '/api/servicios?orden=precio']) {
        const res = await request(app).get(url);
        expect(res.status, url).toBe(400);
        expect(res.body.error).toMatch(/Parámetro desconocido/);
      }
    });
  });

  it('los servicios inactivos no aparecen en ningún filtro, ni agrupados', async () => {
    const todos = [
      await request(app).get('/api/servicios'),
      await request(app).get('/api/servicios').query({ categoria: 'cat-uno' }),
      await request(app).get('/api/servicios').query({ tipo: 'vip' }),
      await request(app).get('/api/servicios').query({ q: 'inactivo' }),
    ];
    for (const res of todos) {
      expect(nombres(res)).not.toContain('Zeta inactivo');
    }
    expect(todos[3].body).toEqual([]);
    const agrupado = await request(app).get('/api/servicios').query({ agrupar: 'categoria', q: 'inactivo' });
    expect(agrupado.body).toEqual([]);
  });
});

describe('GET /api/servicios/:id', () => {
  it('devuelve el servicio activo con su categoría', async () => {
    const res = await request(app).get(`/api/servicios/${ids.gamma}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: ids.gamma,
      nombre: GAMMA,
      descripcion: `Descripción de ${GAMMA}`,
      precio: 30000,
      duracion_min: 60,
      tipo: 'vip',
      categoria: { id: ids.uno, nombre: 'Cat Uno', slug: 'cat-uno' },
    });
  });

  it('404 si el servicio está inactivo', async () => {
    const res = await request(app).get(`/api/servicios/${ids.inactivo}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Servicio no encontrado');
  });

  it('404 si no existe, incluso con un id más grande que un entero de Postgres', async () => {
    expect((await request(app).get('/api/servicios/99999999')).status).toBe(404);
    expect((await request(app).get('/api/servicios/99999999999999')).status).toBe(404);
    expect((await request(app).get('/api/servicios/0')).status).toBe(404);
  });

  it('400 si el id no es numérico', async () => {
    for (const id of ['abc', '1.5', '-1', '1e3', '12abc', '%20']) {
      const res = await request(app).get(`/api/servicios/${id}`);
      expect(res.status, id).toBe(400);
      expect(res.body.error).toMatch(/numérico/);
    }
  });
});

describe('GET /api/categorias', () => {
  it('devuelve las categorías en su orden con el total de servicios activos', async () => {
    const res = await request(app).get('/api/categorias');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: ids.uno, nombre: 'Cat Uno', slug: 'cat-uno', orden: 10, total_servicios: 3 },
      { id: ids.dos, nombre: 'Cat Dos', slug: 'cat-dos', orden: 20, total_servicios: 3 },
      { id: ids.vacia, nombre: 'Cat Vacía', slug: 'cat-vacia', orden: 30, total_servicios: 0 },
    ]);
  });

  it('el total coincide con lo que lista /api/servicios por categoría y no cuenta inactivos', async () => {
    const { body: categorias } = await request(app).get('/api/categorias');
    for (const categoria of categorias) {
      const listado = await request(app).get('/api/servicios').query({ categoria: categoria.slug });
      expect(listado.body.length).toBe(categoria.total_servicios);
    }
  });

  it('al desactivar un servicio baja el total; al reactivarlo, sube', async () => {
    await pool.query('UPDATE servicios SET activo = false WHERE id = $1', [ids.alfa]);
    try {
      const { body } = await request(app).get('/api/categorias');
      expect(body.find((c) => c.slug === 'cat-uno').total_servicios).toBe(2);
      const listado = await request(app).get('/api/servicios');
      expect(nombres(listado)).not.toContain(ALFA);
    } finally {
      await pool.query('UPDATE servicios SET activo = true WHERE id = $1', [ids.alfa]);
    }
    const { body } = await request(app).get('/api/categorias');
    expect(body.find((c) => c.slug === 'cat-uno').total_servicios).toBe(3);
  });
});

describe('Servicios inactivos en reservas y disponibilidad', () => {
  const MENSAJE = 'El servicio seleccionado no existe o no está disponible';

  const cita = (servicioId, hora = '10:00') => ({
    cliente: 'Cliente de prueba',
    correo: 'cliente@example.com',
    telefono: '3001234567',
    consentimiento: true,
    servicio_id: servicioId,
    barbero_id: 1,
    fecha: FECHA_RESERVA,
    hora,
  });

  it('POST /api/citas rechaza un servicio inactivo con 400 y no crea la cita', async () => {
    const res = await request(app).post('/api/citas').send(cita(ids.inactivo));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(MENSAJE);
    expect(res.body.codigo).toBe('SERVICIO_NO_DISPONIBLE');
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM citas WHERE fecha = $1', [FECHA_RESERVA]);
    expect(rows[0].n).toBe(0);
  });

  it('POST /api/citas sigue rechazando un servicio inexistente con 400', async () => {
    const res = await request(app).post('/api/citas').send(cita(99999999));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(MENSAJE);
    expect(res.body.codigo).toBe('SERVICIO_NO_DISPONIBLE');
  });

  it('POST /api/citas sigue aceptando un servicio activo', async () => {
    const res = await request(app).post('/api/citas').send(cita(ids.alfa));
    expect(res.status).toBe(201);
    expect(res.body.servicio_id).toBe(ids.alfa);
    expect(res.body.duracion_min).toBe(30);
    expect(res.body.precio).toBe(10000);
  });

  it('una cita ya creada conserva su servicio aunque luego se desactive', async () => {
    const creada = await request(app).post('/api/citas').send(cita(ids.beta, '12:00'));
    expect(creada.status).toBe(201);
    await pool.query('UPDATE servicios SET activo = false WHERE id = $1', [ids.beta]);
    try {
      const { rows } = await pool.query('SELECT servicio_id, duracion_min, precio FROM citas WHERE id = $1', [creada.body.id]);
      expect(rows[0]).toEqual({ servicio_id: ids.beta, duracion_min: 20, precio: 20000 });
    } finally {
      await pool.query('UPDATE servicios SET activo = true WHERE id = $1', [ids.beta]);
    }
  });

  it('GET /api/disponibilidad rechaza un servicio inactivo con 400', async () => {
    const res = await request(app).get('/api/disponibilidad').query({ servicio: ids.inactivo, barbero: 1, fecha: FECHA_RESERVA });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(MENSAJE);
    expect(res.body.codigo).toBe('SERVICIO_NO_DISPONIBLE');
  });

  it('GET /api/disponibilidad mantiene el 404 para un servicio inexistente y responde 200 para uno activo', async () => {
    const inexistente = await request(app).get('/api/disponibilidad').query({ servicio: 99999999, barbero: 1, fecha: FECHA_RESERVA });
    expect(inexistente.status).toBe(404);
    const activo = await request(app).get('/api/disponibilidad').query({ servicio: ids.alfa, barbero: 1, fecha: FECHA_RESERVA });
    expect(activo.status).toBe(200);
    expect(activo.body.horas.length).toBeGreaterThan(0);
  });
});
