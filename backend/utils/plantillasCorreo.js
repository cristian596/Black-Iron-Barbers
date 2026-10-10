import { NOMBRE_NEGOCIO, DIRECCION_NEGOCIO, CIUDAD_NEGOCIO } from '../config/negocio.js';
import { instanteDeBogota } from './ics.js';

// Plantillas de los correos de citas (texto plano + HTML). Reglas:
//  - TODO valor que escribe una persona (cliente, nombres de profesional y de servicio) pasa por escaparHtml en el HTML
//    y por limpiarLinea cuando va a una cabecera (asunto): sin HTML ejecutable ni inyección de cabeceras.
//  - Sin enlaces con tokens, sin teléfonos ni correos de otras personas.
//  - Los estilos van EN LÍNEA a propósito: los clientes de correo ignoran las clases (única excepción a "solo Tailwind").

const ESCAPES_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escaparHtml = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ESCAPES_HTML[c]);

// Una sola línea: sin \r \n ni otros caracteres de control (cabeceras de correo).
export const limpiarLinea = (valor) =>
  String(valor ?? '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

// Destinatario: UNA dirección simple. La validación de la reserva solo exige algo@algo.algo y deja pasar "a@b.com,c@d.com"
// o "<x>"; aquí se acepta únicamente el formato corriente, sin comas, espacios, comillas ni ángulos.
const REGEX_CORREO_SEGURO =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
export const correoSeguro = (correo) => {
  if (typeof correo !== 'string') return null;
  const limpio = correo.trim();
  return limpio.length <= 254 && REGEX_CORREO_SEGURO.test(limpio) ? limpio : null;
};

// j***@dominio.com — para los registros (log) sin exponer el correo completo.
export const enmascararCorreo = (correo) => {
  const texto = String(correo ?? '');
  const arroba = texto.lastIndexOf('@');
  if (arroba < 1) return '***';
  return `${texto[0]}***${texto.slice(arroba)}`;
};

// Sustituye cualquier correo que aparezca dentro de un texto (p. ej. el mensaje de error de un SMTP) por su versión enmascarada.
export const enmascararCorreosEnTexto = (texto) =>
  String(texto ?? '').replace(/[^\s<>"',;()]+@[^\s<>"',;()]+/g, (encontrado) => enmascararCorreo(encontrado));

export const formatearPesos = (valor) =>
  `$${Math.round(Number(valor) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const formateadorFechaHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

// "sábado 10 de octubre de 2026, 10:30 a. m." — siempre en hora de Bogotá, venga de donde venga el servidor.
export const formatearInstanteBogota = (instante) => {
  const partes = Object.fromEntries(formateadorFechaHora.formatToParts(instante).map(({ type, value }) => [type, value]));
  const periodo = /^a/i.test(partes.dayPeriod ?? '') ? 'a. m.' : 'p. m.';
  return `${partes.weekday} ${partes.day} de ${partes.month} de ${partes.year}, ${partes.hour}:${partes.minute} ${periodo}`;
};

export const formatearFechaHora = (fecha, hora) => formatearInstanteBogota(instanteDeBogota(fecha, hora));

const textoDuracion = (minutos) => `${minutos} min`;
const textoPrecio = (servicio) => (servicio.gratis ? `${formatearPesos(0)} · Asesoría gratuita` : formatearPesos(servicio.precio));
const lineaServicio = (servicio) => `${servicio.nombre} · ${textoDuracion(servicio.duracion_min)} · ${textoPrecio(servicio)}`;
const etiquetaProfesional = (cita) => (cita.area === 'asesoria' ? 'Asesor/a' : 'Barbero');
const textoTotal = (citas) => {
  const total = citas.reduce((suma, cita) => suma + Number(cita.precio), 0);
  const minutos = citas.reduce((suma, cita) => suma + Number(cita.duracion_min), 0);
  return `${textoDuracion(minutos)} · ${formatearPesos(total)}`;
};

// ---------- Bloques ----------

const bloqueCitaTexto = (cita) =>
  [
    formatearFechaHora(cita.fecha, cita.hora),
    `${etiquetaProfesional(cita)}: ${cita.profesional}`,
    ...cita.servicios.map((servicio) => `  - ${lineaServicio(servicio)}`),
  ].join('\n');

const ESTILO = {
  fondo: 'margin:0;padding:0;background:#f4f4f5;',
  contenedor: 'width:100%;max-width:560px;margin:0 auto;background:#ffffff;',
  cabecera: 'background:#111111;padding:20px 24px;font-family:Georgia,serif;font-size:20px;letter-spacing:1px;color:#d4af37;',
  cuerpo: 'padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2937;',
  titulo: 'margin:0 0 12px 0;font-family:Georgia,serif;font-size:22px;line-height:1.3;color:#111111;',
  tarjeta: 'margin:16px 0;border:1px solid #e5e7eb;border-left:4px solid #d4af37;border-radius:4px;',
  tarjetaCelda: 'padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2937;',
  fechaDestacada: 'margin:0 0 8px 0;font-size:16px;font-weight:bold;color:#111111;',
  pie: 'padding:16px 24px;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#6b7280;',
};

const bloqueCitaHtml = (cita, { tachada = false } = {}) => {
  const decoracion = tachada ? 'text-decoration:line-through;' : '';
  const servicios = cita.servicios
    .map(
      (servicio) =>
        `<li style="margin:2px 0;">${escaparHtml(servicio.nombre)} &middot; ${escaparHtml(textoDuracion(servicio.duracion_min))} &middot; ${escaparHtml(textoPrecio(servicio))}</li>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${ESTILO.tarjeta}"><tr><td style="${ESTILO.tarjetaCelda}${decoracion}">
<p style="${ESTILO.fechaDestacada}">${escaparHtml(formatearFechaHora(cita.fecha, cita.hora))}</p>
<p style="margin:0 0 6px 0;">${escaparHtml(etiquetaProfesional(cita))}: <strong>${escaparHtml(cita.profesional)}</strong></p>
<ul style="margin:0;padding-left:20px;">${servicios}</ul>
</td></tr></table>`;
};

const parrafosHtml = (parrafos) => parrafos.map((p) => `<p style="margin:0 0 12px 0;">${escaparHtml(p)}</p>`).join('');

const envolver = ({ titulo, parrafosAntes = [], citasHtml = '', parrafosDespues = [] }) =>
  `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escaparHtml(titulo)}</title></head>
<body style="${ESTILO.fondo}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${ESTILO.fondo}"><tr><td align="center" style="padding:16px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${ESTILO.contenedor}">
<tr><td style="${ESTILO.cabecera}">${escaparHtml(NOMBRE_NEGOCIO.toUpperCase())}</td></tr>
<tr><td style="${ESTILO.cuerpo}">
<h1 style="${ESTILO.titulo}">${escaparHtml(titulo)}</h1>
${parrafosHtml(parrafosAntes)}${citasHtml}${parrafosHtml(parrafosDespues)}
</td></tr>
<tr><td style="${ESTILO.pie}"><strong>${escaparHtml(NOMBRE_NEGOCIO)}</strong><br>${escaparHtml(DIRECCION_NEGOCIO)}, ${escaparHtml(CIUDAD_NEGOCIO)}</td></tr>
</table></td></tr></table></body></html>`;

const pieTexto = `${NOMBRE_NEGOCIO}\n${DIRECCION_NEGOCIO}, ${CIUDAD_NEGOCIO}`;

const armar = ({ asunto, titulo, saludo, parrafosAntes, citas, tachada = false, parrafosDespues = [], resumenTotal = false }) => {
  const encabezado = [saludo, ...parrafosAntes].filter(Boolean).join('\n\n');
  const texto = [
    encabezado,
    citas.map(bloqueCitaTexto).join('\n\n'),
    resumenTotal ? `Total: ${textoTotal(citas)}` : null,
    parrafosDespues.join('\n'),
    pieTexto,
  ]
    .filter(Boolean)
    .join('\n\n');
  const html = envolver({
    titulo,
    parrafosAntes: [saludo, ...parrafosAntes].filter(Boolean),
    citasHtml:
      citas.map((cita) => bloqueCitaHtml(cita, { tachada })).join('') +
      (resumenTotal ? `<p style="margin:0 0 12px 0;"><strong>Total:</strong> ${escaparHtml(textoTotal(citas))}</p>` : ''),
    parrafosDespues,
  });
  return { asunto: limpiarLinea(asunto), texto, html };
};

// ---------- Plantillas por evento ----------

const saludoA = (cliente) => `Hola, ${limpiarLinea(cliente)}.`;

// Una reserva (una cita, o las dos de una combinada) → UN solo correo al cliente.
export const plantillaConfirmacionCliente = (citas) => {
  const combinada = citas.length > 1;
  return armar({
    asunto: `Tu cita en ${NOMBRE_NEGOCIO} está confirmada`,
    titulo: combinada ? 'Tus citas están confirmadas' : 'Tu cita está confirmada',
    saludo: saludoA(citas[0].cliente),
    parrafosAntes: [
      combinada
        ? 'Reservaste una asesoría y un corte, atendidos uno tras otro. Estos son los detalles:'
        : 'Reservaste tu cita. Estos son los detalles:',
    ],
    citas,
    resumenTotal: true,
    parrafosDespues: ['Adjuntamos un archivo de calendario para que la agregues a tu agenda. Te esperamos.'],
  });
};

export const plantillaCancelacionCliente = (cita) =>
  armar({
    asunto: `Tu cita en ${NOMBRE_NEGOCIO} fue cancelada`,
    titulo: 'Tu cita fue cancelada',
    saludo: saludoA(cita.cliente),
    parrafosAntes: [`Tu cita fue cancelada por ${cita.profesional}, quien la tenía a cargo.`],
    citas: [cita],
    tachada: true,
    parrafosDespues: ['Si quieres, puedes reservar una nueva cita en nuestra web. Disculpa los inconvenientes.'],
  });

// anterior: nombre del profesional que tenía la cita antes del cambio.
export const plantillaCambioCliente = (cita, anterior) =>
  armar({
    asunto: `Cambió el profesional de tu cita en ${NOMBRE_NEGOCIO}`,
    titulo: 'Actualizamos tu cita',
    saludo: saludoA(cita.cliente),
    parrafosAntes: [`Tu cita ahora la atenderá ${cita.profesional} (antes: ${anterior}). La fecha y la hora no cambian.`],
    citas: [cita],
    parrafosDespues: ['Adjuntamos el calendario actualizado. Te esperamos.'],
  });

// tipo: 'nueva' (le asignan una cita) | 'cancelada' | 'quitada' (reasignada a otra persona).
export const plantillaAvisoProfesional = (cita, tipo) => {
  const titulos = { nueva: 'Tienes una cita nueva', cancelada: 'Se canceló una cita tuya', quitada: 'Una cita tuya fue reasignada' };
  const cliente = limpiarLinea(cita.cliente);
  const detalle = {
    nueva: `Se te asignó una cita para ${cliente}.`,
    cancelada: `Se canceló la cita de ${cliente}.`,
    quitada: `La cita de ${cliente} pasó a otro profesional.`,
  };
  return armar({
    asunto: `${titulos[tipo]}: ${cliente}`,
    titulo: titulos[tipo],
    parrafosAntes: [detalle[tipo]],
    citas: [cita],
    tachada: tipo !== 'nueva',
  });
};

// ---------- Eventos de calendario (.ics) ----------

export const eventoDeCita = (cita) => {
  const inicio = instanteDeBogota(cita.fecha, cita.hora);
  return {
    id: cita.id,
    inicio,
    fin: new Date(inicio.getTime() + Number(cita.duracion_min) * 60_000),
    resumen: `${NOMBRE_NEGOCIO}: ${cita.servicios.map((servicio) => servicio.nombre).join(' + ')}`,
    descripcion: `${etiquetaProfesional(cita)}: ${cita.profesional}\n${cita.servicios.map(lineaServicio).join('\n')}`,
    ubicacion: `${NOMBRE_NEGOCIO}, ${DIRECCION_NEGOCIO}, ${CIUDAD_NEGOCIO}`,
  };
};
