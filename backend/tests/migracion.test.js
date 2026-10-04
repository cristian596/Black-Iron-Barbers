import { describe, it, expect, afterAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaCompleto = readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf-8');

const NOMBRE_BD = 'black_iron_migracion_test';

const conexionAdmin = () =>
  new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: 'postgres',
  });

const recrearBasePrueba = async () => {
  const admin = conexionAdmin();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${NOMBRE_BD}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${NOMBRE_BD}"`);
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
    database: NOMBRE_BD,
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

afterAll(async () => {
  const admin = conexionAdmin();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${NOMBRE_BD}" WITH (FORCE)`);
  } finally {
    await admin.end();
  }
});

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
