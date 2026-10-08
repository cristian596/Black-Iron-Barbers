// Áreas de trabajo: 'barberia' (cortes, barba…) y 'asesoria' (asesorías de imagen). Una sola fuente de verdad para
// los valores válidos, los códigos de error y las comprobaciones de emparejamiento entre profesional y servicio.
// (No se llama `tipo` porque servicios.tipo ya significa original/elite/vip.)

export const AREA_BARBERIA = 'barberia';
export const AREA_ASESORIA = 'asesoria';
export const AREAS = [AREA_BARBERIA, AREA_ASESORIA];

export const esAreaValida = (valor) => AREAS.includes(valor);

export const CODIGO_PROFESIONAL_INCOMPATIBLE = 'PROFESIONAL_INCOMPATIBLE';
// TEMPORAL: hasta la fase de reservas de asesorías, pedir un servicio de asesoría a la reserva o a la disponibilidad
// responde este código (el front sigue ofreciendo WhatsApp). Al llegar esa fase se quita.
export const CODIGO_ASESORIA_NO_DISPONIBLE_AUN = 'ASESORIA_NO_DISPONIBLE_AUN';

// Valida el parámetro opcional ?area= de las rutas públicas. Devuelve { area } (undefined si no vino) o { error }.
export const leerParametroArea = (query) => {
  const valor = query.area;
  if (valor === undefined) return { area: undefined };
  if (typeof valor !== 'string' || !esAreaValida(valor)) {
    return { error: `El parámetro 'area' debe ser uno de: ${AREAS.join(', ')}` };
  }
  return { area: valor };
};

// El trigger de emparejamiento de la base (schema.sql) lanza SQLSTATE BI001 con esta restricción: es la última barrera
// y debe traducirse a PROFESIONAL_INCOMPATIBLE, nunca a "horario ocupado" ni a un 500.
export const esErrorAreaProfesional = (err) =>
  err?.code === 'BI001' || err?.constraint === 'cita_servicios_area_profesional';

// 23P01 (solapamiento) y 23505 (duplicado) son conflictos de HORARIO, salvo las restricciones propias de las
// asesorías (una gratis por persona), que tienen otro significado y no deben disfrazarse de "horario ocupado".
export const esConflictoDeHorario = (err) => {
  if (err?.code === '23P01') return true;
  if (err?.code === '23505') return !String(err.constraint ?? '').startsWith('asesoria_gratis_usos_');
  return false;
};

// Errores listos para `res.status(status).json(cuerpo)`.
export const errorProfesionalIncompatible = (campo, error) => ({
  status: 400,
  cuerpo: {
    error: error ?? 'Ese profesional no atiende el tipo de servicio elegido',
    codigo: CODIGO_PROFESIONAL_INCOMPATIBLE,
    campo,
  },
});

export const serviciosDeAsesoria = (lista) => lista.filter((servicio) => servicio.area === AREA_ASESORIA);

export const errorAsesoriaNoDisponibleAun = (servicios) => ({
  status: 400,
  cuerpo: {
    error: 'Las asesorías todavía no se pueden reservar en línea. Escríbenos por WhatsApp y las coordinamos.',
    codigo: CODIGO_ASESORIA_NO_DISPONIBLE_AUN,
    servicios_asesoria: servicios.map((servicio) => servicio.id),
  },
});

// Citas "abiertas" de un profesional: no canceladas y (pendientes, o de hoy en adelante). Cambiar su área mientras
// las tenga dejaría citas con un profesional que ya no atiende ese servicio. `hoy` (AAAA-MM-DD, Bogotá) lo decide Node.
export const contarCitasAbiertas = async (db, barberoId, hoy) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM citas
     WHERE barbero_id = $1 AND estado <> 'cancelada' AND (estado = 'pendiente' OR fecha >= $2::date)`,
    [barberoId, hoy]
  );
  return rows[0].total;
};
