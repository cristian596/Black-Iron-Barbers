// Áreas de trabajo: 'barberia' (cortes, barba…) y 'asesoria' (asesorías de imagen). Una sola fuente de verdad para
// los valores válidos, los códigos de error y las comprobaciones de emparejamiento entre profesional y servicio.
// (No se llama `tipo` porque servicios.tipo ya significa original/elite/vip.)

export const AREA_BARBERIA = 'barberia';
export const AREA_ASESORIA = 'asesoria';
export const AREAS = [AREA_BARBERIA, AREA_ASESORIA];

export const esAreaValida = (valor) => AREAS.includes(valor);

export const CODIGO_PROFESIONAL_INCOMPATIBLE = 'PROFESIONAL_INCOMPATIBLE';
// Una asesoría gratis por persona (correo Y teléfono): si cualquiera de los dos ya la usó, 409 con este código.
export const CODIGO_ASESORIA_GRATIS_YA_USADA = 'ASESORIA_GRATIS_YA_USADA';
const CONSTRAINTS_GRATIS_USADA = ['asesoria_gratis_usos_correo_norm_key', 'asesoria_gratis_usos_telefono_norm_key'];
export const CODIGO_LIMITE_ASESORIAS = 'LIMITE_ASESORIAS';
// Una reserva lleva como máximo UNA asesoría (más hasta 2 servicios de barbería: 3 servicios en total).
export const MAX_ASESORIAS_POR_RESERVA = 1;
// clave_seed estable de la asesoría gratis (backend/db/data/servicios.js): la fase de "una por persona" la reutiliza.
export const CLAVE_ASESORIA_GRATIS = 'asesoria-gratis';

// ¿Es la asesoría gratis? (la que está limitada a una por persona) Se decide por clave_seed (estable), no por nombre ni precio: renombrarla o cambiarle el
// precio desde el admin no la convierte en otra cosa, y una asesoría creada por el admin (clave_seed nulo) nunca lo es.
export const esAsesoriaGratis = (servicio) => servicio?.clave_seed === CLAVE_ASESORIA_GRATIS;

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

// ¿La UNIQUE de correo o de teléfono de asesoria_gratis_usos? Esa persona ya usó su asesoría gratis. Se reconoce por
// err.constraint (nunca por el texto del error, que lleva el valor duplicado: datos personales).
export const esAsesoriaGratisYaUsada = (err) => err?.code === '23505' && CONSTRAINTS_GRATIS_USADA.includes(err.constraint);

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
export const serviciosDeBarberia = (lista) => lista.filter((servicio) => servicio.area !== AREA_ASESORIA);

// 409 sin revelar si coincidió el correo o el teléfono, ni nada de la otra persona: solo el servicio gratis pedido.
export const errorAsesoriaGratisYaUsada = (servicioId) => ({
  status: 409,
  cuerpo: {
    error: 'Ya usaste tu asesoría gratis. Puedes elegir otra asesoría o reservar solo tu corte.',
    codigo: CODIGO_ASESORIA_GRATIS_YA_USADA,
    servicio_id: servicioId,
  },
});

export const errorLimiteAsesorias = () => ({
  status: 400,
  cuerpo: {
    error: `Solo puedes reservar ${MAX_ASESORIAS_POR_RESERVA} asesoría por reserva`,
    codigo: CODIGO_LIMITE_ASESORIAS,
    maximo: MAX_ASESORIAS_POR_RESERVA,
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
