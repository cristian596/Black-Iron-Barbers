export const ELIPSIS = '…'

// Números de página a mostrar. Hasta 7 páginas se ven todas; con más se usan puntos suspensivos:
//   1 2 3 4 … 29 · 1 … 4 5 6 … 29 · 1 … 26 27 28 29
export const paginasVisibles = (actual, ultima) => {
  if (ultima <= 7) return Array.from({ length: ultima }, (_, i) => i + 1)
  if (actual <= 3) return [1, 2, 3, 4, ELIPSIS, ultima]
  if (actual >= ultima - 2) return [1, ELIPSIS, ultima - 3, ultima - 2, ultima - 1, ultima]
  return [1, ELIPSIS, actual - 1, actual, actual + 1, ELIPSIS, ultima]
}

export const totalPaginas = (total, limite) => Math.max(1, Math.ceil(total / limite))

// "1–15 de 435": primera y última fila de la página (0–0 si no hay resultados).
export const rangoMostrado = (pagina, limite, total) => ({
  inicio: total === 0 ? 0 : (pagina - 1) * limite + 1,
  fin: Math.min(total, pagina * limite),
})
