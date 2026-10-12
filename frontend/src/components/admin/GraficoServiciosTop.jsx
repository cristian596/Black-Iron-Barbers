import { useRef } from 'react'
import { formatearDinero } from '../../utils/formato'
import { abreviarPesos, recortarTexto } from '../../utils/graficos'
import { useAnchoElemento } from '../../hooks/useAnchoElemento'

const ALTO_FILA = 46
const ANCHO_VALOR = 104 // espacio a la derecha para "12 · $1,2 M"
const LARGO_CARACTER = 7.4 // ancho aproximado de un carácter de text-sm, para recortar el nombre

// Barras horizontales: nombre arriba, barra debajo y "cantidad · ingresos" a la derecha. El SVG es solo la
// imagen (role="img" + aria-label); los datos completos van en una tabla oculta para lectores de pantalla.
const GraficoServiciosTop = ({ servicios }) => {
  const contenedorRef = useRef(null)
  const ancho = useAnchoElemento(contenedorRef, 320)
  const pista = Math.max(40, ancho - ANCHO_VALOR)
  const maximo = Math.max(1, ...servicios.map((s) => s.cantidad))
  const caracteres = Math.max(8, Math.floor(ancho / LARGO_CARACTER))

  const resumen =
    'Gráfico de barras horizontales de los servicios más pedidos: ' +
    servicios.map((s) => `${s.nombre}, ${s.cantidad} ${s.cantidad === 1 ? 'vez' : 'veces'}`).join('; ') +
    '. Los datos completos están en la tabla siguiente.'

  return (
    <figure ref={contenedorRef} className="min-w-0">
      <svg
        viewBox={`0 0 ${ancho} ${servicios.length * ALTO_FILA}`}
        height={servicios.length * ALTO_FILA}
        role="img"
        aria-label={resumen}
        className="block w-full"
      >
        {servicios.map((s, i) => {
          const arriba = i * ALTO_FILA
          return (
            <g key={s.id}>
              <text x={0} y={arriba + 14} className="fill-zinc-200 text-sm">
                {/* Nombre completo al pasar el cursor cuando se recorta (cuenta cada servicio de cada cita, no los combos). */}
                <title>{s.nombre}</title>
                {recortarTexto(s.nombre, caracteres)}
              </text>
              <rect x={0} y={arriba + 22} width={pista} height={10} rx={5} className="fill-zinc-800" />
              <rect
                x={0}
                y={arriba + 22}
                width={Math.max(6, (s.cantidad / maximo) * pista)}
                height={10}
                rx={5}
                className="fill-oro"
              />
              <text x={ancho} y={arriba + 31} textAnchor="end" className="fill-white text-xs font-semibold">
                {s.cantidad} · {abreviarPesos(s.ingresos)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* La tabla va dentro de un div sr-only: un <table> ignora el ancho de 1 px y ensancharía la página. */}
      <div className="sr-only">
        <table>
          <caption>Servicios más pedidos (citas completadas)</caption>
          <thead>
            <tr>
              <th scope="col">Servicio</th>
              <th scope="col">Veces</th>
              <th scope="col">Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {servicios.map((s) => (
              <tr key={s.id}>
                <th scope="row">{s.nombre}</th>
                <td>{s.cantidad}</td>
                <td>{formatearDinero(s.ingresos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

export default GraficoServiciosTop
