// Retardo (ms) de un elemento dentro de un grupo: crece por paso, con tope para
// que los últimos de una lista larga no tarden.
export const retrasoEscalonado = (indice, paso = 80, tope = 400) =>
  Math.min(Math.max(indice, 0) * paso, tope) || 0
