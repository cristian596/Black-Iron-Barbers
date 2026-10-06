// Perfil del dashboard: nombre y foto que solo existen dentro del panel (usuarios.nombre_perfil / foto_perfil).
// NUNCA toca barberos.nombre ni barberos.foto: la web pública, la reserva y /admin/empleados siguen leyendo lo de siempre.
// Si el perfil está vacío se usa el valor público (barbero) o el usuario (admin). Los cambios de un barbero se
// registran en cambios_perfil (solo cuando el valor efectivo cambia de verdad) para avisar al admin; el admin no registra.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { pool } from '../db/connection.js';
import {
  MAX_FOTO_BYTES,
  PATRON_ARCHIVO_FOTO,
  TIPOS_FOTO,
  carpetaFotos,
  detectarFormatoFoto,
  validarNombrePerfil,
} from '../utils/perfil.js';

const fallo = (res, estado, codigo, error, extra = {}) => res.status(estado).json({ error, codigo, ...extra });
const esObjetoPlano = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);

export const RUTA_FOTO = '/api/perfil/foto';

const nombreEfectivo = (u) => u.nombre_perfil ?? (u.rol === 'barbero' ? (u.barbero_nombre ?? u.usuario) : u.usuario);
const fotoEfectiva = (u) => u.foto_perfil ?? (u.rol === 'barbero' ? (u.barbero_foto ?? null) : null);

// foto_url: ruta de la foto subida (del back-end) o la pública del barbero (del front, p. ej. /Barberos/x.jpg).
// foto_propia permite al front distinguirlas: solo la propia se pide al back-end.
const respuestaPerfil = (u) => ({
  usuario: u.usuario,
  rol: u.rol,
  nombre: nombreEfectivo(u),
  foto_url: u.foto_perfil ? `${RUTA_FOTO}/${u.foto_perfil}` : fotoEfectiva(u),
  foto_propia: Boolean(u.foto_perfil),
  nombre_perfil: u.nombre_perfil,
  usa_nombre_publico: u.nombre_perfil === null,
  usa_foto_publica: u.foto_perfil === null,
});

const borrarArchivo = async (archivo) => {
  if (!archivo || !PATRON_ARCHIVO_FOTO.test(archivo)) return false;
  try {
    await fs.unlink(path.join(carpetaFotos(), archivo));
    return true;
  } catch {
    return false; // ya no existía: nada que limpiar
  }
};
export const borrarArchivosFoto = async (archivos) => {
  const resultados = await Promise.all(archivos.map(borrarArchivo));
  return resultados.filter(Boolean).length;
};

// Dentro de una transacción se bloquea la fila del usuario (FOR UPDATE) para que dos cambios simultáneos se
// serialicen y cada uno vea el valor anterior real.
const CONSULTA_ACTUAL = `SELECT u.id, u.usuario, u.rol, u.barbero_id, u.nombre_perfil, u.foto_perfil,
                                b.nombre AS barbero_nombre, b.foto AS barbero_foto
                         FROM usuarios u LEFT JOIN barberos b ON b.id = u.barbero_id
                         WHERE u.id = $1 FOR UPDATE OF u`;

const registrarCambio = (cliente, actual, campo, anterior, nuevo) =>
  cliente.query(
    'INSERT INTO cambios_perfil (usuario_id, barbero_id, campo, valor_anterior, valor_nuevo) VALUES ($1, $2, $3, $4, $5)',
    [actual.id, actual.barbero_id, campo, anterior, nuevo]
  );

// Solo registra si el rol es barbero (con barbero ligado) y el valor efectivo cambió.
const debeRegistrar = (actual, antes, despues) => actual.rol === 'barbero' && actual.barbero_id !== null && antes !== despues;

// GET /api/perfil
export const obtenerPerfil = (req, res) => {
  res.json(respuestaPerfil(req.usuario));
};

// PATCH /api/perfil  { nombre_perfil: string | null }
export const actualizarPerfil = async (req, res, next) => {
  const cuerpo = req.body ?? {};
  if (!esObjetoPlano(cuerpo) || !('nombre_perfil' in cuerpo) || Object.keys(cuerpo).length !== 1) {
    return fallo(res, 400, 'DATOS_INVALIDOS', 'Solo se admite el campo nombre_perfil', { campo: 'nombre_perfil' });
  }

  let nuevo = null; // null = "usar mi nombre público"
  if (cuerpo.nombre_perfil !== null) {
    const resultado = validarNombrePerfil(cuerpo.nombre_perfil);
    if (!('valor' in resultado)) return fallo(res, 400, 'DATOS_INVALIDOS', resultado.mensaje, { campo: 'nombre_perfil' });
    nuevo = resultado.valor;
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(CONSULTA_ACTUAL, [req.usuario.id]);
    const actual = rows[0];
    const antes = nombreEfectivo(actual);
    const despues = nombreEfectivo({ ...actual, nombre_perfil: nuevo });

    await cliente.query('UPDATE usuarios SET nombre_perfil = $1 WHERE id = $2', [nuevo, actual.id]);
    if (debeRegistrar(actual, antes, despues)) await registrarCambio(cliente, actual, 'nombre', antes, despues);
    await cliente.query('COMMIT');
    res.json(respuestaPerfil({ ...actual, nombre_perfil: nuevo }));
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    cliente.release();
  }
};

// Lee el cuerpo crudo (la imagen) SOLO en la ruta de la foto: el resto de la API sigue con express.json. Acepta
// cualquier Content-Type a propósito: el formato lo decide la firma de los bytes, no lo que diga el cliente.
const leerCuerpoCrudo = express.raw({ type: () => true, limit: MAX_FOTO_BYTES });
export const leerFoto = (req, res, next) => {
  leerCuerpoCrudo(req, res, (err) => {
    if (!err) return next();
    if (err.type === 'entity.too.large') {
      return fallo(res, 413, 'ARCHIVO_DEMASIADO_GRANDE', 'La foto no puede superar 2 MB', { maximo_bytes: MAX_FOTO_BYTES });
    }
    return next(err);
  });
};

// POST /api/perfil/foto  (cuerpo = bytes de la imagen JPEG, PNG o WebP; máx. 2 MB)
export const subirFoto = async (req, res, next) => {
  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    return fallo(res, 400, 'ARCHIVO_VACIO', 'No se recibió ninguna imagen');
  }
  const formato = detectarFormatoFoto(bytes);
  if (!formato) {
    return fallo(res, 415, 'FORMATO_NO_PERMITIDO', 'Solo se admiten imágenes JPEG, PNG o WebP');
  }

  const archivo = `${crypto.randomUUID()}.${formato}`;
  const ruta = path.join(carpetaFotos(), archivo);
  let escrito = false;

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(CONSULTA_ACTUAL, [req.usuario.id]);
    const actual = rows[0];
    const antes = fotoEfectiva(actual);

    await fs.mkdir(carpetaFotos(), { recursive: true });
    await fs.writeFile(ruta, bytes, { flag: 'wx' });
    escrito = true;

    await cliente.query('UPDATE usuarios SET foto_perfil = $1 WHERE id = $2', [archivo, actual.id]);
    if (debeRegistrar(actual, antes, archivo)) await registrarCambio(cliente, actual, 'foto', antes, archivo);
    await cliente.query('COMMIT');

    // Solo tras el UPDATE correcto se borra la foto anterior.
    await borrarArchivo(actual.foto_perfil);
    res.status(201).json(respuestaPerfil({ ...actual, foto_perfil: archivo }));
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    if (escrito) await fs.unlink(ruta).catch(() => {}); // si algo falló, no queda el archivo recién escrito
    next(err);
  } finally {
    cliente.release();
  }
};

// DELETE /api/perfil/foto → vuelve a la foto pública (o a las iniciales). Idempotente.
export const quitarFoto = async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(CONSULTA_ACTUAL, [req.usuario.id]);
    const actual = rows[0];

    if (actual.foto_perfil !== null) {
      const antes = fotoEfectiva(actual);
      const despues = fotoEfectiva({ ...actual, foto_perfil: null });
      await cliente.query('UPDATE usuarios SET foto_perfil = NULL WHERE id = $1', [actual.id]);
      if (debeRegistrar(actual, antes, despues)) await registrarCambio(cliente, actual, 'foto', antes, despues);
    }
    await cliente.query('COMMIT');

    await borrarArchivo(actual.foto_perfil);
    res.json(respuestaPerfil({ ...actual, foto_perfil: null }));
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    cliente.release();
  }
};

// GET /api/perfil/foto/:archivo (público: un <img> no manda Authorization; el nombre es un UUID no adivinable).
// El nombre se valida con una lista blanca estricta, así que no hay forma de salir de la carpeta (../, %2e%2e, \).
export const servirFoto = async (req, res, next) => {
  const { archivo } = req.params;
  if (!PATRON_ARCHIVO_FOTO.test(archivo)) return fallo(res, 404, 'FOTO_NO_ENCONTRADA', 'Foto no encontrada');

  try {
    const contenido = await fs.readFile(path.join(carpetaFotos(), archivo));
    res.set({
      'Content-Type': TIPOS_FOTO[archivo.split('.').pop()],
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'public, max-age=31536000, immutable', // el nombre cambia con cada foto nueva
    });
    res.send(contenido);
  } catch (err) {
    if (err.code === 'ENOENT') return fallo(res, 404, 'FOTO_NO_ENCONTRADA', 'Foto no encontrada');
    next(err);
  }
};
