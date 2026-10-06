// Reglas del perfil del dashboard (nombre y foto). Todo lo que decide qué se acepta vive aquí.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MIN_NOMBRE_PERFIL = 2;
export const MAX_NOMBRE_PERFIL = 40;
export const MAX_FOTO_BYTES = 2 * 1024 * 1024;
export const PATRON_ARCHIVO_FOTO = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const TIPOS_FOTO = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// Carpeta de las fotos subidas, FUERA de public/. Se lee en cada uso para que las pruebas puedan apuntar a una
// carpeta temporal (UPLOADS_DIR) sin tocar la real.
export const carpetaFotos = () => process.env.UPLOADS_DIR || path.resolve(__dirname, '../uploads/perfiles');

// Valida y normaliza el nombre de perfil: texto, recorte, espacios internos colapsados, sin caracteres de control ni
// invisibles (Cc/Cf) y entre 2 y 40 caracteres (puntos de código, igual que cuenta VARCHAR). Devuelve { valor } o { mensaje }.
export const validarNombrePerfil = (entrada) => {
  if (typeof entrada !== 'string') return { mensaje: 'El nombre debe ser texto' };
  const recortado = entrada.normalize('NFC').trim();
  if (/[\p{Cc}\p{Cf}]/u.test(recortado)) return { mensaje: 'El nombre no puede tener caracteres de control ni invisibles' };
  const nombre = recortado.replace(/\s+/g, ' ');
  const largo = [...nombre].length;
  if (largo < MIN_NOMBRE_PERFIL || largo > MAX_NOMBRE_PERFIL) {
    return { mensaje: `El nombre debe tener entre ${MIN_NOMBRE_PERFIL} y ${MAX_NOMBRE_PERFIL} caracteres` };
  }
  return { valor: nombre };
};

// Detecta el formato por los primeros bytes (firma), nunca por Content-Type ni por extensión. Devuelve 'jpg' | 'png' |
// 'webp' o null.
export const detectarFormatoFoto = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && buf.subarray(12, 16).toString('latin1') === 'IHDR') {
    return 'png';
  }
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
};
