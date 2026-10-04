const ID_MAXIMO_INT = 2147483647;

// Devuelve el mensaje de error si hay parámetros desconocidos o repetidos (?a=1&a=2, ?a[]=1, ?a[b]=1),
// o null si todo está bien.
export const validarParametros = (query, admitidos) => {
  for (const [nombre, valor] of Object.entries(query)) {
    if (!admitidos.includes(nombre)) {
      return `Parámetro desconocido '${nombre}'. Parámetros admitidos: ${admitidos.join(', ')}`;
    }
    if (typeof valor !== 'string') {
      return `El parámetro '${nombre}' debe enviarse una sola vez y como texto`;
    }
  }
  return null;
};

// Entero decimal sin signo ni espacios dentro de [minimo, maximo]; NaN si no cumple.
export const leerEntero = (texto, minimo, maximo = ID_MAXIMO_INT) => {
  if (!/^\d{1,10}$/.test(texto)) return Number.NaN;
  const numero = Number(texto);
  return numero >= minimo && numero <= maximo ? numero : Number.NaN;
};

export const escaparLike = (texto) => texto.replace(/[\\%_]/g, '\\$&');
