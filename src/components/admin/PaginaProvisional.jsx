// Marcador de las secciones que se construyen en partes posteriores.
const PaginaProvisional = ({ titulo, texto }) => (
  <section aria-labelledby="titulo-pagina" className="flex flex-col gap-3">
    <h1 id="titulo-pagina" className="font-playfair text-3xl font-semibold">
      {titulo}
    </h1>
    <p className="rounded-xl border border-dashed border-white/15 p-6 text-zinc-400">{texto}</p>
  </section>
)

export default PaginaProvisional
