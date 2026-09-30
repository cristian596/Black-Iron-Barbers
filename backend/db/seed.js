import bcrypt from 'bcryptjs';
import { pool } from './connection.js';
import { env } from '../config/env.js';

const BARBEROS = [
  { nombre: 'Boby', cargo: 'Barbero Senior', especialidad: 'Fade y Barba', foto: '/Barberos/boby.jpg' },
  { nombre: 'Dani', cargo: 'Barbero Profesional', especialidad: 'Fade y Barba', foto: '/Barberos/dani.jpg' },
  { nombre: 'Danny', cargo: 'Barbero Profesional', especialidad: 'Estilo Clasico', foto: '/Barberos/danny.jpg' },
  { nombre: 'Davinson', cargo: 'Barbero Profesional', especialidad: 'Estilo Urbano', foto: '/Barberos/davinson.jpg' },
  { nombre: 'Leo', cargo: 'Barbero Profesional', especialidad: 'Barba y Estilo clasico', foto: '/Barberos/leo.jpg' },
  { nombre: 'Lizeth', cargo: 'Barbero Profesional', especialidad: 'Estilo Urbano y Clasico', foto: '/Barberos/lizeth.jpg' },
  { nombre: 'Manuel', cargo: 'Barbero Profesional', especialidad: 'Estilista Premium', foto: '/Barberos/manuel.jpg' },
  { nombre: 'Moscu', cargo: 'Barbero Profesional', especialidad: 'Estilista de Barbas', foto: '/Barberos/moscu.jpg' },
  { nombre: 'Rafa', cargo: 'Barbero Profesional', especialidad: 'Estilista Premium', foto: '/Barberos/rafa.jpg' },
];

// Nombres tomados de src/data/serviciosMale.js; precio y duración de
// src/data/servicios.js (categorías "Servicio de Barba", "Cortes" y "Cejas").
const SERVICIOS = [
  { nombre: 'Corte de Cabello', duracion_min: 35, precio: 55000 },
  { nombre: 'Corte de Barba', duracion_min: 45, precio: 48000 },
  { nombre: 'Combo (Pelo + Barba)', duracion_min: 90, precio: 103000 },
  { nombre: 'Perfilado de Cejas', duracion_min: 15, precio: 25000 },
  { nombre: 'Exfoliación Facial', duracion_min: 45, precio: 42000 },
  { nombre: 'Tintura / Color', duracion_min: 30, precio: 58000 },
];

const seedBarberos = async () => {
  for (const barbero of BARBEROS) {
    await pool.query(
      `INSERT INTO barberos (nombre, cargo, especialidad, foto)
       SELECT $1::varchar, $2::varchar, $3::varchar, $4::varchar
       WHERE NOT EXISTS (SELECT 1 FROM barberos WHERE nombre = $1::varchar)`,
      [barbero.nombre, barbero.cargo, barbero.especialidad, barbero.foto]
    );
  }
};

const seedServicios = async () => {
  for (const servicio of SERVICIOS) {
    await pool.query(
      `INSERT INTO servicios (nombre, duracion_min, precio)
       SELECT $1::varchar, $2::int, $3::int
       WHERE NOT EXISTS (SELECT 1 FROM servicios WHERE nombre = $1::varchar)`,
      [servicio.nombre, servicio.duracion_min, servicio.precio]
    );
  }
};

const seedAdmin = async () => {
  const hash = await bcrypt.hash(env.adminPassword, 10);
  await pool.query(
    `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id)
     SELECT $1::varchar, $2::varchar, 'admin', NULL
     WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE usuario = $1::varchar)`,
    [env.adminUser, hash]
  );
};

const seed = async () => {
  await seedBarberos();
  await seedServicios();
  await seedAdmin();
  console.log('✅ Seed completado: barberos, servicios y admin verificados.');
  await pool.end();
};

seed().catch((err) => {
  console.error('❌ Error al ejecutar el seed:', err.message);
  process.exit(1);
});
