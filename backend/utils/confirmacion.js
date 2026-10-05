// Regla de "cita por confirmar" del panel del barbero: una cita PENDIENTE cuyo fin (hora de inicio + duración) más
// la gracia ya pasó. Incluye días anteriores. Todo se calcula con la hora de Bogotá que decide Node (ahoraBogota()),
// nunca con NOW(): la consulta recibe "ahora" y la gracia como parámetros.
//   por confirmar  ⇔  fecha + hora + duración + GRACIA  <=  ahora
// En el instante exacto del límite ya cuenta como por confirmar; un minuto antes, no.
export const HORAS_GRACIA_CONFIRMACION = 2;
export const MINUTOS_GRACIA_CONFIRMACION = HORAS_GRACIA_CONFIRMACION * 60;

// Máximo de citas devueltas por GET /api/barbero/citas-por-confirmar (el total real va aparte).
export const TOPE_POR_CONFIRMAR = 100;
