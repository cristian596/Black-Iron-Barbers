// La tabla `servicios` no tiene columna de categoría: se infiere aquí por
// coincidencia de nombre para poder agrupar la carta sin tocar el esquema.
const CATEGORIAS_POR_NOMBRE = {
  'Corte de Cabello': 'Cabello',
  'Tintura / Color': 'Cabello',
  'Corte de Barba': 'Barba',
  'Combo (Pelo + Barba)': 'Combos',
  'Perfilado de Cejas': 'Rostro',
  'Exfoliación Facial': 'Rostro',
};

const PALABRAS_CLAVE = [
  { palabra: /barba/i, categoria: 'Barba' },
  { palabra: /combo/i, categoria: 'Combos' },
  { palabra: /ceja|facial|exfoli/i, categoria: 'Rostro' },
  { palabra: /corte|cabello|tintura|color/i, categoria: 'Cabello' },
];

export const CATEGORIA_POR_DEFECTO = 'Otros';

export const obtenerCategoria = (servicio) => {
  const nombre = servicio?.nombre ?? '';

  if (CATEGORIAS_POR_NOMBRE[nombre]) {
    return CATEGORIAS_POR_NOMBRE[nombre];
  }

  const coincidencia = PALABRAS_CLAVE.find(({ palabra }) => palabra.test(nombre));
  return coincidencia ? coincidencia.categoria : CATEGORIA_POR_DEFECTO;
};
