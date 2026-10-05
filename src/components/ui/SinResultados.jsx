const ESTILOS = {
  claro: { texto: 'text-zinc-700', boton: 'border-black text-black hover:bg-black hover:text-white' },
  oscuro: { texto: 'text-white', boton: 'border-white text-white hover:bg-white hover:text-black' },
}

// Por defecto es el aviso del catálogo de servicios; otras pantallas pasan su propio `mensaje`.
// Sin `onLimpiar` no se muestra el botón.
const SinResultados = ({
  onLimpiar,
  variante = 'claro',
  mensaje = 'No encontramos servicios con esos filtros.',
  etiquetaBoton = 'Limpiar filtros',
}) => (
  <div role="status" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
    <p className={`font-poppins text-base ${ESTILOS[variante].texto}`}>{mensaje}</p>
    {onLimpiar && (
      <button
        type="button"
        onClick={onLimpiar}
        className={`min-h-11 cursor-pointer rounded-xl border px-5 py-2 font-poppins font-semibold active:scale-95 motion-safe:transition-colors motion-safe:duration-200 ${ESTILOS[variante].boton}`}
      >
        {etiquetaBoton}
      </button>
    )}
  </div>
)

export default SinResultados
