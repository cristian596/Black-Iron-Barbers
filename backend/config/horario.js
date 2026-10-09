// Horario de atención de la barbería (una sola fuente de verdad del backend), todos los días.
// El front tiene la suya en src/data/negocio.js; un test de coherencia (src/tests/horarioCoherencia.test.js) falla si difieren.
export const HORARIO_ATENCION = {
  apertura: '10:00',
  cierre: '20:00',
  intervaloMin: 30,
};
