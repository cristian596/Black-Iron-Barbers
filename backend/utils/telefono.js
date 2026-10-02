const REGEX_CELULAR_CO = /^3\d{9}$/;

// Acepta espacios, guiones y el prefijo +57/57, y lo reduce a los 10 dígitos
// del celular (siempre empieza por 3 en Colombia).
export const normalizarTelefono = (valor) => {
  if (typeof valor !== 'string') return '';

  let limpio = valor.replace(/[\s-]/g, '');

  if (limpio.startsWith('+57')) {
    limpio = limpio.slice(3);
  } else if (limpio.startsWith('57') && limpio.length === 12) {
    limpio = limpio.slice(2);
  }

  return limpio;
};

export const esTelefonoValido = (telefono) =>
  typeof telefono === 'string' && REGEX_CELULAR_CO.test(telefono);
