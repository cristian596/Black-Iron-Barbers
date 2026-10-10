import { pool } from '../db/connection.js';
import { leerConfigCorreo } from '../config/correo.js';
import { CLAVE_ASESORIA_GRATIS } from './areas.js';
import { obtenerTransporte } from './transporteCorreo.js';
import { construirIcs, secuenciaDeCambio } from './ics.js';
import {
  correoSeguro,
  enmascararCorreo,
  enmascararCorreosEnTexto,
  limpiarLinea,
  eventoDeCita,
  plantillaConfirmacionCliente,
  plantillaCancelacionCliente,
  plantillaCambioCliente,
  plantillaAvisoProfesional,
} from './plantillasCorreo.js';

// Notificaciones por correo de los eventos de una cita.
//
// REGLAS (ver «Correos y notificaciones» en CLAUDE.md):
//  - Se llaman DESPUÉS del COMMIT, sin await desde el controlador: el envío no retrasa ni cambia la respuesta HTTP.
//  - Nunca lanzan hacia afuera: un fallo (SMTP caído, dato raro) se registra con el correo enmascarado y se sigue.
//  - Con EMAIL_ENABLED=false, o sin correo válido, no se envía nada y no es un error.
//  - Eventos: cita creada (cliente: UN correo aunque la reserva sea combinada; cada profesional: un aviso), cita cancelada
//    (cliente y profesional) y cambio de profesional (cliente, el anterior y el nuevo). Completar NO notifica; el admin
//    tampoco recibe correos. No existe cambio de fecha/hora en el sistema, así que no hay evento para eso.
//  - Las citas que inserta sembrarDemo.js directo en la base no pasan por aquí (hay una prueba que lo garantiza).

const dependencias = {
  // Correo de un profesional. Hoy NO existe ese dato en el sistema (barberos/usuarios no tienen correo), así que devuelve
  // null y los avisos a profesionales se omiten sin error. Cuando exista una columna, se conecta aquí.
  resolverCorreoProfesional: async () => null,
  ahora: () => new Date(),
};

// Para pruebas: sustituye dependencias concretas. restablecerNotificaciones() las devuelve a su valor normal.
const porDefecto = { ...dependencias };
export const configurarNotificaciones = (cambios) => Object.assign(dependencias, cambios);
export const restablecerNotificaciones = () => Object.assign(dependencias, porDefecto);

// ---------- Seguimiento de envíos pendientes (las pruebas esperan de forma determinista) ----------

const pendientes = new Set();

const lanzar = (tarea) => {
  const promesa = tarea();
  pendientes.add(promesa);
  const quitar = () => pendientes.delete(promesa);
  promesa.then(quitar, quitar);
  return promesa;
};

// Espera a que terminen los envíos en curso. Rechaza si alguno falló sin controlar (no debería ocurrir nunca).
export const esperarNotificaciones = async () => {
  while (pendientes.size > 0) {
    await Promise.all([...pendientes]);
  }
};

const registrar = (mensaje) => console.warn(`[correo] ${mensaje}`);

// ---------- Envío ----------

// Único punto que habla con el transporte. No lanza: devuelve true si se entregó al transporte.
const enviarCorreo = async ({ para, asunto, texto, html, icsAdjunto, config }) => {
  const destinatario = correoSeguro(para);
  if (!destinatario) return false;
  try {
    const transporte = obtenerTransporte();
    if (!transporte) return false;
    await transporte.sendMail({
      from: limpiarLinea(config.from),
      to: destinatario,
      subject: limpiarLinea(asunto),
      text: texto,
      html,
      ...(icsAdjunto
        ? {
            attachments: [
              {
                filename: icsAdjunto.nombre,
                content: icsAdjunto.contenido,
                contentType: `text/calendar; charset=utf-8; method=${icsAdjunto.metodo}`,
              },
            ],
          }
        : {}),
    });
    return true;
  } catch (err) {
    registrar(`No se pudo enviar a ${enmascararCorreo(destinatario)}: ${enmascararCorreosEnTexto(err?.message)}`);
    return false;
  }
};

const configActiva = () => {
  try {
    const config = leerConfigCorreo();
    return config.habilitado ? config : null;
  } catch (err) {
    registrar(`Configuración de correo inválida, no se envía nada: ${enmascararCorreosEnTexto(err.message)}`);
    return null;
  }
};

// ---------- Datos ----------

// Lee las citas (con fecha/hora como texto de Bogotá, profesional y líneas de servicio) DESPUÉS del commit.
const cargarCitas = async (ids) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.cliente, c.correo, c.fecha::text AS fecha, to_char(c.hora, 'HH24:MI') AS hora,
            c.duracion_min, c.precio, c.estado, c.reserva_id, c.barbero_id,
            b.nombre AS profesional, b.area
     FROM citas c
     JOIN barberos b ON b.id = c.barbero_id
     WHERE c.id = ANY($1::int[])
     ORDER BY c.fecha, c.hora, c.id`,
    [ids]
  );
  const { rows: lineas } = await pool.query(
    `SELECT cs.cita_id, cs.nombre, cs.duracion_min, cs.precio,
            COALESCE(s.clave_seed = $2, false) AS gratis
     FROM cita_servicios cs
     LEFT JOIN servicios s ON s.id = cs.servicio_id
     WHERE cs.cita_id = ANY($1::int[])
     ORDER BY cs.cita_id, cs.orden`,
    [ids, CLAVE_ASESORIA_GRATIS]
  );
  return rows.map((fila) => ({
    ...fila,
    servicios: lineas.filter((linea) => linea.cita_id === fila.id).map(({ nombre, duracion_min, precio, gratis }) => ({ nombre, duracion_min, precio, gratis })),
  }));
};

const nombreDeProfesional = async (barberoId) => {
  const { rows } = await pool.query('SELECT nombre FROM barberos WHERE id = $1', [barberoId]);
  return rows[0]?.nombre ?? 'otro profesional';
};

const correoDeProfesional = async (barberoId) => {
  try {
    return correoSeguro(await dependencias.resolverCorreoProfesional(barberoId));
  } catch {
    return null;
  }
};

const icsDe = (citas, metodo, secuencia) => ({
  nombre: citas.length > 1 ? 'citas.ics' : 'cita.ics',
  metodo,
  contenido: construirIcs(citas.map(eventoDeCita), { metodo, secuencia, ahora: dependencias.ahora() }),
});

const avisarProfesional = async (cita, barberoId, tipo, config) => {
  const para = await correoDeProfesional(barberoId);
  if (!para) return;
  const { asunto, texto, html } = plantillaAvisoProfesional(cita, tipo);
  await enviarCorreo({ para, asunto, texto, html, config });
};

// Ejecuta una tarea de notificación sin dejar que nada se escape (ni un fallo de la base de datos).
const protegida = (descripcion, tarea) =>
  lanzar(async () => {
    const config = configActiva();
    if (!config) return;
    try {
      await tarea(config);
    } catch (err) {
      registrar(`Falló la notificación (${descripcion}): ${enmascararCorreosEnTexto(err?.message)}`);
    }
  });

// ---------- Eventos ----------

// Cita(s) recién creada(s) (ya con COMMIT): ids de la reserva (una, o las dos de una combinada).
export const notificarCitasCreadas = (ids) =>
  protegida('cita creada', async (config) => {
    const citas = await cargarCitas(ids);
    if (citas.length === 0) return;

    const { asunto, texto, html } = plantillaConfirmacionCliente(citas);
    await enviarCorreo({ para: citas[0].correo, asunto, texto, html, icsAdjunto: icsDe(citas, 'PUBLISH', 0), config });

    for (const cita of citas) {
      await avisarProfesional(cita, cita.barbero_id, 'nueva', config);
    }
  });

// Cita cancelada (ya con COMMIT). Hoy solo la cancela el profesional a cargo.
export const notificarCancelacion = (citaId) =>
  protegida('cita cancelada', async (config) => {
    const [cita] = await cargarCitas([citaId]);
    if (!cita) return;

    const { asunto, texto, html } = plantillaCancelacionCliente(cita);
    await enviarCorreo({
      para: cita.correo,
      asunto,
      texto,
      html,
      icsAdjunto: icsDe([cita], 'CANCEL', secuenciaDeCambio(dependencias.ahora())),
      config,
    });
    await avisarProfesional(cita, cita.barbero_id, 'cancelada', config);
  });

// El admin reasignó la cita a otro profesional (ya con COMMIT).
export const notificarCambioProfesional = (citaId, profesionalAnteriorId) =>
  protegida('cambio de profesional', async (config) => {
    const [cita] = await cargarCitas([citaId]);
    if (!cita) return;
    const anterior = await nombreDeProfesional(profesionalAnteriorId);

    const { asunto, texto, html } = plantillaCambioCliente(cita, anterior);
    await enviarCorreo({
      para: cita.correo,
      asunto,
      texto,
      html,
      icsAdjunto: icsDe([cita], 'PUBLISH', secuenciaDeCambio(dependencias.ahora())),
      config,
    });
    await avisarProfesional(cita, profesionalAnteriorId, 'quitada', config);
    await avisarProfesional(cita, cita.barbero_id, 'nueva', config);
  });
