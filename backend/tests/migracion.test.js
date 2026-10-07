import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { aplicarMigracionesCatalogo, MIGRACION_CLAVES, MIGRACION_LEGADO } from '../db/migracionesCatalogo.js';
import { estadoContrasena } from '../utils/contrasenas.js';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaCompleto = readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf-8');

// DROP DATABASE fuerza un checkpoint inmediato en Postgres: en Docker/Windows tarda entre milisegundos y más de 6 s
// según lo que haya escrito la suite antes. Con el timeout por defecto (5 s) el test expiraba pero su DROP seguía vivo
// en el servidor, y el test siguiente (que reutilizaba el mismo nombre de base) chocaba con él. Por eso: tiempos
// holgados y un nombre de base único por test, de modo que un test que expira no pueda pisar al siguiente.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 120_000 });

const PREFIJO_BD = 'black_iron_migracion_test';
let nombreBd = PREFIJO_BD;

const conexionAdmin = () =>
  new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: 'postgres',
  });

// Borra con FORCE todas las bases de este archivo (las de esta corrida y las que haya dejado una corrida abortada).
const borrarBasesDePrueba = async () => {
  const admin = conexionAdmin();
  try {
    const { rows } = await admin.query(
      'SELECT datname FROM pg_database WHERE left(datname, $2) = $1',
      [PREFIJO_BD, PREFIJO_BD.length]
    );
    for (const { datname } of rows) {
      await admin.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
    }
  } finally {
    await admin.end();
  }
};

// Cada llamada crea una base NUEVA con nombre único (no hace falta borrar antes); la borra afterAll.
const recrearBasePrueba = async () => {
  nombreBd = `${PREFIJO_BD}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const admin = conexionAdmin();
  try {
    await admin.query(`CREATE DATABASE "${nombreBd}"`);
  } finally {
    await admin.end();
  }
};

const conectarseABasePrueba = () =>
  new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: nombreBd,
  });

// Esquema tal como estaba ANTES de este bloque de cambios: sin duracion_min/precio/telefono/
// consentimiento_en en citas, sin btree_gist ni EXCLUDE, con el UNIQUE original por (barbero_id,
// fecha, hora) — que no detecta solapamientos de citas con duraciones distintas.
const ESQUEMA_PREVIO = `
  CREATE TABLE barberos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    cargo VARCHAR(100),
    especialidad VARCHAR(150),
    foto VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT true
  );

  CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'barbero')),
    barbero_id INT REFERENCES barberos(id) ON DELETE SET NULL,
    activo BOOLEAN NOT NULL DEFAULT true
  );

  CREATE TABLE servicios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    duracion_min INT NOT NULL,
    precio INT NOT NULL
  );

  CREATE TABLE citas (
    id SERIAL PRIMARY KEY,
    cliente VARCHAR(100) NOT NULL,
    correo VARCHAR(150) NOT NULL,
    servicio_id INT REFERENCES servicios(id),
    barbero_id INT REFERENCES barberos(id),
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completada', 'cancelada')),
    creada_en TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (barbero_id, fecha, hora)
  );
`;

beforeAll(borrarBasesDePrueba);

afterAll(borrarBasesDePrueba);

describe('Migración de esquema (backend/db/schema.sql)', () => {
  it('se aplica sin errores sobre una base de datos completamente vacía', async () => {
    await recrearBasePrueba();
    const bd = conectarseABasePrueba();

    try {
      await expect(bd.query(schemaCompleto)).resolves.toBeDefined();

      const { rows } = await bd.query(
        `SELECT conname FROM pg_constraint WHERE conname = 'citas_sin_solapamiento'`
      );
      expect(rows).toHaveLength(1);

      const { rows: columnas } = await bd.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'citas' AND column_name IN ('duracion_min', 'precio', 'telefono', 'consentimiento_en', 'rango')`
      );
      expect(columnas.map((c) => c.column_name).sort()).toEqual(
        ['consentimiento_en', 'duracion_min', 'precio', 'rango', 'telefono'].sort()
      );
    } finally {
      await bd.end();
    }
  });

  it('se puede ejecutar dos veces seguidas sin error (idempotente, como en cada arranque del backend)', async () => {
    const bd = conectarseABasePrueba();
    try {
      await expect(bd.query(schemaCompleto)).resolves.toBeDefined();
    } finally {
      await bd.end();
    }
  });

  it('falla de forma controlada si ya existen citas solapadas antes de migrar, y no las borra ni dice por qué', async () => {
    await recrearBasePrueba();
    const bd = conectarseABasePrueba();

    try {
      await bd.query(ESQUEMA_PREVIO);
      await bd.query(
        `INSERT INTO barberos (id, nombre, activo) VALUES (1, 'Barbero Prueba', true)`
      );
      await bd.query(
        `INSERT INTO servicios (id, nombre, duracion_min, precio) VALUES (1, 'Combo', 90, 100000)`
      );
      // Dos citas que el UNIQUE original permitió porque no coinciden en 'hora' exacta,
      // pero que sí se solapan en el tiempo real (10:00-11:30 vs 10:30-12:00).
      await bd.query(
        `INSERT INTO citas (cliente, correo, servicio_id, barbero_id, fecha, hora)
         VALUES ('Cliente 1', 'c1@c.com', 1, 1, '2030-01-10', '10:00'),
                ('Cliente 2', 'c2@c.com', 1, 1, '2030-01-10', '10:30')`
      );

      await expect(bd.query(schemaCompleto)).rejects.toThrow(/could not create exclusion constraint/i);

      // La restricción nueva no debe haber quedado creada a medias.
      const { rows } = await bd.query(
        `SELECT conname FROM pg_constraint WHERE conname = 'citas_sin_solapamiento'`
      );
      expect(rows).toHaveLength(0);

      // Los datos originales siguen intactos (no se borró nada para "resolver" el conflicto).
      const { rows: citas } = await bd.query('SELECT cliente FROM citas ORDER BY id');
      expect(citas.map((c) => c.cliente)).toEqual(['Cliente 1', 'Cliente 2']);
    } finally {
      await bd.end();
    }
  });

  it('amplía servicios sobre una base previa sin perder ids ni citas: filas viejas activas, sin categoría, y repetible', async () => {
    await recrearBasePrueba();
    const bd = conectarseABasePrueba();

    try {
      await bd.query(ESQUEMA_PREVIO);
      await bd.query(`INSERT INTO barberos (id, nombre, activo) VALUES (1, 'Barbero Prueba', true)`);
      await bd.query(
        `INSERT INTO servicios (id, nombre, duracion_min, precio) VALUES (1, 'Corte viejo', 30, 50000), (2, 'Combo viejo', 90, 100000)`
      );
      await bd.query(
        `INSERT INTO citas (cliente, correo, servicio_id, barbero_id, fecha, hora)
         VALUES ('Cliente 1', 'c1@c.com', 2, 1, '2030-01-10', '10:00')`
      );

      await bd.query(schemaCompleto);
      await expect(bd.query(schemaCompleto)).resolves.toBeDefined();

      const { rows } = await bd.query('SELECT id, nombre, activo, categoria_id, tipo, descripcion FROM servicios ORDER BY id');
      expect(rows).toEqual([
        { id: 1, nombre: 'Corte viejo', activo: true, categoria_id: null, tipo: null, descripcion: null },
        { id: 2, nombre: 'Combo viejo', activo: true, categoria_id: null, tipo: null, descripcion: null },
      ]);

      const { rows: citas } = await bd.query('SELECT servicio_id, duracion_min, precio FROM citas');
      expect(citas).toEqual([{ servicio_id: 2, duracion_min: 90, precio: 100000 }]);

      const { rows: restricciones } = await bd.query(
        `SELECT conname FROM pg_constraint
         WHERE conname IN ('servicios_tipo_check', 'servicios_precio_check', 'servicios_duracion_min_check', 'servicios_nombre_key')`
      );
      expect(restricciones).toHaveLength(4);
    } finally {
      await bd.end();
    }
  });
});

describe('Migración de esquema: gestión del catálogo (clave_seed, categorias.activo, migraciones_aplicadas)', () => {
  it('en una base vacía crea las columnas, las restricciones UNIQUE y la tabla de migraciones', async () => {
    await recrearBasePrueba();
    const bd = conectarseABasePrueba();
    try {
      await bd.query(schemaCompleto);
      await bd.query(schemaCompleto); // idempotente

      const { rows: columnas } = await bd.query(
        `SELECT table_name, column_name, is_nullable, column_default FROM information_schema.columns
         WHERE (table_name, column_name) IN (('servicios', 'clave_seed'), ('categorias', 'clave_seed'), ('categorias', 'activo'))
         ORDER BY table_name, column_name`
      );
      expect(columnas).toEqual([
        { table_name: 'categorias', column_name: 'activo', is_nullable: 'NO', column_default: 'true' },
        { table_name: 'categorias', column_name: 'clave_seed', is_nullable: 'YES', column_default: null },
        { table_name: 'servicios', column_name: 'clave_seed', is_nullable: 'YES', column_default: null },
      ]);

      const { rows: restricciones } = await bd.query(
        "SELECT conname FROM pg_constraint WHERE conname IN ('servicios_clave_seed_key', 'categorias_clave_seed_key') ORDER BY conname"
      );
      expect(restricciones.map((r) => r.conname)).toEqual(['categorias_clave_seed_key', 'servicios_clave_seed_key']);

      const { rows: tabla } = await bd.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'migraciones_aplicadas' ORDER BY column_name`
      );
      expect(tabla.map((c) => c.column_name)).toEqual(['aplicada_en', 'clave']);
    } finally {
      await bd.end();
    }
  });

  it('clave_seed es único pero admite muchos NULL (servicios y categorías creados por el admin)', async () => {
    const bd = conectarseABasePrueba();
    try {
      await bd.query("INSERT INTO servicios (nombre, duracion_min, precio) VALUES ('A', 10, 1), ('B', 10, 1)");
      await bd.query("INSERT INTO servicios (nombre, duracion_min, precio, clave_seed) VALUES ('C', 10, 1, 'k')");
      await expect(
        bd.query("INSERT INTO servicios (nombre, duracion_min, precio, clave_seed) VALUES ('D', 10, 1, 'k')")
      ).rejects.toThrow(/servicios_clave_seed_key/);
      await bd.query("INSERT INTO categorias (nombre, slug, orden) VALUES ('X', 'x', 1), ('Y', 'y', 2)");
      const { rows } = await bd.query('SELECT activo FROM categorias');
      expect(rows.every((r) => r.activo === true)).toBe(true); // las categorías existentes quedan activas
    } finally {
      await bd.end();
    }
  });

  it('sobre una base previa deja las filas existentes sin clave, las categorías activas y no registra migraciones por sí solo', async () => {
    await recrearBasePrueba();
    const bd = conectarseABasePrueba();
    try {
      await bd.query(ESQUEMA_PREVIO);
      await bd.query("INSERT INTO servicios (id, nombre, duracion_min, precio) VALUES (1, 'Corte viejo', 30, 50000)");
      await bd.query(schemaCompleto);

      const { rows } = await bd.query('SELECT nombre, clave_seed, activo FROM servicios');
      expect(rows).toEqual([{ nombre: 'Corte viejo', clave_seed: null, activo: true }]);
      const { rows: migraciones } = await bd.query('SELECT COUNT(*)::int AS n FROM migraciones_aplicadas');
      expect(migraciones[0].n).toBe(0); // los pasos de datos los ejecuta aplicarMigracionesCatalogo, no el esquema
    } finally {
      await bd.end();
    }
  });

  it('aplicarMigracionesCatalogo sobre una base de desarrollo con el catálogo ya sembrado y el anterior inactivo: asigna claves, registra ambos pasos y no reactiva nada', async () => {
    await recrearBasePrueba();
    const bd = conectarseABasePrueba();
    try {
      await bd.query(schemaCompleto);
      // Estado de la base de desarrollo antes de esta migración: catálogo viejo inactivo, uno nuevo sin claves.
      await bd.query("INSERT INTO servicios (nombre, duracion_min, precio, activo) VALUES ('Corte de Cabello', 35, 55000, false), ('Corte de Barba', 45, 48000, false)");
      await bd.query("INSERT INTO categorias (nombre, slug, orden) VALUES ('Cortes', 'cortes', 1)");
      await bd.query(
        "INSERT INTO servicios (nombre, duracion_min, precio, categoria_id, tipo, descripcion) SELECT 'Corte militar', 25, 18000, id, 'original', 'x' FROM categorias WHERE slug = 'cortes'"
      );

      const resultado = await aplicarMigracionesCatalogo(bd);

      expect(resultado.claves).toEqual({ aplicada: true, detalle: { categorias: 1, servicios: 1 } });
      expect(resultado.legado).toEqual({ aplicada: true, detalle: { desactivados: 0 } });
      const { rows } = await bd.query('SELECT nombre, clave_seed, activo FROM servicios ORDER BY id');
      expect(rows).toEqual([
        { nombre: 'Corte de Cabello', clave_seed: null, activo: false },
        { nombre: 'Corte de Barba', clave_seed: null, activo: false },
        { nombre: 'Corte militar', clave_seed: 'corte-militar', activo: true },
      ]);
      const { rows: registro } = await bd.query('SELECT clave FROM migraciones_aplicadas ORDER BY clave');
      expect(registro.map((r) => r.clave)).toEqual([MIGRACION_CLAVES, MIGRACION_LEGADO].sort());

      // Una segunda ejecución no hace nada
      const otra = await aplicarMigracionesCatalogo(bd);
      expect(otra.claves.aplicada).toBe(false);
      expect(otra.legado.aplicada).toBe(false);
    } finally {
      await bd.end();
    }
  });
});

describe('Migración de la caducidad de contraseñas (contrasena_cambiada_en)', () => {
  it('los usuarios que ya existían quedan con la fecha de la migración (nadie caduca de golpe) y repetirla no la mueve', async () => {
    await recrearBasePrueba();
    const bd = conectarseABasePrueba();

    try {
      await bd.query(ESQUEMA_PREVIO); // usuarios sin la columna
      await bd.query(`INSERT INTO barberos (id, nombre) VALUES (1, 'Barbero Previo')`);
      await bd.query(
        `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id) VALUES ('barbero_previo', 'hash', 'barbero', 1), ('admin_previo', 'hash', 'admin', NULL)`
      );

      const antes = Date.now();
      await bd.query(schemaCompleto);
      const { rows } = await bd.query('SELECT usuario, contrasena_cambiada_en FROM usuarios ORDER BY id');

      expect(rows).toHaveLength(2);
      for (const fila of rows) {
        const marca = fila.contrasena_cambiada_en.getTime();
        expect(marca).toBeGreaterThanOrEqual(antes - 5000);
        expect(marca).toBeLessThanOrEqual(Date.now() + 5000);
        expect(estadoContrasena(fila.contrasena_cambiada_en)).toMatchObject({ estado: 'vigente', dias_restantes: 60 });
      }

      await bd.query(schemaCompleto); // arranque siguiente: idempotente, no toca la fecha
      const { rows: despues } = await bd.query('SELECT contrasena_cambiada_en FROM usuarios ORDER BY id');
      expect(despues.map((f) => f.contrasena_cambiada_en.getTime())).toEqual(rows.map((f) => f.contrasena_cambiada_en.getTime()));
    } finally {
      await bd.end();
    }
  });
});
