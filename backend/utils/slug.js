const LARGO_MAXIMO = 100;

// "Cortes + Barba" → "cortes-barba". Sin tildes, solo a-z, 0-9 y guiones; compatible con el filtro ?categoria=
// de la API pública (^[a-z0-9]+(-[a-z0-9]+)*$). Un nombre sin letras ni números da "categoria".
export const generarSlug = (nombre) => {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LARGO_MAXIMO - 8)
    .replace(/-+$/g, '');
  return base || 'categoria';
};
