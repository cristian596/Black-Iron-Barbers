import { pool } from '../db/connection.js';
import { leerConfigCorreo } from '../config/correo.js';
import {
  HORAS_ANTES_POR_DEFECTO,
  MAX_POR_CICLO_POR_DEFECTO,
  MAX_INTENTOS,
  MINUTOS_RECLAMO_VIGENTE,
  MINUTOS_MINIMOS_ANTES,
  leerConfigRecordatorios,
} from '../config/recordatorios.js';
import { DOMINIO_DEMO } from '../db/sembrarDemo.js';
import { validarCorreo } from './validarCorreo.js';
import { obtenerTransporte } from './transporteCorreo.js';
import { cargarCitas } from './notificaciones.js';
import {
  correoSeguro,
  enmascararCorreo,
  enmascararCorreosEnTexto,
  limpiarLinea,
  plantillaRecordatorioCliente,
} from './plantillasCorreo.js';

// Recordatorios por correo ~24 h antes de la cita (solo al cliente). Ver «Recordatorios» en CLAUDE.md.
//
// Elegibilidad (todas deben cumplirse; el inicio es fecha + hora interpretadas en America/Bogotá, nunca la zona del servidor):
//  - estado 'pendiente', recordatorio_enviado_en NULL y recordatorio_intentos < 3 (y sin reclamo vigente de otro ciclo).
//  - ahora >= inicio − RECORDATORIO_HORAS_ANTES h  y  inicio − ahora > 1 h (no se recuerda lo inminente).
//  - la cita se creó con al menos RECORDATORIO_HORAS_ANTES h de anticipación (inicio − creada_en).
//  - correo válido según el validador único; no es una fila de demostración (dominio demo o cliente "[demo] ").
// En una reserva combinada (mismo reserva_id) la ventana se mide contra el inicio de la PRIMERA cita elegible: así las dos
// salen en UN correo y se marcan juntas (si solo una cumple las reglas de estado, va sola).
//
// Reclamo atómico: UNA sentencia UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING marca las citas del ciclo;
// dos ciclos (reinicios, varias instancias) no pueden reclamar la misma cita. enviado_en solo se escribe si el envío tuvo
// éxito; si falla se libera el reclamo y sube recordatorio_intentos. Nada de esto lanza hacia afuera.
//
// creada_en es TIMESTAMP sin zona escrito por DEFAULT NOW() en la zona de la sesión de Postgres; el cast a timestamptz usa
// esa misma zona de sesión, así que el instante es el correcto sin importar cuál sea.

const registrar = (mensaje) => console.warn(`[recordatorios] ${mensaje}`);

const CONDICIONES_DE_ESTADO = `
  c.estado = 'pendiente'
  AND c.recordatorio_enviado_en IS NULL
  AND c.recordatorio_intentos < $6::int
  AND (c.recordatorio_reclamado_en IS NULL OR c.recordatorio_reclamado_en < $1::timestamptz - make_interval(mins => $5::int))`;

// $1 ahora · $2 horas antes · $3 máximo de correos (reservas) por ciclo · $4 dominio demo · $5 min de reclamo vigente
// · $6 máximo de intentos · $7 min mínimos antes del inicio.
const SQL_RECLAMAR = `
  WITH base AS (
    SELECT c.id,
           COALESCE(c.reserva_id::text, 'cita-' || c.id) AS grupo,
           ((c.fecha + c.hora) AT TIME ZONE 'America/Bogota') AS inicio
    FROM citas c
    WHERE ${CONDICIONES_DE_ESTADO}
      AND NOT (lower(c.correo) LIKE ('%@' || $4::text))
      AND c.cliente NOT LIKE '[demo] %'
      AND ((c.fecha + c.hora) AT TIME ZONE 'America/Bogota') - c.creada_en::timestamptz >= make_interval(hours => $2::int)
  ),
  con_grupo AS (
    SELECT id, grupo, MIN(inicio) OVER (PARTITION BY grupo) AS inicio_grupo FROM base
  ),
  ventana AS (
    SELECT id, grupo, inicio_grupo FROM con_grupo
    WHERE inicio_grupo <= $1::timestamptz + make_interval(hours => $2::int)
      AND inicio_grupo >  $1::timestamptz + make_interval(mins => $7::int)
  ),
  elegidas AS (
    SELECT id FROM (SELECT id, dense_rank() OVER (ORDER BY inicio_grupo, grupo) AS puesto FROM ventana) t
    WHERE puesto <= $3::int
  )
  UPDATE citas SET recordatorio_reclamado_en = $1::timestamptz
  WHERE id IN (
    SELECT c.id FROM citas c
    WHERE c.id IN (SELECT id FROM elegidas) AND ${CONDICIONES_DE_ESTADO}
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id`;

const reclamar = async (ahora, horasAntes, maxPorCiclo) => {
  const { rows } = await pool.query(SQL_RECLAMAR, [
    ahora,
    horasAntes,
    maxPorCiclo,
    DOMINIO_DEMO,
    MINUTOS_RECLAMO_VIGENTE,
    MAX_INTENTOS,
    MINUTOS_MINIMOS_ANTES,
  ]);
  return rows.map((fila) => fila.id);
};

// Libera el reclamo; con `fallo` cuenta un intento fallido, con `descartar` deja la cita sin más intentos.
const liberar = async (ids, { fallo = false, descartar = false } = {}) => {
  await pool.query(
    `UPDATE citas SET recordatorio_reclamado_en = NULL,
            recordatorio_intentos = CASE WHEN $3::boolean THEN $4::int WHEN $2::boolean THEN recordatorio_intentos + 1 ELSE recordatorio_intentos END
     WHERE id = ANY($1::int[]) AND recordatorio_enviado_en IS NULL`,
    [ids, fallo, descartar, MAX_INTENTOS]
  );
};

const marcarEnviado = (ids, ahora) =>
  pool.query(
    'UPDATE citas SET recordatorio_enviado_en = $2::timestamptz, recordatorio_reclamado_en = NULL WHERE id = ANY($1::int[])',
    [ids, ahora]
  );

// Reservas (un grupo por reserva_id; las sueltas, de una en una) en orden de inicio.
const agruparPorReserva = (citas) => {
  const grupos = new Map();
  for (const cita of citas) {
    const clave = cita.reserva_id ?? `cita-${cita.id}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(cita);
  }
  return [...grupos.values()];
};

const enviarGrupo = async (citas, { ahora, transporte, from }) => {
  const ids = citas.map((cita) => cita.id);
  const destinatario = correoSeguro(validarCorreo(citas[0].correo));
  if (!destinatario) {
    registrar(`Correo inválido en la(s) cita(s) ${ids.join(', ')}: se descarta el recordatorio.`);
    await liberar(ids, { descartar: true });
    return 'descartado';
  }
  try {
    const { asunto, texto, html } = plantillaRecordatorioCliente(citas, ahora);
    await transporte.sendMail({ from: limpiarLinea(from), to: destinatario, subject: limpiarLinea(asunto), text: texto, html });
  } catch (err) {
    registrar(`No se pudo enviar a ${enmascararCorreo(destinatario)}: ${enmascararCorreosEnTexto(err?.message)}`);
    await liberar(ids, { fallo: true });
    return 'fallido';
  }
  try {
    await marcarEnviado(ids, ahora);
  } catch (err) {
    // El correo ya salió: si no se pudo marcar, el reclamo vence solo y habría un duplicado. Se deja constancia.
    registrar(`Enviado a ${enmascararCorreo(destinatario)} pero no se pudo marcar: ${enmascararCorreosEnTexto(err?.message)}`);
  }
  return 'enviado';
};

// Un ciclo. Reloj y transporte inyectables; no lanza nunca. Devuelve { reclamadas, enviados, fallidos, descartados }.
export const ejecutarCicloRecordatorios = async ({ ahora = new Date(), transporte, horasAntes, maxPorCiclo, from } = {}) => {
  const resultado = { reclamadas: 0, enviados: 0, fallidos: 0, descartados: 0 };
  try {
    const configRecordatorios = leerConfigRecordatorios();
    const horas = horasAntes ?? configRecordatorios.horasAntes ?? HORAS_ANTES_POR_DEFECTO;
    const maximo = maxPorCiclo ?? configRecordatorios.maxPorCiclo ?? MAX_POR_CICLO_POR_DEFECTO;

    let remitente = from;
    if (remitente === undefined) {
      const correo = leerConfigCorreo();
      if (!correo.habilitado) return resultado;
      remitente = correo.from;
    }
    const salida = transporte ?? obtenerTransporte();
    if (!salida) return resultado;

    const ids = await reclamar(ahora, horas, maximo);
    resultado.reclamadas = ids.length;
    if (ids.length === 0) return resultado;

    const citas = await cargarCitas(ids);
    // Una cita que se canceló/completó entre el reclamo y la lectura no se recuerda: se libera sin contar intento.
    const vigentes = citas.filter((cita) => cita.estado === 'pendiente');
    const sobrantes = ids.filter((id) => !vigentes.some((cita) => cita.id === id));
    if (sobrantes.length > 0) await liberar(sobrantes);

    for (const grupo of agruparPorReserva(vigentes)) {
      const estado = await enviarGrupo(grupo, { ahora, transporte: salida, from: remitente });
      if (estado === 'enviado') resultado.enviados += 1;
      else if (estado === 'fallido') resultado.fallidos += 1;
      else resultado.descartados += 1;
    }
    if (resultado.enviados > 0) console.log(`[recordatorios] ${resultado.enviados} recordatorio(s) enviado(s).`);
  } catch (err) {
    registrar(`El ciclo falló: ${enmascararCorreosEnTexto(err?.message)}`);
  }
  return resultado;
};

// Planificador: setInterval con unref (no mantiene vivo el proceso). Corre un ciclo al arrancar (recuperación tardía tras
// una caída) y luego cada `intervaloMin`. Nunca solapa ciclos. Bajo NODE_ENV=test no arranca salvo `forzar: true`.
// `detener()` para el temporizador y espera al ciclo en curso.
export const iniciarPlanificadorRecordatorios = ({ intervaloMin, forzar = false, ...opciones } = {}) => {
  if (process.env.NODE_ENV === 'test' && !forzar) return null;
  let enCurso = null;
  const ejecutarAhora = () => {
    enCurso ??= ejecutarCicloRecordatorios({ ...opciones, ahora: new Date() }).finally(() => {
      enCurso = null;
    });
    return enCurso;
  };
  const temporizador = setInterval(ejecutarAhora, intervaloMin * 60_000);
  temporizador.unref();
  ejecutarAhora();
  return {
    ejecutarAhora,
    detener: async () => {
      clearInterval(temporizador);
      await enCurso;
    },
  };
};
