const ESTILOS = {
  claro: { texto: 'text-red-600', boton: 'border-black text-black hover:bg-black hover:text-white' },
  oscuro: { texto: 'text-white', boton: 'border-white text-white hover:bg-white hover:text-black' },
}

// Error de carga con salida: el usuario puede volver a pedir los datos sin recargar la página.
const ErrorCarga = ({ mensaje, onReintentar, variante = 'claro' }) => (
  <div role="alert" className="flex flex-col items-center gap-3 px-4 py-6 text-center">
    <p className={`font-poppins font-semibold ${ESTILOS[variante].texto}`}>{mensaje}</p>
    <button
      type="button"
      onClick={onReintentar}
      className={`cursor-pointer rounded-xl border px-5 py-2 font-poppins font-semibold active:scale-95 motion-safe:transition-colors motion-safe:duration-200 ${ESTILOS[variante].boton}`}
    >
      Reintentar
    </button>
  </div>
)

export default ErrorCarga
