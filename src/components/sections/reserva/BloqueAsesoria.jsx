import { useEffect, useRef } from 'react'
import { TarjetaServicioSeleccionable } from '../../ui/TarjetaServicio'
import { estadoDeAsesoria } from '../../../utils/reservaAsesoria'

// Bloque opcional "Añadir una asesoría" del paso Servicio. Una sola asesoría por reserva y dentro del tope de 3
// servicios en total: lo que no se puede elegir queda con aria-disabled (sigue enfocable) y el motivo en texto visible
// enlazado con aria-describedby, igual que las tarjetas de barbería. Se quita volviendo a pulsar la elegida.
// `seleccion`: servicios elegidos (objetos); `ids`: todos los ids elegidos; `enfocar`: lleva el foco al título (tras
// "Elegir otra asesoría").
const BloqueAsesoria = ({ asesorias, seleccion, ids, onAlternar, enfocar = false }) => {
  const tituloRef = useRef(null)

  useEffect(() => {
    if (enfocar) {
      tituloRef.current?.focus()
      tituloRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    }
  }, [enfocar])

  return (
    <section aria-labelledby="titulo-bloque-asesoria" className="mb-8 min-w-0 rounded-2xl border border-oro/50 bg-[#FFFBF0] p-4">
      <h3
        id="titulo-bloque-asesoria"
        ref={tituloRef}
        tabIndex={-1}
        className="font-cinzel text-xl font-bold text-black focus:outline-none"
      >
        Añadir una asesoría <span className="font-poppins text-sm font-medium text-zinc-600">(opcional)</span>
      </h3>
      <p className="mt-1 font-poppins text-sm text-zinc-600">
        Conversa con nuestra asesora de imagen. Puedes reservarla sola o con tu corte: si eliges ambos, la asesoría va
        primero y tu corte empieza justo al terminar.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {asesorias.map((asesoria) => {
          const { seleccionado, bloqueado, ayuda } = estadoDeAsesoria(seleccion, asesoria, ids)
          return (
            <TarjetaServicioSeleccionable
              key={asesoria.id}
              servicio={asesoria}
              Titulo="h4"
              seleccionado={seleccionado}
              bloqueado={bloqueado}
              ayuda={ayuda}
              onSeleccionar={onAlternar}
            />
          )
        })}
      </div>
    </section>
  )
}

export default BloqueAsesoria
