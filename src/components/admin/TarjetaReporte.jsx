// Cifra del reporte diario. `nota` aclara qué cuenta (o no) la cifra. Con print: queda negro sobre blanco.
const TarjetaReporte = ({ etiqueta, valor, nota }) => (
  <div className="min-w-0 rounded-xl border border-white/10 bg-zinc-950 p-4 print:border-zinc-400 print:bg-white">
    <p className="wrap-anywhere text-xs font-medium uppercase tracking-wide text-zinc-400 print:text-zinc-700">{etiqueta}</p>
    <p className="mt-1 wrap-anywhere font-poppins text-2xl font-semibold text-white sm:text-3xl print:text-black">{valor}</p>
    {nota && <p className="mt-2 text-sm text-zinc-400 print:text-zinc-700">{nota}</p>}
  </div>
)

export default TarjetaReporte
