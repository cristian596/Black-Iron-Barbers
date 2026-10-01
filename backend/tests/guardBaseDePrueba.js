// Red de seguridad: evita que los tests corran contra una base que no sea
// de pruebas. El 2026-09-30 un test corrio sin cargar .env.test y vacio la
// tabla `citas` de la base de desarrollo real. Esta funcion se llama antes
// de cualquier CREATE DATABASE / TRUNCATE / conexion a Postgres en los tests.
export const asegurarBaseDePrueba = () => {
  const nombre = process.env.DB_NAME;

  if (!nombre || !nombre.toLowerCase().includes('test')) {
    throw new Error(
      `DB_NAME ("${nombre ?? 'sin definir'}") no parece una base de pruebas (debe incluir "test"). ` +
      'Los tests se abortan para no arriesgar datos reales. ' +
      'Verifica que backend/.env.test se este cargando (o las variables del workflow de CI).'
    );
  }
};
