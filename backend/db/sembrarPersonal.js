import { AREA_BARBERIA } from '../utils/areas.js';

// Personal que se siembra en instalaciones nuevas. `area` ('barberia' por defecto | 'asesoria'): quien atiende
// asesorías no corta ni aparece en la reserva de cortes. Se usa solo al INSERTAR: en una base existente el seed no
// toca el área; la migración única personal-area-asesoria-v1 (migracionesCatalogo.js) marca a Camila.
export const BARBEROS = [
  { nombre: 'Boby', cargo: 'Barbero Senior', especialidad: 'Fade y Barba', foto: '/Barberos/boby.jpg' },
  { nombre: 'Dani', cargo: 'Barbero Profesional', especialidad: 'Fade y Barba', foto: '/Barberos/dani.jpg' },
  { nombre: 'Danny', cargo: 'Barbero Profesional', especialidad: 'Estilo Clasico', foto: '/Barberos/danny.jpg' },
  { nombre: 'Davinson', cargo: 'Barbero Profesional', especialidad: 'Estilo Urbano', foto: '/Barberos/davinson.jpg' },
  { nombre: 'Leo', cargo: 'Barbero Profesional', especialidad: 'Barba y Estilo clasico', foto: '/Barberos/leo.jpg' },
  { nombre: 'Lizeth', cargo: 'Barbero Profesional', especialidad: 'Estilo Urbano y Clasico', foto: '/Barberos/lizeth.jpg' },
  { nombre: 'Manuel', cargo: 'Barbero Profesional', especialidad: 'Estilista Premium', foto: '/Barberos/manuel.jpg' },
  { nombre: 'Moscu', cargo: 'Barbero Profesional', especialidad: 'Estilista de Barbas', foto: '/Barberos/moscu.jpg' },
  { nombre: 'Rafa', cargo: 'Barbero Profesional', especialidad: 'Estilista Premium', foto: '/Barberos/rafa.jpg' },
  { nombre: 'Camilo', cargo: 'Barbero Profesional', especialidad: 'Corte clasico', foto: '/Barberos/camilo.jpg' },
  { nombre: 'Camila', cargo: 'Asesora de Imagen', especialidad: 'Asesoria', foto: '/Asesores/camila_asesora.jpg', area: 'asesoria' },
];

// Solo inserta lo que falta (por nombre); nunca modifica a nadie. Devuelve cuántos insertó.
export const sembrarPersonal = async (pool, personal = BARBEROS) => {
  let insertados = 0;
  for (const barbero of personal) {
    const { rowCount } = await pool.query(
      `INSERT INTO barberos (nombre, cargo, especialidad, foto, area)
       SELECT $1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::varchar
       WHERE NOT EXISTS (SELECT 1 FROM barberos WHERE nombre = $1::varchar)`,
      [barbero.nombre, barbero.cargo, barbero.especialidad, barbero.foto, barbero.area ?? AREA_BARBERIA]
    );
    insertados += rowCount;
  }
  return insertados;
};
