// La API no devuelve descripción (solo nombre, duración y precio), así que
// el texto corto de cada tarjeta vive aquí, indexado por nombre.
const DESCRIPCIONES_POR_NOMBRE = {
  'Corte de Cabello': 'Corte a tijera y máquina, ajustado a tu tipo de rostro y estilo.',
  'Corte de Barba': 'Diseño y perfilado de barba con navaja, para un acabado definido.',
  'Combo (Pelo + Barba)': 'La experiencia completa: corte de cabello y barba en una sola cita.',
  'Perfilado de Cejas': 'Limpieza y forma de cejas para un rostro más definido.',
  'Exfoliación Facial': 'Limpieza profunda que renueva la piel y abre el poro.',
  'Tintura / Color': 'Color uniforme o canas cubiertas, con productos profesionales.',
};

const DESCRIPCION_POR_DEFECTO = 'Servicio realizado por barberos profesionales de Black Iron.';

export const obtenerDescripcion = (servicio) =>
  DESCRIPCIONES_POR_NOMBRE[servicio?.nombre] ?? DESCRIPCION_POR_DEFECTO;
