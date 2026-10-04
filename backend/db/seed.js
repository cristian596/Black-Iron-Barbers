import bcrypt from 'bcryptjs';
import { pool } from './connection.js';
import { env } from '../config/env.js';
import { sembrarCatalogo, restablecerCatalogo, calcularRestablecimiento } from './sembrarCatalogo.js';

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

const mostrarCambios = ({ cambios, faltantes }) => {
  for (const cambio of cambios) {
    console.log(`  ${cambio.tipo === 'categoria' ? 'Categoría' : 'Servicio'} "${cambio.etiqueta}" (id ${cambio.id}):`);
    for (const c of cambio.campos) console.log(`     ${c.campo}: ${JSON.stringify(c.actual)} → ${JSON.stringify(c.nuevo)}`);
  }
  for (const falta of faltantes) console.log(`  Se insertaría: ${falta}`);
  if (cambios.length === 0 && faltantes.length === 0) console.log('  Nada que sobrescribir: la base ya coincide con el catálogo.');
};

// npm run seed -- --restablecer-catalogo [--confirmar]: vuelve el catálogo a los datos de los archivos
// (precio, descripción, nombre, activo…). SOLO desarrollo; sin --confirmar solo muestra qué sobrescribiría.
const restablecer = async (confirmar) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ --restablecer-catalogo es solo para desarrollo: se niega a correr con NODE_ENV=production.');
    process.exit(1);
  }
  const plan = await calcularRestablecimiento(pool);
  console.log(`Base: ${env.db.database}. Esto sobrescribiría lo editado en el catálogo del seed:`);
  mostrarCambios(plan);
  if (!confirmar) {
    console.log('Simulación: no se cambió nada. Para aplicar, agrega --confirmar.');
    return;
  }
  const { restablecidos, insertados } = await restablecerCatalogo(pool);
  console.log(`✅ Catálogo restablecido: ${restablecidos} filas sobrescritas, ${insertados.servicios.insertados} servicios y ${insertados.categorias.insertadas} categorías insertados.`);
};

const seed = async () => {
  const args = process.argv.slice(2);
  const desconocidos = args.filter((a) => !['--restablecer-catalogo', '--confirmar'].includes(a));
  if (desconocidos.length > 0 || (args.includes('--confirmar') && !args.includes('--restablecer-catalogo'))) {
    console.error('❌ Uso: npm run seed  ·  npm run seed -- --restablecer-catalogo [--confirmar]');
    process.exit(1);
  }

  if (args.includes('--restablecer-catalogo')) {
    await restablecer(args.includes('--confirmar'));
    await pool.end();
    return;
  }

  await seedBarberos();
  const { categorias, servicios, omitidos, migraciones } = await sembrarCatalogo(pool);
  await seedAdmin();
  console.log(
    `✅ Seed completado: barberos y admin verificados; catálogo: ${categorias.insertadas} categorías y ${servicios.insertados} servicios nuevos insertados` +
      ` (${servicios.existentes} servicios ya existían y no se tocaron).`
  );
  if (migraciones.legado.aplicada) {
    console.log(`   Catálogo anterior: ${migraciones.legado.detalle.desactivados} servicios desactivados (paso único, ya registrado).`);
  }
  for (const omitido of omitidos) console.log(`   ⚠️ Omitido: ${omitido}`);
  await pool.end();
};

seed().catch((err) => {
  console.error('❌ Error al ejecutar el seed:', err.message);
  process.exit(1);
});
