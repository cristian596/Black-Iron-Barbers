// Verificación del correo con código de 6 dígitos (ver «Verificación de correo» en CLAUDE.md).
//
// Flujo: solicitar (se envía un código por correo) → confirmar (el código correcto da un COMPROBANTE firmado de un solo
// uso) → POST /api/citas con ese comprobante, que se consume dentro de la misma transacción que crea la cita.
//
// Reglas de seguridad:
//  - El código se genera con crypto.randomInt (CSPRNG) y en la base SOLO se guarda su HMAC-SHA256 (con el correo dentro
//    del mensaje, para que un hash no sirva para otro correo). Nunca se registra el código ni el comprobante.
//  - Los intentos se cuentan con un UPDATE atómico ANTES de comparar: intentos paralelos no burlan el máximo de 5.
//  - La comparación es en tiempo constante (timingSafeEqual) y todo error de confirmación es el mismo CODIGO_INVALIDO.
//  - El comprobante es un JWT HS256 firmado con EMAIL_VERIF_SECRET (distinto del JWT_SECRET del login) con typ, aud,
//    iss, correo exacto, jti, iat y exp (30 min). Se verifica con el algoritmo fijado, así que ni alg:none ni un token
//    de login valen. No hay ningún modo de saltarse la verificación en este módulo.
//  - Los límites por correo viven en la base (creado_en), no en memoria: no se reinician con el servidor.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../db/connection.js';
import { leerSecretoVerificacion } from '../config/verificacion.js';
import { enviarCodigoVerificacion } from './notificaciones.js';
import { enmascararCorreo } from './plantillasCorreo.js';

export const VIGENCIA_CODIGO_MIN = 10;
export const ESPERA_ENTRE_SOLICITUDES_SEG = 60;
export const MAX_CODIGOS_POR_HORA = 5;
export const MAX_INTENTOS = 5;
export const VIGENCIA_COMPROBANTE_SEG = 30 * 60;

const TIPO_COMPROBANTE = 'email-verify';
const AUDIENCIA = 'black-iron-barbers:verificacion-correo';
const EMISOR = 'black-iron-barbers';
const LARGO_MAX_COMPROBANTE = 2048;
const UN_DIA_MS = 24 * 60 * 60 * 1000;
const UNA_HORA_MS = 60 * 60 * 1000;

// Reloj inyectable para las pruebas (vencimientos sin dormir).
const porDefecto = { ahora: () => new Date() };
const dependencias = { ...porDefecto };
export const configurarVerificacion = (cambios) => Object.assign(dependencias, cambios);
export const restablecerVerificacion = () => Object.assign(dependencias, porDefecto);

const secreto = () => {
  const valor = leerSecretoVerificacion();
  if (!valor) throw new Error('Falta EMAIL_VERIF_SECRET');
  return valor;
};

const claveDeCodigo = () => crypto.createHmac('sha256', secreto()).update('black-iron:codigo-verificacion').digest();

export const hashCodigo = (correo, codigo) =>
  crypto.createHmac('sha256', claveDeCodigo()).update(`${correo}\n${codigo}`).digest('hex');

const iguales = (hexA, hexB) => {
  const a = Buffer.from(hexA, 'hex');
  const b = Buffer.from(hexB, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// ---------- Comprobante ----------

export const firmarComprobante = (correo) => {
  const iat = Math.floor(dependencias.ahora().getTime() / 1000);
  const jti = crypto.randomUUID();
  const token = jwt.sign({ typ: TIPO_COMPROBANTE, correo, jti, iat, exp: iat + VIGENCIA_COMPROBANTE_SEG }, secreto(), {
    algorithm: 'HS256',
    audience: AUDIENCIA,
    issuer: EMISOR,
  });
  return { token, jti, expira_en_seg: VIGENCIA_COMPROBANTE_SEG };
};

// { ok: true, correo, jti } o { ok: false, codigo: 'VERIFICACION_INVALIDA' | 'VERIFICACION_EXPIRADA' }.
export const leerComprobante = (token) => {
  if (typeof token !== 'string' || token.length === 0 || token.length > LARGO_MAX_COMPROBANTE) {
    return { ok: false, codigo: 'VERIFICACION_INVALIDA' };
  }
  try {
    const datos = jwt.verify(token, secreto(), {
      algorithms: ['HS256'],
      audience: AUDIENCIA,
      issuer: EMISOR,
      clockTimestamp: Math.floor(dependencias.ahora().getTime() / 1000),
    });
    if (datos.typ !== TIPO_COMPROBANTE || typeof datos.correo !== 'string' || typeof datos.jti !== 'string' || !datos.jti) {
      return { ok: false, codigo: 'VERIFICACION_INVALIDA' };
    }
    return { ok: true, correo: datos.correo, jti: datos.jti };
  } catch (err) {
    return { ok: false, codigo: err?.name === 'TokenExpiredError' ? 'VERIFICACION_EXPIRADA' : 'VERIFICACION_INVALIDA' };
  }
};

export const comprobanteYaUsado = async (jti) => {
  const { rowCount } = await pool.query('SELECT 1 FROM verificaciones_usadas WHERE jti = $1', [jti]);
  return rowCount > 0;
};

// Consume el comprobante DENTRO de la transacción que crea la reserva (`conexion` ya tiene BEGIN). Si el jti ya se usó
// (incluida una reserva paralela con el mismo comprobante) el INSERT lanza 23505 sobre verificaciones_usadas_jti_key.
export const consumirComprobante = (conexion, { jti, correo }) =>
  conexion.query('INSERT INTO verificaciones_usadas (jti, correo, usado_en) VALUES ($1, $2, $3)', [
    jti,
    correo,
    dependencias.ahora(),
  ]);

export const esComprobanteYaUsado = (err) => err?.code === '23505' && err.constraint === 'verificaciones_usadas_jti_key';

// ---------- Solicitar ----------

const segundosHasta = (instante, ahora) => Math.max(1, Math.ceil((instante.getTime() - ahora.getTime()) / 1000));

// Devuelve { ok: true } | { ok: false, motivo: 'ESPERA_REQUERIDA' | 'LIMITE_CODIGOS_HORA', reintentarEnSeg } |
// { ok: false, motivo: 'CORREO_NO_DISPONIBLE' }. `correo` ya viene validado y normalizado.
export const solicitarCodigo = async (correo) => {
  const ahora = dependencias.ahora();
  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const hash = hashCodigo(correo, codigo);

  const conexion = await pool.connect();
  let fallaRollback = false;
  let idNuevo;
  try {
    await conexion.query('BEGIN');
    // Serializa las solicitudes de ESTE correo: los límites no se burlan con peticiones paralelas.
    await conexion.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`verificacion:${correo}`]);

    const { rows: recientes } = await conexion.query(
      'SELECT creado_en FROM verificaciones_correo WHERE correo = $1 AND creado_en > $2 ORDER BY creado_en DESC',
      [correo, new Date(ahora.getTime() - UNA_HORA_MS)]
    );
    if (recientes.length > 0) {
      const finEspera = new Date(recientes[0].creado_en.getTime() + ESPERA_ENTRE_SOLICITUDES_SEG * 1000);
      if (finEspera > ahora) {
        await conexion.query('ROLLBACK');
        return { ok: false, motivo: 'ESPERA_REQUERIDA', reintentarEnSeg: segundosHasta(finEspera, ahora) };
      }
    }
    if (recientes.length >= MAX_CODIGOS_POR_HORA) {
      const libera = new Date(recientes[MAX_CODIGOS_POR_HORA - 1].creado_en.getTime() + UNA_HORA_MS);
      await conexion.query('ROLLBACK');
      return { ok: false, motivo: 'LIMITE_CODIGOS_HORA', reintentarEnSeg: segundosHasta(libera, ahora) };
    }

    // Un código nuevo invalida cualquier código activo anterior de este correo.
    await conexion.query(
      'UPDATE verificaciones_correo SET invalidado_en = $2 WHERE correo = $1 AND usado_en IS NULL AND invalidado_en IS NULL',
      [correo, ahora]
    );
    const { rows } = await conexion.query(
      `INSERT INTO verificaciones_correo (correo, codigo_hash, expira_en, creado_en) VALUES ($1, $2, $3, $4) RETURNING id`,
      [correo, hash, new Date(ahora.getTime() + VIGENCIA_CODIGO_MIN * 60_000), ahora]
    );
    idNuevo = rows[0].id;

    // Borrado perezoso de lo vencido hace más de un día.
    const limite = new Date(ahora.getTime() - UN_DIA_MS);
    await conexion.query('DELETE FROM verificaciones_correo WHERE expira_en < $1', [limite]);
    await conexion.query('DELETE FROM verificaciones_usadas WHERE usado_en < $1', [limite]);
    await conexion.query('COMMIT');
  } catch (err) {
    try {
      await conexion.query('ROLLBACK');
    } catch {
      fallaRollback = true;
    }
    throw err;
  } finally {
    conexion.release(fallaRollback || undefined);
  }

  const enviado = await enviarCodigoVerificacion(correo, codigo, VIGENCIA_CODIGO_MIN);
  if (!enviado) {
    // No se entregó: el código no existe para nadie y no gasta cupo del correo.
    await pool.query('DELETE FROM verificaciones_correo WHERE id = $1', [idNuevo]).catch(() => {});
    console.warn(`[verificacion] No se pudo enviar el código a ${enmascararCorreo(correo)}`);
    return { ok: false, motivo: 'CORREO_NO_DISPONIBLE' };
  }
  return { ok: true };
};

// ---------- Confirmar ----------

const HASH_NULO = '0'.repeat(64);

// Devuelve { ok: true, token, expira_en_seg } o { ok: false } (siempre el mismo error para el cliente).
export const confirmarCodigo = async (correo, codigo) => {
  const ahora = dependencias.ahora();
  // Paso atómico: cuenta el intento sobre el código activo más reciente SOLO si aún le quedan intentos. El UPDATE
  // vuelve a comprobar el WHERE tras esperar un bloqueo, así que diez intentos paralelos no pasan de MAX_INTENTOS.
  const { rows } = await pool.query(
    `UPDATE verificaciones_correo SET intentos = intentos + 1
     WHERE id = (SELECT id FROM verificaciones_correo
                 WHERE correo = $1 AND usado_en IS NULL AND invalidado_en IS NULL AND expira_en > $2
                 ORDER BY creado_en DESC LIMIT 1)
       AND correo = $1 AND usado_en IS NULL AND invalidado_en IS NULL AND expira_en > $2 AND intentos < $3
     RETURNING id, codigo_hash`,
    [correo, ahora, MAX_INTENTOS]
  );
  const fila = rows[0];
  // Se calcula el HMAC y se compara aunque no haya fila: el trabajo (y el tiempo) es el mismo en todos los errores.
  const coincide = iguales(hashCodigo(correo, codigo), fila ? fila.codigo_hash : HASH_NULO) && Boolean(fila);
  if (!coincide) return { ok: false };

  // Una sola confirmación gana aunque lleguen dos con el código correcto a la vez.
  const { rowCount } = await pool.query(
    'UPDATE verificaciones_correo SET usado_en = $2 WHERE id = $1 AND usado_en IS NULL AND invalidado_en IS NULL',
    [fila.id, ahora]
  );
  if (rowCount !== 1) return { ok: false };

  const { token, expira_en_seg: expiraEnSeg } = firmarComprobante(correo);
  return { ok: true, token, expira_en_seg: expiraEnSeg };
};
