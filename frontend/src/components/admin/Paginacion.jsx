import { ELIPSIS, paginasVisibles, rangoMostrado, totalPaginas } from '../../utils/paginacion'

const BOTON =
  'flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-oro disabled:cursor-not-allowed disabled:opacity-40 motion-safe:transition-colors motion-safe:duration-200'
const BOTON_NORMAL = 'border-white/15 text-zinc-300 hover:border-white/40 hover:text-white disabled:hover:border-white/15 disabled:hover:text-zinc-300'

// "Mostrando 1–15 de 435" + barra de páginas. Desde sm: Anterior, números con puntos suspensivos y Siguiente.
// En móvil: versión compacta "Anterior · Página 2 de 29 · Siguiente".
const Paginacion = ({ pagina, total, limite, alCambiar }) => {
  const ultima = totalPaginas(total, limite)
  const { inicio, fin } = rangoMostrado(pagina, limite, total)

  return (
    <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-400">
        Mostrando {inicio}–{fin} de {total}
      </p>

      {ultima > 1 && (
        <nav aria-label="Paginación" className="min-w-0">
          <ul className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <li>
              <button
                type="button"
                disabled={pagina <= 1}
                onClick={() => alCambiar(pagina - 1)}
                className={`${BOTON} ${BOTON_NORMAL}`}
              >
                Anterior
              </button>
            </li>

            <li className="text-sm text-zinc-300 sm:hidden">
              Página {pagina} de {ultima}
            </li>

            {paginasVisibles(pagina, ultima).map((p, i) =>
              p === ELIPSIS ? (
                <li key={`e${i}`} aria-hidden="true" className="hidden min-w-8 justify-center text-zinc-500 sm:flex">
                  {ELIPSIS}
                </li>
              ) : (
                <li key={p} className="hidden sm:block">
                  <button
                    type="button"
                    aria-label={`Página ${p}`}
                    aria-current={p === pagina ? 'page' : undefined}
                    onClick={() => alCambiar(p)}
                    className={`${BOTON} ${p === pagina ? 'border-oro bg-oro text-black' : BOTON_NORMAL}`}
                  >
                    {p}
                  </button>
                </li>
              )
            )}

            <li>
              <button
                type="button"
                disabled={pagina >= ultima}
                onClick={() => alCambiar(pagina + 1)}
                className={`${BOTON} ${BOTON_NORMAL}`}
              >
                Siguiente
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  )
}

export default Paginacion
