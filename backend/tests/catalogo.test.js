import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import catalogoReal from '../db/data/servicios.js';
import descripcionesReales from '../db/data/descripciones.js';
import { sembrarCatalogo, validarCatalogo, NOMBRES_SERVICIOS_LEGADOS } from '../db/sembrarCatalogo.js';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf-8');

const NOMBRE_BD = 'black_iron_catalogo_test';
const credenciales = () => ({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
});

const LEGADOS = [
  ['Corte de Cabello', 35, 55000],
  ['Corte de Barba', 45, 48000],
  ['Combo (Pelo + Barba)', 90, 103000],
  ['Perfilado de Cejas', 15, 25000],
  ['Exfoliación Facial', 45, 42000],
  ['Tintura / Color', 30, 58000],
];

let bd;

// Deja la base como estaba en desarrollo antes del rediseño: catálogo viejo con ids 1-6,
// tres citas apuntando a los servicios 1-3 y la secuencia avanzada por seeds repetidos.
const prepararEscenarioLegado = async () => {
  await bd.query('TRUNCATE citas, servicios, categorias, barberos RESTART IDENTITY CASCADE');
  await bd.query(`INSERT INTO barberos (id, nombre, activo) VALUES (1, 'Barbero Prueba', true)`);
  for (const [nombre, duracion, precio] of LEGADOS) {
    await bd.query('INSERT INTO servicios (nombre, duracion_min, precio) VALUES ($1, $2, $3)', [nombre, duracion, precio]);
  }
  await bd.query(`SELECT setval('servicios_id_seq', 33)`);
  await bd.query(
    `INSERT INTO citas (cliente, correo, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado) VALUES
      ('Cliente 1', 'c1@c.com', 1, 1, '2030-01-10', '10:00', 35, 55000, 'completada'),
      ('Cliente 2', 'c2@c.com', 2, 1, '2030-01-11', '10:00', 45, 48000, 'pendiente'),
      ('Cliente 3', 'c3@c.com', 3, 1, '2030-01-12', '10:00', 90, 103000, 'pendiente')`
  );
};

const estadoDeLasCitas = async () => {
  const { rows } = await bd.query(
    'SELECT id, servicio_id, duracion_min, precio, estado, fecha::text, hora::text FROM citas ORDER BY id'
  );
  return rows;
};

beforeAll(async () => {
  const admin = new Pool({ ...credenciales(), database: 'postgres' });
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${NOMBRE_BD}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${NOMBRE_BD}"`);
  } finally {
    await admin.end();
  }
  bd = new Pool({ ...credenciales(), database: NOMBRE_BD });
  await bd.query(schema);
});

afterAll(async () => {
  await bd.end();
  const admin = new Pool({ ...credenciales(), database: 'postgres' });
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${NOMBRE_BD}" WITH (FORCE)`);
  } finally {
    await admin.end();
  }
});

describe('Datos del catálogo (backend/db/data)', () => {
  it('son coherentes: 39 servicios, 39 descripciones, sin repetidos ni huérfanos', () => {
    expect(validarCatalogo(catalogoReal, descripcionesReales)).toEqual([]);
    expect(catalogoReal.flatMap((c) => c.servicios)).toHaveLength(39);
    expect(descripcionesReales).toHaveLength(39);
  });

  it('validarCatalogo detecta ids repetidos, descripciones faltantes, tipos y slugs inválidos', () => {
    const roto = [
      { categoria: 'A', slug: 'a', servicios: [{ id: 1, nombre: 'X', tipo: 'oro', precio: 10, duracion: 5 }, { id: 1, nombre: 'Y', tipo: 'vip', precio: 10, duracion: 5 }] },
      { categoria: 'B', slug: 'a', servicios: [{ id: 2, nombre: 'Z', tipo: 'vip', precio: -1, duracion: 0 }] },
    ];
    const problemas = validarCatalogo(roto, [{ id: 1, descripcion: 'x' }, { id: 9, descripcion: 'y' }]).join(' | ');
    expect(problemas).toMatch(/ids de servicio repetidos: 1/);
    expect(problemas).toMatch(/servicios sin descripción: 2/);
    expect(problemas).toMatch(/descripciones sin servicio: 9/);
    expect(problemas).toMatch(/tipo inválido en servicios: 1/);
    expect(problemas).toMatch(/slugs repetidos: a/);
    expect(problemas).toMatch(/precio o duración inválidos en servicios: 2/);
  });

  it('sembrarCatalogo rechaza datos incoherentes antes de tocar la base', async () => {
    const roto = [{ categoria: 'A', slug: 'a', servicios: [{ id: 1, nombre: 'X', tipo: 'oro', precio: 10, duracion: 5 }] }];
    await expect(sembrarCatalogo(bd, { catalogo: roto, listaDescripciones: [] })).rejects.toThrow(/Datos de catálogo inválidos/);
  });
});

describe('Restricciones del esquema', () => {
  beforeAll(async () => {
    await bd.query('TRUNCATE citas, servicios, categorias RESTART IDENTITY CASCADE');
  });

  const insertar = (nombre, duracion, precio, tipo = 'original') =>
    bd.query('INSERT INTO servicios (nombre, duracion_min, precio, tipo) VALUES ($1, $2, $3, $4)', [nombre, duracion, precio, tipo]);

  it('rechaza tipo inválido, precio negativo, duración 0 y nombre repetido', async () => {
    await expect(insertar('T1', 10, 100, 'oro')).rejects.toThrow(/servicios_tipo_check/);
    await expect(insertar('T2', 10, -1)).rejects.toThrow(/servicios_precio_check/);
    await expect(insertar('T3', 0, 100)).rejects.toThrow(/servicios_duracion_min_check/);
    await insertar('T4', 10, 100);
    await expect(insertar('T4', 10, 100)).rejects.toThrow(/servicios_nombre_key/);
  });

  it('permite precio 0 (servicios gratuitos) y trata los nombres distinguiendo mayúsculas', async () => {
    await expect(insertar('Gratis', 15, 0)).resolves.toBeDefined();
    await expect(insertar('Exfoliación Facial', 45, 42000)).resolves.toBeDefined();
    await expect(insertar('Exfoliación facial', 25, 20000)).resolves.toBeDefined();
  });
});

describe('Seed del catálogo sobre el escenario de desarrollo (catálogo viejo + 3 citas + secuencia en 33)', () => {
  let citasAntes;

  beforeAll(async () => {
    await prepararEscenarioLegado();
    citasAntes = await estadoDeLasCitas();
    await sembrarCatalogo(bd);
  });

  it('deja los 39 servicios nuevos activos, con categoría, tipo y descripción válidos', async () => {
    const { rows } = await bd.query(
      `SELECT s.nombre, s.tipo, s.descripcion, s.categoria_id, s.activo, c.slug
       FROM servicios s JOIN categorias c ON c.id = s.categoria_id
       WHERE s.activo = true`
    );
    expect(rows).toHaveLength(39);
    for (const fila of rows) {
      expect(['original', 'elite', 'vip']).toContain(fila.tipo);
      expect(fila.descripcion.trim().length).toBeGreaterThan(0);
    }
  });

  it('copia las descripciones tal cual, casándolas por id del archivo y no por posición', async () => {
    const esperadas = new Map(descripcionesReales.map((d) => [d.id, d.descripcion]));
    for (const servicio of catalogoReal.flatMap((c) => c.servicios)) {
      const { rows } = await bd.query('SELECT descripcion, precio, duracion_min FROM servicios WHERE nombre = $1', [servicio.nombre]);
      expect(rows[0].descripcion).toBe(esperadas.get(servicio.id));
      expect(rows[0].precio).toBe(servicio.precio);
      expect(rows[0].duracion_min).toBe(servicio.duracion);
    }
  });

  it('crea las 6 categorías con el orden de aparición en el archivo', async () => {
    const { rows } = await bd.query('SELECT nombre, slug, orden FROM categorias ORDER BY orden');
    expect(rows.map((r) => r.slug)).toEqual(catalogoReal.map((c) => c.slug));
    expect(rows.map((r) => r.orden)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('desactiva (sin borrar) los 6 servicios viejos y conserva sus ids', async () => {
    const { rows } = await bd.query('SELECT id, nombre, activo FROM servicios WHERE id <= 6 ORDER BY id');
    expect(rows.map((r) => r.nombre)).toEqual(LEGADOS.map(([nombre]) => nombre));
    expect(rows.every((r) => r.activo === false)).toBe(true);
  });

  it('las citas antiguas quedan intactas y con su servicio original', async () => {
    expect(await estadoDeLasCitas()).toEqual(citasAntes);
    const { rows } = await bd.query(
      'SELECT c.id, s.nombre FROM citas c JOIN servicios s ON s.id = c.servicio_id ORDER BY c.id'
    );
    expect(rows.map((r) => r.nombre)).toEqual(['Corte de Cabello', 'Corte de Barba', 'Combo (Pelo + Barba)']);
  });

  it('los servicios nuevos reciben ids de la secuencia (posteriores a 33) y ninguno reutiliza un id viejo', async () => {
    const { rows } = await bd.query('SELECT MIN(id)::int AS minimo, COUNT(DISTINCT id)::int AS distintos FROM servicios WHERE activo = true');
    expect(rows[0].minimo).toBeGreaterThan(33);
    expect(rows[0].distintos).toBe(39);
  });

  it('"Exfoliación Facial" (viejo, inactivo) y "Exfoliación facial" (nuevo, activo) conviven sin chocar', async () => {
    const { rows } = await bd.query(
      `SELECT nombre, activo FROM servicios WHERE lower(nombre) = 'exfoliación facial' ORDER BY id`
    );
    expect(rows).toEqual([
      { nombre: 'Exfoliación Facial', activo: false },
      { nombre: 'Exfoliación facial', activo: true },
    ]);
  });

  it('un servicio creado después sin id explícito no choca con los sembrados', async () => {
    await expect(
      bd.query(`INSERT INTO servicios (nombre, duracion_min, precio) VALUES ('Servicio posterior', 20, 10000)`)
    ).resolves.toBeDefined();
  });
});

describe('Idempotencia del seed', () => {
  beforeAll(async () => {
    await prepararEscenarioLegado();
    await sembrarCatalogo(bd);
  });

  const fotografia = async () => {
    const { rows } = await bd.query(
      `SELECT nombre, duracion_min, precio, tipo, descripcion, categoria_id, activo FROM servicios ORDER BY nombre`
    );
    const { rows: categorias } = await bd.query('SELECT nombre, slug, orden FROM categorias ORDER BY orden');
    return { rows, categorias };
  };

  it('correrlo de nuevo no duplica servicios ni categorías ni cambia nada', async () => {
    const antes = await fotografia();
    const citasAntes = await estadoDeLasCitas();
    const resultado = await sembrarCatalogo(bd);
    const despues = await fotografia();

    expect(despues).toEqual(antes);
    expect(despues.rows).toHaveLength(45); // 39 nuevos + 6 viejos
    expect(despues.categorias).toHaveLength(6);
    expect(resultado.desactivados).toBe(0);
    expect(await estadoDeLasCitas()).toEqual(citasAntes);
  });

  it('si cambian un precio o una descripción en los datos, el seed los actualiza', async () => {
    const modificado = structuredClone(catalogoReal);
    modificado[0].servicios[0].precio = 19999;
    const listaModificada = descripcionesReales.map((d) => (d.id === 1 ? { ...d, descripcion: 'Descripción nueva' } : d));

    await sembrarCatalogo(bd, { catalogo: modificado, listaDescripciones: listaModificada });

    const { rows } = await bd.query('SELECT precio, descripcion FROM servicios WHERE nombre = $1', [catalogoReal[0].servicios[0].nombre]);
    expect(rows[0]).toEqual({ precio: 19999, descripcion: 'Descripción nueva' });
    const { rows: total } = await bd.query('SELECT COUNT(*)::int AS n FROM servicios');
    expect(total[0].n).toBe(45);
  });

  it('reactiva un servicio nuevo que alguien desactivó a mano', async () => {
    const nombre = catalogoReal[1].servicios[0].nombre;
    await bd.query('UPDATE servicios SET activo = false WHERE nombre = $1', [nombre]);
    await sembrarCatalogo(bd);
    const { rows } = await bd.query('SELECT activo FROM servicios WHERE nombre = $1', [nombre]);
    expect(rows[0].activo).toBe(true);
  });

  it('los nombres viejos que coinciden con los del catálogo nuevo no se desactivan', () => {
    const nuevos = catalogoReal.flatMap((c) => c.servicios.map((s) => s.nombre));
    // Documenta el hecho: hoy ninguno coincide exactamente, por eso los 6 viejos se apagan.
    expect(NOMBRES_SERVICIOS_LEGADOS.filter((n) => nuevos.includes(n))).toEqual([]);
  });
});
