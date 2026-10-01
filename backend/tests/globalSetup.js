import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { asegurarBaseDePrueba } from './guardBaseDePrueba.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true, quiet: true });

asegurarBaseDePrueba();

const { Pool } = pg;

export default async function setup() {
  const admin = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: 'postgres',
  });

  try {
    await admin.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
  } catch (err) {
    if (err.code !== '42P04') throw err; // 42P04 = la base ya existe
  } finally {
    await admin.end();
  }

  const testPool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
  });

  const schema = readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf-8');
  await testPool.query(schema);

  // Deja la base de pruebas en un estado conocido antes de cada corrida.
  await testPool.query('TRUNCATE citas, usuarios, servicios, barberos RESTART IDENTITY CASCADE');

  await testPool.query(
    `INSERT INTO barberos (id, nombre, cargo, especialidad, foto, activo) VALUES
      (1, 'Barbero Uno', 'Barbero Senior', 'Fade', '/Barberos/uno.jpg', true),
      (2, 'Barbero Dos', 'Barbero Profesional', 'Clasico', '/Barberos/dos.jpg', true)`
  );

  await testPool.query(
    `INSERT INTO servicios (id, nombre, duracion_min, precio) VALUES
      (1, 'Corte de prueba', 30, 50000)`
  );

  const hashAdmin = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  const hashBarbero = await bcrypt.hash('barbero12345', 10);

  await testPool.query(
    `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id, activo) VALUES
      ($1, $2, 'admin', NULL, true),
      ('barbero1_test', $3, 'barbero', 1, true),
      ('barbero2_test', $3, 'barbero', 2, true),
      ('barbero_inactivo', $3, 'barbero', 1, false)`,
    [process.env.ADMIN_USER, hashAdmin, hashBarbero]
  );

  await testPool.end();
}
