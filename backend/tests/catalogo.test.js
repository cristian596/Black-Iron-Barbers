import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
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
import { aplicarMigracionesCatalogo, MIGRACION_CLAVES, MIGRACION_LEGADO } from '../db/migracionesCatalogo.js';

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
    expect(new Set(servicios.map((x) => x.clave)).size).toBe(39);
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
    expect(total[0].n).toBe(45);
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
    expect(resultado.claves.detalle).toEqual({ categorias: 6, servicios: 39 });
    const { rows } = await bd.query('SELECT COUNT(*)::int AS n FROM servicios WHERE clave_seed IS NOT NULL');
    expect(rows[0].n).toBe(39);
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
