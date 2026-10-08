import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import catalogoReal from '../db/data/servicios.js';
import descripcionesReales from '../db/data/descripciones.js';
import {
  sembrarCatalogo,
  validarCatalogo,
  restablecerCatalogo,
  calcularRestablecimiento,
  NOMBRES_SERVICIOS_LEGADOS,
} from '../db/sembrarCatalogo.js';
import {
  aplicarMigracionesCatalogo,
  MIGRACION_CLAVES,
  MIGRACION_LEGADO,
  MIGRACION_PERSONAL_AREA,
} from '../db/migracionesCatalogo.js';
import { sembrarPersonal, BARBEROS } from '../db/sembrarPersonal.js';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf-8');

// CREATE/DROP DATABASE fuerza un checkpoint en Postgres: en Docker/Windows puede tardar más de 5 s (el timeout por
// defecto) según lo que haya escrito la suite antes. Si un hook expiraba, su DROP seguía vivo en el servidor y la
// siguiente corrida (mismo nombre de base) chocaba con él. Por eso: tiempos holgados, un nombre de base único por
// corrida y una limpieza que borra con FORCE solo bases cuyo nombre empieza por este prefijo (mismo arreglo que
// migracion.test.js).
vi.setConfig({ testTimeout: 30_000, hookTimeout: 120_000 });

const PREFIJO_BD = 'black_iron_catalogo_test';
const NOMBRE_BD = `${PREFIJO_BD}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const credenciales = () => ({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
});

// Borra con FORCE las bases de este archivo (la de esta corrida y las que haya dejado una corrida abortada).
const borrarBasesDePrueba = async () => {
  const admin = new Pool({ ...credenciales(), database: 'postgres' });
  try {
    const { rows } = await admin.query('SELECT datname FROM pg_database WHERE left(datname, $2) = $1', [
      PREFIJO_BD,
      PREFIJO_BD.length,
    ]);
    for (const { datname } of rows) {
      await admin.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
    }
  } finally {
    await admin.end();
  }
};

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
  await bd.query('TRUNCATE citas, servicios, categorias, barberos, migraciones_aplicadas RESTART IDENTITY CASCADE');
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
  await borrarBasesDePrueba();
  const admin = new Pool({ ...credenciales(), database: 'postgres' });
  try {
    await admin.query(`CREATE DATABASE "${NOMBRE_BD}"`);
  } finally {
    await admin.end();
  }
  bd = new Pool({ ...credenciales(), database: NOMBRE_BD });
  await bd.query(schema);
});

afterAll(async () => {
  await bd?.end();
  await borrarBasesDePrueba();
});

describe('Datos del catálogo (backend/db/data)', () => {
  it('son coherentes: 42 servicios (39 de barbería + 3 de asesoría), 42 descripciones, sin repetidos ni huérfanos', () => {
    expect(validarCatalogo(catalogoReal, descripcionesReales)).toEqual([]);
    expect(catalogoReal.flatMap((c) => c.servicios)).toHaveLength(42);
    expect(descripcionesReales).toHaveLength(42);
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

  it('validarCatalogo exige una clave única y no vacía en cada servicio y categoría', () => {
    const sinClaves = [{ categoria: 'A', slug: 'a', servicios: [{ id: 1, nombre: 'X', tipo: 'vip', precio: 10, duracion: 5 }] }];
    expect(validarCatalogo(sinClaves, [{ id: 1, descripcion: 'x' }]).join(' | ')).toMatch(/servicios sin clave.*1.*categorías sin clave.*a/);

    const vacias = [{ categoria: 'A', slug: 'a', clave: '  ', servicios: [{ id: 1, clave: '', nombre: 'X', tipo: 'vip', precio: 10, duracion: 5 }] }];
    const problemasVacias = validarCatalogo(vacias, [{ id: 1, descripcion: 'x' }]).join(' | ');
    expect(problemasVacias).toMatch(/servicios sin clave/);
    expect(problemasVacias).toMatch(/categorías sin clave/);

    const repetidas = [
      { categoria: 'A', slug: 'a', clave: 'k', servicios: [{ id: 1, clave: 's', nombre: 'X', tipo: 'vip', precio: 10, duracion: 5 }] },
      { categoria: 'B', slug: 'b', clave: 'k', servicios: [{ id: 2, clave: 's', nombre: 'Y', tipo: 'vip', precio: 10, duracion: 5 }] },
    ];
    const problemasRepetidas = validarCatalogo(repetidas, [{ id: 1, descripcion: 'x' }, { id: 2, descripcion: 'y' }]).join(' | ');
    expect(problemasRepetidas).toMatch(/claves de servicio repetidas: s/);
    expect(problemasRepetidas).toMatch(/claves de categoría repetidas: k/);
  });

  it('todos los servicios y categorías de los datos reales tienen clave', () => {
    const servicios = catalogoReal.flatMap((c) => c.servicios);
    expect(servicios.every((x) => typeof x.clave === 'string' && x.clave.length > 0)).toBe(true);
    expect(catalogoReal.every((c) => typeof c.clave === 'string' && c.clave.length > 0)).toBe(true);
    expect(new Set(servicios.map((x) => x.clave)).size).toBe(42);
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

  it('deja los 42 servicios nuevos activos, con categoría, tipo y descripción válidos', async () => {
    const { rows } = await bd.query(
      `SELECT s.nombre, s.tipo, s.descripcion, s.categoria_id, s.activo, c.slug
       FROM servicios s JOIN categorias c ON c.id = s.categoria_id
       WHERE s.activo = true`
    );
    expect(rows).toHaveLength(42);
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

  it('crea las 7 categorías con el orden de aparición en el archivo', async () => {
    const { rows } = await bd.query('SELECT nombre, slug, orden FROM categorias ORDER BY orden');
    expect(rows.map((r) => r.slug)).toEqual(catalogoReal.map((c) => c.slug));
    expect(rows.map((r) => r.orden)).toEqual([1, 2, 3, 4, 5, 6, 7]);
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
    expect(rows[0].distintos).toBe(42);
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
    expect(despues.rows).toHaveLength(48); // 42 nuevos (39 de barbería + 3 de asesoría) + 6 viejos
    expect(despues.categorias).toHaveLength(7);
    expect(resultado.servicios.insertados).toBe(0);
    expect(resultado.categorias.insertadas).toBe(0);
    expect(resultado.migraciones.legado.aplicada).toBe(false); // el paso único ya estaba registrado
    expect(await estadoDeLasCitas()).toEqual(citasAntes);
  });

  it('si cambian un precio o una descripción en los datos, el seed NO actualiza lo que ya existe (solo inserta)', async () => {
    const modificado = structuredClone(catalogoReal);
    modificado[0].servicios[0].precio = 19999;
    const listaModificada = descripcionesReales.map((d) => (d.id === 1 ? { ...d, descripcion: 'Descripción nueva' } : d));

    await sembrarCatalogo(bd, { catalogo: modificado, listaDescripciones: listaModificada });

    const { rows } = await bd.query('SELECT precio, descripcion FROM servicios WHERE nombre = $1', [catalogoReal[0].servicios[0].nombre]);
    expect(rows[0]).toEqual({ precio: catalogoReal[0].servicios[0].precio, descripcion: descripcionesReales[0].descripcion });
    const { rows: total } = await bd.query('SELECT COUNT(*)::int AS n FROM servicios');
    expect(total[0].n).toBe(48);
  });

  it('NO reactiva un servicio nuevo que el admin desactivó', async () => {
    const nombre = catalogoReal[1].servicios[0].nombre;
    await bd.query('UPDATE servicios SET activo = false WHERE nombre = $1', [nombre]);
    await sembrarCatalogo(bd);
    const { rows } = await bd.query('SELECT activo FROM servicios WHERE nombre = $1', [nombre]);
    expect(rows[0].activo).toBe(false);
  });

  it('los nombres viejos que coinciden con los del catálogo nuevo no se desactivan', () => {
    const nuevos = catalogoReal.flatMap((c) => c.servicios.map((s) => s.nombre));
    // Documenta el hecho: hoy ninguno coincide exactamente, por eso los 6 viejos se apagan.
    expect(NOMBRES_SERVICIOS_LEGADOS.filter((n) => nuevos.includes(n))).toEqual([]);
  });
});

describe('Seed que solo inserta (nunca pisa lo que el admin edite)', () => {

  beforeAll(async () => {
    await prepararEscenarioLegado();
    await sembrarCatalogo(bd);
  });

  it('no pisa ediciones del admin: nombre, precio, duración, tipo, categoría ni descripción', async () => {
    const { rows: cats } = await bd.query("SELECT id FROM categorias WHERE clave_seed = 'barba'");
    await bd.query(
      `UPDATE servicios SET precio = 77777, duracion_min = 99, tipo = 'vip', descripcion = 'Editada por el admin', categoria_id = $1
       WHERE clave_seed = 'corte-militar'`,
      [cats[0].id]
    );
    await bd.query("UPDATE categorias SET nombre = 'Cortes renombrada', orden = 9 WHERE clave_seed = 'cortes'");

    const resultado = await sembrarCatalogo(bd);

    const { rows } = await bd.query(
      "SELECT precio, duracion_min, tipo, descripcion, categoria_id FROM servicios WHERE clave_seed = 'corte-militar'"
    );
    expect(rows[0]).toEqual({ precio: 77777, duracion_min: 99, tipo: 'vip', descripcion: 'Editada por el admin', categoria_id: cats[0].id });
    const { rows: cat } = await bd.query("SELECT nombre, orden FROM categorias WHERE clave_seed = 'cortes'");
    expect(cat[0]).toEqual({ nombre: 'Cortes renombrada', orden: 9 });
    expect(resultado.servicios.insertados).toBe(0);
    expect(resultado.categorias.insertadas).toBe(0);
  });

  it('no reactiva lo que el admin desactivó ni desactiva lo que reactivó (ni siquiera un servicio del catálogo anterior)', async () => {
    await bd.query("UPDATE servicios SET activo = false WHERE clave_seed = 'corte-clasico'");
    await bd.query("UPDATE servicios SET activo = true WHERE nombre = 'Corte de Cabello'"); // legado reactivado por el admin

    await sembrarCatalogo(bd);
    await aplicarMigracionesCatalogo(bd); // como en cada arranque del backend

    const { rows } = await bd.query("SELECT clave_seed, nombre, activo FROM servicios WHERE clave_seed = 'corte-clasico' OR nombre = 'Corte de Cabello' ORDER BY id");
    expect(rows.find((r) => r.nombre === 'Corte de Cabello').activo).toBe(true);
    expect(rows.find((r) => r.clave_seed === 'corte-clasico').activo).toBe(false);
  });

  it('un servicio renombrado por el admin no se duplica: el seed lo reconoce por su clave', async () => {
    await bd.query("UPDATE servicios SET nombre = 'Militar renombrado' WHERE clave_seed = 'corte-militar'");
    const { rows: antes } = await bd.query('SELECT COUNT(*)::int AS n FROM servicios');

    await sembrarCatalogo(bd);

    const { rows: despues } = await bd.query('SELECT COUNT(*)::int AS n FROM servicios');
    expect(despues[0].n).toBe(antes[0].n);
    const { rows } = await bd.query("SELECT nombre FROM servicios WHERE nombre = 'Corte militar' OR clave_seed = 'corte-militar'");
    expect(rows).toEqual([{ nombre: 'Militar renombrado' }]);
  });

  it('un servicio creado por el admin (clave_seed nulo) no se toca jamás', async () => {
    const { rows: cat } = await bd.query("SELECT id FROM categorias WHERE clave_seed = 'barba'");
    await bd.query(
      `INSERT INTO servicios (nombre, duracion_min, precio, categoria_id, tipo, descripcion, activo)
       VALUES ('Servicio del admin', 33, 12345, $1, 'elite', 'Mío', false)`,
      [cat[0].id]
    );
    const antes = await bd.query("SELECT * FROM servicios WHERE nombre = 'Servicio del admin'");

    await sembrarCatalogo(bd);
    await aplicarMigracionesCatalogo(bd);

    const despues = await bd.query("SELECT * FROM servicios WHERE nombre = 'Servicio del admin'");
    expect(despues.rows).toEqual(antes.rows);
    expect(despues.rows[0].clave_seed).toBeNull();
  });

  it('inserta lo que falta (y solo eso): un servicio y una categoría sembrados que ya no estén', async () => {
    await bd.query("DELETE FROM servicios WHERE clave_seed IN ('corte-mullet', 'corte-ejecutivo')");
    await bd.query("DELETE FROM servicios WHERE categoria_id = (SELECT id FROM categorias WHERE clave_seed = 'ondulados')");
    await bd.query("DELETE FROM categorias WHERE clave_seed = 'ondulados'");

    const resultado = await sembrarCatalogo(bd);

    const ondulados = catalogoReal.find((c) => c.clave === 'ondulados').servicios.length;
    expect(resultado.categorias.insertadas).toBe(1);
    expect(resultado.servicios.insertados).toBe(2 + ondulados);
    const { rows } = await bd.query("SELECT nombre FROM servicios WHERE clave_seed IN ('corte-mullet', 'corte-ejecutivo') ORDER BY nombre");
    expect(rows).toHaveLength(2);
    const { rows: edit } = await bd.query("SELECT precio FROM servicios WHERE clave_seed = 'corte-militar'");
    expect(edit[0].precio).toBe(77777); // lo editado antes sigue igual
  });

  it('si el nombre o slug de una categoría del catálogo ya lo usa otra categoría del admin, la omite sin pisarla', async () => {
    await prepararEscenarioLegado();
    await bd.query("INSERT INTO categorias (nombre, slug, orden) VALUES ('Cortes', 'cortes-del-admin', 1)");

    const resultado = await sembrarCatalogo(bd);

    expect(resultado.omitidos.join(' ')).toMatch(/Cortes/);
    const { rows } = await bd.query("SELECT clave_seed FROM categorias WHERE nombre = 'Cortes'");
    expect(rows).toEqual([{ clave_seed: null }]);
    const { rows: servicios } = await bd.query("SELECT COUNT(*)::int AS n FROM servicios WHERE clave_seed = 'corte-militar'");
    expect(servicios[0].n).toBe(0);
  });

  it('sembrarCatalogo rechaza datos sin clave antes de tocar la base', async () => {
    const sinClave = [{ categoria: 'A', slug: 'a', servicios: [{ id: 1, nombre: 'X', tipo: 'vip', precio: 10, duracion: 5 }] }];
    await expect(sembrarCatalogo(bd, { catalogo: sinClave, listaDescripciones: [{ id: 1, descripcion: 'x' }] })).rejects.toThrow(
      /sin clave/
    );
  });
});

describe('Migración de claves y apagado del catálogo anterior (pasos únicos)', () => {
  // Simula una base creada por el seed ANTERIOR (sin claves, casado por nombre) y aún sin migrar.
  const prepararBaseSinMigrar = async () => {
    await prepararEscenarioLegado();
    await sembrarCatalogo(bd);
    await bd.query('UPDATE servicios SET clave_seed = NULL');
    await bd.query('UPDATE categorias SET clave_seed = NULL');
    await bd.query('DELETE FROM migraciones_aplicadas');
  };

  it('el backfill asigna clave a los servicios (por nombre) y categorías (por slug) del catálogo y lo registra', async () => {
    await prepararBaseSinMigrar();
    await bd.query("INSERT INTO servicios (nombre, duracion_min, precio) VALUES ('Servicio del admin sin clave', 10, 1000)");

    const resultado = await aplicarMigracionesCatalogo(bd);

    expect(resultado.claves.aplicada).toBe(true);
    expect(resultado.claves.detalle).toEqual({ categorias: 7, servicios: 42 });
    const { rows } = await bd.query('SELECT COUNT(*)::int AS n FROM servicios WHERE clave_seed IS NOT NULL');
    expect(rows[0].n).toBe(42);
    const { rows: libre } = await bd.query("SELECT clave_seed FROM servicios WHERE nombre = 'Servicio del admin sin clave'");
    expect(libre[0].clave_seed).toBeNull();
    const { rows: registro } = await bd.query('SELECT clave FROM migraciones_aplicadas ORDER BY clave');
    expect(registro.map((r) => r.clave)).toContain(MIGRACION_CLAVES);
  });

  it('limitación conocida: un servicio renombrado ANTES del backfill ya no se puede casar por nombre (se vuelve a crear, nunca se pisa)', async () => {
    await prepararBaseSinMigrar();
    await bd.query("UPDATE servicios SET nombre = 'Corte militar (mío)' WHERE nombre = 'Corte militar'");
    const { rows: antes } = await bd.query('SELECT COUNT(*)::int AS n FROM servicios');

    // El backfill corre en el arranque, ANTES del seed; el renombrado previo a la migración no se puede casar
    // por nombre (limitación documentada), pero el seed solo duplicaría ese servicio, nunca pisaría nada.
    await aplicarMigracionesCatalogo(bd);
    await sembrarCatalogo(bd);

    const { rows: despues } = await bd.query('SELECT COUNT(*)::int AS n FROM servicios');
    expect(despues[0].n).toBe(antes[0].n + 1);
    const { rows } = await bd.query("SELECT nombre, precio FROM servicios WHERE nombre IN ('Corte militar (mío)', 'Corte militar') ORDER BY nombre");
    expect(rows).toHaveLength(2);
  });

  it('el paso del catálogo anterior se registra una sola vez y, si ya estaban inactivos, no reactiva nada', async () => {
    await prepararBaseSinMigrar(); // el escenario ya dejó los 6 viejos inactivos
    const resultado = await aplicarMigracionesCatalogo(bd);

    expect(resultado.legado.aplicada).toBe(true);
    expect(resultado.legado.detalle).toEqual({ desactivados: 0 });
    const { rows } = await bd.query('SELECT activo FROM servicios WHERE id <= 6');
    expect(rows.every((r) => r.activo === false)).toBe(true);
    const { rows: registro } = await bd.query('SELECT clave FROM migraciones_aplicadas');
    expect(registro.map((r) => r.clave).sort()).toEqual([MIGRACION_CLAVES, MIGRACION_LEGADO].sort());
  });

  it('si el admin reactiva uno de los 6 viejos, ninguna ejecución posterior lo vuelve a apagar', async () => {
    await prepararBaseSinMigrar();
    await aplicarMigracionesCatalogo(bd);
    await bd.query("UPDATE servicios SET activo = true WHERE nombre = 'Perfilado de Cejas'");

    for (let i = 0; i < 3; i += 1) {
      await aplicarMigracionesCatalogo(bd);
      await sembrarCatalogo(bd);
    }

    const { rows } = await bd.query("SELECT activo FROM servicios WHERE nombre = 'Perfilado de Cejas'");
    expect(rows[0].activo).toBe(true);
  });

  it('con servicios viejos activos desactiva los 6 una vez (sin borrarlos), y solo cuando el catálogo nuevo ya está', async () => {
    await prepararEscenarioLegado();
    await bd.query('UPDATE servicios SET activo = true WHERE id <= 6');

    // Aún sin catálogo nuevo: el paso queda pendiente y no apaga nada.
    const pendiente = await aplicarMigracionesCatalogo(bd);
    expect(pendiente.legado.aplicada).toBe(false);
    const { rows: siguenActivos } = await bd.query('SELECT COUNT(*)::int AS n FROM servicios WHERE id <= 6 AND activo');
    expect(siguenActivos[0].n).toBe(6);

    await sembrarCatalogo(bd);

    const { rows } = await bd.query('SELECT id, nombre, activo FROM servicios WHERE id <= 6 ORDER BY id');
    expect(rows.map((r) => r.nombre)).toEqual(LEGADOS.map(([nombre]) => nombre));
    expect(rows.every((r) => r.activo === false)).toBe(true);
  });

  it('las citas históricas siguen apuntando a sus servicios viejos después de todo el proceso', async () => {
    await prepararEscenarioLegado();
    const antes = await estadoDeLasCitas();
    await sembrarCatalogo(bd);
    await sembrarCatalogo(bd);
    expect(await estadoDeLasCitas()).toEqual(antes);
  });
});

describe('--restablecer-catalogo (solo desarrollo)', () => {
  beforeAll(async () => {
    await prepararEscenarioLegado();
    await sembrarCatalogo(bd);
  });

  it('sin cambios la base ya coincide con el catálogo: no hay nada que sobrescribir', async () => {
    const plan = await calcularRestablecimiento(bd);
    expect(plan).toEqual({ cambios: [], faltantes: [] });
  });

  it('la simulación lista qué se sobrescribiría y no escribe nada', async () => {
    await bd.query("UPDATE servicios SET precio = 1, nombre = 'Otro nombre', activo = false WHERE clave_seed = 'corte-militar'");
    await bd.query("UPDATE categorias SET nombre = 'Otra', activo = false WHERE clave_seed = 'barba'");

    const plan = await calcularRestablecimiento(bd);

    const servicio = plan.cambios.find((c) => c.tipo === 'servicio');
    expect(servicio.etiqueta).toBe('Corte militar');
    expect(servicio.campos.map((c) => c.campo).sort()).toEqual(['activo', 'nombre', 'precio']);
    expect(servicio.campos.find((c) => c.campo === 'precio')).toEqual({ campo: 'precio', actual: 1, nuevo: 18000 });
    const categoria = plan.cambios.find((c) => c.tipo === 'categoria');
    expect(categoria.campos.map((c) => c.campo).sort()).toEqual(['activo', 'nombre']);
    const { rows } = await bd.query("SELECT precio FROM servicios WHERE clave_seed = 'corte-militar'");
    expect(rows[0].precio).toBe(1);
  });

  it('restablecer sobrescribe lo editado en filas del catálogo, reactiva, inserta lo que falte y no toca servicios del admin', async () => {
    const { rows: cat } = await bd.query("SELECT id FROM categorias WHERE clave_seed = 'cortes'");
    await bd.query(
      "INSERT INTO servicios (nombre, duracion_min, precio, categoria_id, tipo, descripcion) VALUES ('Solo del admin', 10, 5000, $1, 'original', 'x')",
      [cat[0].id]
    );
    await bd.query("DELETE FROM servicios WHERE clave_seed = 'corte-mullet'");

    const resultado = await restablecerCatalogo(bd);

    expect(resultado.restablecidos).toBeGreaterThan(0);
    expect(resultado.insertados.servicios.insertados).toBe(1);
    const { rows } = await bd.query("SELECT nombre, precio, activo FROM servicios WHERE clave_seed = 'corte-militar'");
    expect(rows[0]).toEqual({ nombre: 'Corte militar', precio: 18000, activo: true });
    const { rows: admin } = await bd.query("SELECT precio FROM servicios WHERE nombre = 'Solo del admin'");
    expect(admin[0].precio).toBe(5000);
    expect(await calcularRestablecimiento(bd)).toEqual({ cambios: [], faltantes: [] });
  });
});

describe('Asesorías en el catálogo (area asesoria)', () => {
  beforeAll(async () => {
    await prepararEscenarioLegado();
    await sembrarCatalogo(bd);
  });

  it('crea la categoría "Asesorías" (clave asesorias, area asesoria) y las demás quedan en barbería', async () => {
    const { rows } = await bd.query('SELECT slug, clave_seed, area, activo FROM categorias ORDER BY orden');
    const asesorias = rows.filter((r) => r.area === 'asesoria');
    expect(asesorias).toEqual([{ slug: 'asesorias', clave_seed: 'asesorias', area: 'asesoria', activo: true }]);
    expect(rows.filter((r) => r.area === 'barberia')).toHaveLength(6);
  });

  it('siembra las 3 asesorías con clave estable, precio, duración, tipo válido y descripción', async () => {
    const { rows } = await bd.query(
      `SELECT clave_seed, nombre, precio, duracion_min, tipo, area, activo, descripcion
       FROM servicios WHERE area = 'asesoria' ORDER BY precio`
    );
    expect(rows.map((r) => [r.clave_seed, r.precio, r.duracion_min, r.area, r.activo])).toEqual([
      ['asesoria-gratis', 0, 15, 'asesoria', true],
      ['asesoria-barba', 45000, 45, 'asesoria', true],
      ['asesoria-premium', 60000, 60, 'asesoria', true],
    ]);
    for (const fila of rows) {
      expect(['original', 'elite', 'vip']).toContain(fila.tipo); // sin valores nuevos en el CHECK de tipo
      expect(fila.descripcion.trim().length).toBeGreaterThan(0);
    }
  });

  it('todos los demás servicios activos del catálogo son de barbería', async () => {
    const { rows } = await bd.query("SELECT COUNT(*)::int AS n FROM servicios WHERE activo AND area = 'barberia'");
    expect(rows[0].n).toBe(39);
  });

  it('correr el seed otra vez no duplica las asesorías ni cambia su área', async () => {
    const antes = (await bd.query("SELECT clave_seed, area FROM servicios WHERE area = 'asesoria' ORDER BY clave_seed")).rows;
    const resultado = await sembrarCatalogo(bd);
    const despues = (await bd.query("SELECT clave_seed, area FROM servicios WHERE area = 'asesoria' ORDER BY clave_seed")).rows;
    expect(despues).toEqual(antes);
    expect(despues).toHaveLength(3);
    expect(resultado.servicios.insertados).toBe(0);
    expect(resultado.categorias.insertadas).toBe(0);
  });

  it('el área del catálogo se valida: un valor desconocido se rechaza antes de tocar la base', async () => {
    const roto = [{ categoria: 'A', slug: 'a', clave: 'a', area: 'otra', servicios: [] }];
    expect(validarCatalogo(roto, []).join(' | ')).toMatch(/area inválida en categorías: a/);
  });

  it('--restablecer-catalogo también reconoce el área (la compara y la restablece)', async () => {
    await bd.query("UPDATE servicios SET area = 'barberia' WHERE clave_seed = 'asesoria-gratis'");
    const plan = await calcularRestablecimiento(bd);
    const cambio = plan.cambios.find((c) => c.etiqueta === 'Asesoría de imagen gratis');
    expect(cambio.campos).toEqual([{ campo: 'area', actual: 'barberia', nuevo: 'asesoria' }]);
    await restablecerCatalogo(bd);
    const { rows } = await bd.query("SELECT area FROM servicios WHERE clave_seed = 'asesoria-gratis'");
    expect(rows[0].area).toBe('asesoria');
  });
});

describe('Personal: seed con área y migración única personal-area-asesoria-v1', () => {
  const limpiarPersonal = async () => {
    await bd.query('TRUNCATE citas, usuarios, servicios, categorias, barberos, migraciones_aplicadas RESTART IDENTITY CASCADE');
  };
  const crearCamila = async (area = 'barberia') => {
    const { rows } = await bd.query(
      `INSERT INTO barberos (nombre, cargo, especialidad, area) VALUES ('Camila', 'Asesora de Imagen', 'Asesoria', $1) RETURNING id`,
      [area]
    );
    return rows[0].id;
  };
  const crearBarbero = async (nombre = 'Barbero Migracion') => {
    const { rows } = await bd.query(`INSERT INTO barberos (nombre, cargo) VALUES ($1, 'Barbero') RETURNING id`, [nombre]);
    return rows[0].id;
  };
  const cita = async (barberoId, fecha, estado) => {
    const { rows } = await bd.query(
      `INSERT INTO servicios (nombre, duracion_min, precio) VALUES ('Servicio ' || $1::text, 30, 1000) RETURNING id`,
      [`${barberoId}-${fecha}-${estado}`]
    );
    await bd.query(
      `INSERT INTO citas (cliente, correo, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado)
       VALUES ('C', 'c@c.com', $1, $2, $3, '10:00', 30, 1000, $4)`,
      [rows[0].id, barberoId, fecha, estado]
    );
  };
  const areaDe = async (id) => (await bd.query('SELECT area FROM barberos WHERE id = $1', [id])).rows[0].area;
  const registrada = async () =>
    (await bd.query('SELECT 1 FROM migraciones_aplicadas WHERE clave = $1', [MIGRACION_PERSONAL_AREA])).rowCount === 1;

  it('el seed siembra a Camila con area asesoria y al resto como barbería, y es idempotente', async () => {
    await limpiarPersonal();
    expect(await sembrarPersonal(bd)).toBe(BARBEROS.length);
    expect(await sembrarPersonal(bd)).toBe(0);
    const { rows } = await bd.query('SELECT nombre, area FROM barberos ORDER BY id');
    expect(rows.filter((r) => r.area === 'asesoria')).toEqual([{ nombre: 'Camila', area: 'asesoria' }]);
    expect(rows).toHaveLength(BARBEROS.length);
  });

  it('el seed no cambia el área de quien ya existe', async () => {
    await limpiarPersonal();
    await crearCamila('barberia'); // base anterior: Camila sin marcar
    await sembrarPersonal(bd);
    expect(await areaDe((await bd.query("SELECT id FROM barberos WHERE nombre = 'Camila'")).rows[0].id)).toBe('barberia');
  });

  it('marca a Camila (nombre + cargo) una sola vez y deja el registro; los demás no cambian', async () => {
    await limpiarPersonal();
    const camila = await crearCamila();
    const otro = await crearBarbero();
    await bd.query("INSERT INTO barberos (nombre, cargo) VALUES ('Camila', 'Barbera')"); // misma nombre, otro cargo: no es la asesora
    await cita(camila, '2020-01-10', 'completada'); // historial pasado (como las citas 449 y 450): no bloquea

    const resultado = await aplicarMigracionesCatalogo(bd);

    expect(resultado.personal).toEqual({ aplicada: true, detalle: { marcados: 1 } });
    expect(await areaDe(camila)).toBe('asesoria');
    expect(await areaDe(otro)).toBe('barberia');
    const { rows } = await bd.query("SELECT cargo, area FROM barberos WHERE nombre = 'Camila' ORDER BY id");
    expect(rows).toEqual([
      { cargo: 'Asesora de Imagen', area: 'asesoria' },
      { cargo: 'Barbera', area: 'barberia' },
    ]);
    expect(await registrada()).toBe(true);
    // Sus citas pasadas siguen intactas
    expect((await bd.query('SELECT estado, fecha::text FROM citas WHERE barbero_id = $1', [camila])).rows).toEqual([
      { estado: 'completada', fecha: '2020-01-10' },
    ]);

    const otra = await aplicarMigracionesCatalogo(bd);
    expect(otra.personal.aplicada).toBe(false); // no se repite
  });

  it('no se repite: si después alguien vuelve a poner a Camila en barbería, ninguna ejecución la vuelve a marcar', async () => {
    await limpiarPersonal();
    const camila = await crearCamila();
    await aplicarMigracionesCatalogo(bd);
    await bd.query("UPDATE barberos SET area = 'barberia' WHERE id = $1", [camila]);
    await aplicarMigracionesCatalogo(bd);
    await sembrarCatalogo(bd);
    expect(await areaDe(camila)).toBe('barberia');
  });

  it('con citas pendientes o futuras ABORTA con un mensaje claro: no marca, no registra y no rompe el arranque', async () => {
    for (const [fecha, estado] of [
      ['2020-01-10', 'pendiente'], // pendiente (aunque su fecha ya pasó)
      ['2099-01-10', 'completada'], // futura
    ]) {
      await limpiarPersonal();
      const camila = await crearCamila();
      await cita(camila, fecha, estado);

      const resultado = await aplicarMigracionesCatalogo(bd);

      expect(resultado.personal.aplicada).toBe(false);
      expect(resultado.personal.abortada).toMatch(/Camila.*1 cita\(s\) pendientes o futuras/);
      expect(await areaDe(camila)).toBe('barberia');
      expect(await registrada()).toBe(false);
    }
  });

  it('una cita cancelada, aunque sea futura, no bloquea; y al cerrar las pendientes el paso se aplica solo', async () => {
    await limpiarPersonal();
    const camila = await crearCamila();
    await cita(camila, '2099-02-10', 'cancelada');
    await cita(camila, '2020-02-10', 'pendiente');

    expect((await aplicarMigracionesCatalogo(bd)).personal.abortada).toBeDefined();
    await bd.query("UPDATE citas SET estado = 'completada' WHERE barbero_id = $1 AND estado = 'pendiente'", [camila]);

    const resultado = await aplicarMigracionesCatalogo(bd);
    expect(resultado.personal).toEqual({ aplicada: true, detalle: { marcados: 1 } });
    expect(await areaDe(camila)).toBe('asesoria');
  });

  it('sin ninguna asesora en la base queda pendiente (no se registra); si ya viene marcada solo se registra', async () => {
    await limpiarPersonal();
    await crearBarbero();
    const sinCamila = await aplicarMigracionesCatalogo(bd);
    expect(sinCamila.personal).toEqual({ aplicada: false, detalle: null });
    expect(await registrada()).toBe(false);

    await crearCamila('asesoria');
    const yaMarcada = await aplicarMigracionesCatalogo(bd);
    expect(yaMarcada.personal).toEqual({ aplicada: true, detalle: { marcados: 0 } });
  });
});
