import { Link } from 'react-router-dom'
import { LEGAL } from '../../data/legal'
import { useScrollAHash } from '../../hooks/useScrollAHash'
import { useTitulo } from '../../hooks/useTitulo'

const formatearFecha = (iso) => {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia)).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// Página legal: título, fecha y versión, índice con anclas y secciones numeradas. `secciones`: [{ id, titulo, contenido }].
// Los encabezados son jerárquicos (un h1, h2 por sección) y la lectura se limita a un ancho cómodo.
const PaginaLegal = ({ titulo, descripcion, secciones }) => {
  useTitulo(`${titulo} | ${LEGAL.nombreComercial}`, descripcion)
  useScrollAHash(secciones.map((seccion) => seccion.id))

  return (
    <div className="bg-black text-white">
      <article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <header>
          <p className="font-poppins text-xs font-semibold uppercase tracking-[0.3em] text-oro">{LEGAL.nombreComercial}</p>
          <h1 className="mt-3 font-cinzel text-3xl font-bold wrap-anywhere md:text-5xl">{titulo}</h1>
          <p className="mt-4 font-poppins text-sm text-zinc-400">
            Versión {LEGAL.version} · Última actualización: {formatearFecha(LEGAL.actualizadoEn)}
          </p>
          <div aria-hidden="true" className="mt-6 h-px w-24 bg-oro" />
        </header>

        <nav aria-labelledby="indice-legal" className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 id="indice-legal" className="font-poppins text-base font-semibold text-white">
            Contenido
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-6 font-poppins text-sm text-zinc-300 marker:text-oro">
            {secciones.map(({ id, titulo: tituloSeccion }) => (
              <li key={id}>
                <Link
                  to={{ hash: `#${id}` }}
                  className="inline-flex min-h-11 items-center underline decoration-oro/60 underline-offset-4 hover:text-oro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro md:min-h-8"
                >
                  {tituloSeccion}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        {secciones.map(({ id, titulo: tituloSeccion, contenido }, i) => (
          <section key={id} id={id} aria-labelledby={`titulo-${id}`} className="mt-10 scroll-mt-24">
            <h2 id={`titulo-${id}`} className="font-cinzel text-2xl font-bold text-white">
              {i + 1}. {tituloSeccion}
            </h2>
            {contenido}
          </section>
        ))}
      </article>
    </div>
  )
}

export default PaginaLegal
