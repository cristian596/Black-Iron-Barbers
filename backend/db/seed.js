import bcrypt from 'bcryptjs';
import { pool } from './connection.js';
import { env } from '../config/env.js';
import { sembrarCatalogo } from './sembrarCatalogo.js';

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
  const { categorias, servicios, desactivados } = await sembrarCatalogo(pool);
  await seedAdmin();
  console.log(
    `✅ Seed completado: barberos y admin verificados; ${categorias} categorías y ${servicios} servicios actualizados` +
      ` (${desactivados} servicios del catálogo anterior desactivados).`
  );
  await pool.end();
};

seed().catch((err) => {
  console.error('❌ Error al ejecutar el seed:', err.message);
  process.exit(1);
});
