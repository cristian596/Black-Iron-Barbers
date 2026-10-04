const ESTILOS = {
  claro: { texto: 'text-zinc-700', boton: 'border-black text-black hover:bg-black hover:text-white' },
  oscuro: { texto: 'text-white', boton: 'border-white text-white hover:bg-white hover:text-black' },
}

const SinResultados = ({ onLimpiar, variante = 'claro' }) => (
  <div role="status" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
    <p className={`font-poppins text-base ${ESTILOS[variante].texto}`}>No encontramos servicios con esos filtros.</p>
    <button
      type="button"
      onClick={onLimpiar}
      className={`cursor-pointer rounded-xl border px-5 py-2 font-poppins font-semibold active:scale-95 motion-safe:transition-colors motion-safe:duration-200 ${ESTILOS[variante].boton}`}
    >
      Limpiar filtros
    </button>
  </div>
)

export default SinResultados
