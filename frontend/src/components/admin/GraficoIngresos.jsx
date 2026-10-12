import { useEffect, useRef, useState } from 'react'
import { formatearDinero } from '../../utils/formato'
import { formatearRango } from '../../utils/fechas'
import { abreviarPesos, escalaEje } from '../../utils/graficos'
import { useAnchoElemento } from '../../hooks/useAnchoElemento'

// Márgenes del área de dibujo. Los botones de interacción se colocan encima con las clases
// left-13 / right-2 / top-3 / bottom-7 (52 / 8 / 12 / 28 px): si cambias estos números, cambia esas clases.
const ALTO = 260
const MARGEN = { izq: 52, der: 8, sup: 12, inf: 28 }
const ANCHO_TOOLTIP = 152
const ALTO_TOOLTIP = 78
const ALTO_TOOLTIP_DESGLOSE = 94 // con una línea más por área

const MESES_LARGOS = { month: 'long', year: 'numeric', timeZone: 'UTC' }

const fechaDeMes = (mes) => {
  const [anio, numero] = mes.split('-').map(Number)
  return new Date(Date.UTC(anio, numero - 1, 1))
}

// Etiquetas según la agrupación: día → "5 oct" · mes → "octubre de 2026".
const etiquetaCompleta = (agrupar, punto) =>
  agrupar === 'dia'
    ? formatearRango({ desde: punto.fecha, hasta: punto.fecha })
    : fechaDeMes(punto.mes).toLocaleDateString('es-CO', MESES_LARGOS)

const etiquetaEje = (agrupar, punto) => {
  if (agrupar === 'dia') {
    const [, mes, dia] = punto.fecha.split('-')
    return `${Number(dia)}/${Number(mes)}`
  }
  return fechaDeMes(punto.mes).toLocaleDateString('es-CO', { month: 'short', timeZone: 'UTC' }).replace('.', '')
}

const sumar = (lista) => lista.reduce((total, p) => total + p.ingresos, 0)
const sumarArea = (lista, campo) => lista.reduce((total, p) => total + (p[campo] ?? 0), 0)
// Unidades de un punto: el campo del vocabulario (`cortes` o `asesorias`, las del profesional según su área) o, si no hay,
// las citas completadas (cortes + asesorías); sin `completadas` (respuestas anteriores), `cortes`.
const cuentaDe = (campo) => (p) => p[campo] ?? p.completadas ?? p.cortes ?? 0

// Barras de ingresos (oro) con el período anterior como línea discontinua (zinc). Se dibuja a 1 unidad = 1 px
// del ancho real. El SVG es solo la imagen (role="img" + aria-label + tabla de datos oculta); la interacción
// (hover, foco con flechas, toque) la hacen botones colocados encima, así no hay controles dentro de un role="img".
const VOCABULARIO_CORTES = { unidad: 'corte', unidades: 'cortes', etiquetaTotal: 'Cortes' }

// `vocabulario` (opcional, solo textos): { unidad, unidades, etiquetaTotal }; sin él, "corte(s)" como siempre.
// `desglose` (admin): las cifras de barbería y de asesoría van por separado (tooltip, totales y tabla).
const GraficoIngresos = ({ agrupar, puntos, anteriores, vocabulario = VOCABULARIO_CORTES, desglose = false }) => {
  const contenedorRef = useRef(null)
  const botonesRef = useRef([])
  const ancho = useAnchoElemento(contenedorRef)
  const [activo, setActivo] = useState(null)

  const cuenta = cuentaDe(vocabulario.campo)
  const n = puntos.length
  const unidad = agrupar === 'dia' ? 'día' : 'mes'

  // Toque fuera del gráfico: cierra el detalle (en móvil no hay mouseleave).
  useEffect(() => {
    if (activo === null) return undefined
    const fuera = (e) => {
      if (!contenedorRef.current?.contains(e.target)) setActivo(null)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [activo])

  const areaAncho = Math.max(1, ancho - MARGEN.izq - MARGEN.der)
  const areaAlto = ALTO - MARGEN.sup - MARGEN.inf
  const mayor = Math.max(0, ...puntos.map((p) => p.ingresos), ...anteriores.map((p) => p.ingresos))
  const { max, paso } = escalaEje(mayor)
  const y = (valor) => MARGEN.sup + areaAlto - (valor / max) * areaAlto
  const banda = areaAncho / n
  const anchoBarra = Math.max(2, Math.min(28, banda * 0.62))
  const centro = (i) => MARGEN.izq + banda * i + banda / 2
  const cadaCuantas = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(areaAncho / 44))))

  const lineaAnterior = anteriores
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${centro(i).toFixed(1)} ${y(p.ingresos).toFixed(1)}`)
    .join(' ')

  const altoTooltip = desglose ? ALTO_TOOLTIP_DESGLOSE : ALTO_TOOLTIP
  const totalBarberia = sumarArea(puntos, 'ingresos_barberia')
  const totalAsesoria = sumarArea(puntos, 'ingresos_asesoria')

  const mejor = puntos.reduce((m, p) => (p.ingresos > m.ingresos ? p : m), puntos[0])
  const resumen =
    `Gráfico de barras de ingresos por ${unidad} (${n} ${agrupar === 'dia' ? 'días' : 'meses'}). ` +
    `Total ${formatearDinero(sumar(puntos))}; período anterior ${formatearDinero(sumar(anteriores))}. ` +
    (desglose ? `De barbería ${formatearDinero(totalBarberia)} y de asesorías ${formatearDinero(totalAsesoria)}. ` : '') +
    (mejor.ingresos > 0
      ? `Mayor ingreso: ${etiquetaCompleta(agrupar, mejor)} con ${formatearDinero(mejor.ingresos)}. `
      : '') +
    'La línea discontinua es el período anterior. Los datos completos están en la tabla siguiente.'

  const alPulsar = (e) => {
    if (e.key === 'Escape') {
      setActivo(null)
      return
    }
    const actual = botonesRef.current.indexOf(document.activeElement)
    if (actual === -1) return
    const destino = { ArrowRight: actual + 1, ArrowLeft: actual - 1, Home: 0, End: n - 1 }[e.key]
    if (destino === undefined) return
    e.preventDefault()
    botonesRef.current[Math.min(n - 1, Math.max(0, destino))]?.focus()
  }

  const punto = activo === null ? null : puntos[activo]
  let tooltip = null
  if (punto) {
    const previo = anteriores[activo]
    const tx = Math.min(Math.max(centro(activo) - ANCHO_TOOLTIP / 2, MARGEN.izq), ancho - MARGEN.der - ANCHO_TOOLTIP)
    const ty = Math.max(MARGEN.sup, y(Math.max(punto.ingresos, previo.ingresos)) - altoTooltip - 6)
    tooltip = { tx, ty, punto, previo }
  }

  return (
    <figure className="min-w-0">
      <div ref={contenedorRef} className="relative h-65 w-full">
        <svg viewBox={`0 0 ${ancho} ${ALTO}`} height={ALTO} role="img" aria-label={resumen} className="block w-full">
          {[0, 1, 2, 3, 4].map((tramo) => {
            const valor = paso * tramo
            return (
              <g key={tramo}>
                <line
                  x1={MARGEN.izq}
                  x2={ancho - MARGEN.der}
                  y1={y(valor)}
                  y2={y(valor)}
                  className={tramo === 0 ? 'stroke-zinc-600' : 'stroke-zinc-800'}
                />
                <text x={MARGEN.izq - 8} y={y(valor)} textAnchor="end" dominantBaseline="middle" className="fill-zinc-500 text-xs">
                  {abreviarPesos(valor)}
                </text>
              </g>
            )
          })}

          {activo !== null && (
            <rect x={MARGEN.izq + banda * activo} y={MARGEN.sup} width={banda} height={areaAlto} className="fill-white/5" />
          )}

          {puntos.map((p, i) =>
            p.ingresos > 0 ? (
              <rect
                key={i}
                x={centro(i) - anchoBarra / 2}
                y={y(p.ingresos)}
                width={anchoBarra}
                height={y(0) - y(p.ingresos)}
                rx={2}
                className="fill-oro"
              />
            ) : null
          )}

          <path d={lineaAnterior} className="fill-none stroke-zinc-400 stroke-[1.5] [stroke-dasharray:5_4]" />

          {puntos.map((p, i) =>
            i % cadaCuantas === 0 ? (
              <text key={i} x={centro(i)} y={ALTO - 8} textAnchor="middle" className="fill-zinc-500 text-xs">
                {etiquetaEje(agrupar, p)}
              </text>
            ) : null
          )}

          {tooltip && (
            <g transform={`translate(${tooltip.tx} ${tooltip.ty})`} className="pointer-events-none motion-safe:transition-opacity">
              <rect width={ANCHO_TOOLTIP} height={altoTooltip} rx={6} className="fill-zinc-900 stroke-zinc-600" />
              <text x={10} y={18} className="fill-zinc-400 text-xs">
                {etiquetaCompleta(agrupar, tooltip.punto)}
              </text>
              <text x={10} y={38} className="fill-white text-sm font-semibold">
                {formatearDinero(tooltip.punto.ingresos)}
              </text>
              {desglose ? (
                <>
                  <text x={10} y={55} className="fill-zinc-300 text-xs">
                    Barbería {formatearDinero(tooltip.punto.ingresos_barberia ?? 0)}
                  </text>
                  <text x={10} y={70} className="fill-zinc-300 text-xs">
                    Asesorías {formatearDinero(tooltip.punto.ingresos_asesoria ?? 0)}
                  </text>
                  <text x={10} y={86} className="fill-zinc-400 text-xs">
                    Antes: {formatearDinero(tooltip.previo.ingresos)}
                  </text>
                </>
              ) : (
                <>
                  <text x={10} y={55} className="fill-zinc-300 text-xs">
                    {cuenta(tooltip.punto)} {cuenta(tooltip.punto) === 1 ? vocabulario.unidad : vocabulario.unidades}
                  </text>
                  <text x={10} y={70} className="fill-zinc-400 text-xs">
                    Antes: {formatearDinero(tooltip.previo.ingresos)}
                  </text>
                </>
              )}
            </g>
          )}
        </svg>

        <div
          className="absolute bottom-7 left-13 right-2 top-3 flex"
          onMouseLeave={() => setActivo(null)}
          onKeyDown={alPulsar}
        >
          {puntos.map((p, i) => (
            <button
              key={i}
              ref={(el) => {
                botonesRef.current[i] = el
              }}
              type="button"
              tabIndex={i === (activo ?? n - 1) ? 0 : -1}
              aria-label={
                desglose
                  ? `${etiquetaCompleta(agrupar, p)}: ${formatearDinero(p.ingresos)} (barbería ${formatearDinero(p.ingresos_barberia ?? 0)}, asesorías ${formatearDinero(p.ingresos_asesoria ?? 0)}), ${p.cortes ?? 0} ${p.cortes === 1 ? 'corte' : 'cortes'} y ${p.asesorias ?? 0} ${p.asesorias === 1 ? 'asesoría' : 'asesorías'}`
                  : `${etiquetaCompleta(agrupar, p)}: ${formatearDinero(p.ingresos)}, ${cuenta(p)} ${cuenta(p) === 1 ? vocabulario.unidad : vocabulario.unidades}`
              }
              onMouseEnter={() => setActivo(i)}
              onFocus={() => setActivo(i)}
              onBlur={() => setActivo(null)}
              onClick={() => setActivo(i)}
              className="min-w-0 flex-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-oro"
            />
          ))}
        </div>
      </div>

      <figcaption>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 rounded-sm bg-oro" /> Período actual
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="w-5 border-t-2 border-dashed border-zinc-400" /> Período anterior
          </li>
          {desglose && (
            <li>
              Del período actual: barbería {formatearDinero(totalBarberia)} · asesorías {formatearDinero(totalAsesoria)}
            </li>
          )}
        </ul>
      </figcaption>

      {/* La tabla va dentro de un div sr-only: un <table> ignora el ancho de 1 px y ensancharía la página. */}
      <div className="sr-only">
        <table>
          <caption>Ingresos por {unidad}, con el período anterior</caption>
          <thead>
            <tr>
              <th scope="col">{agrupar === 'dia' ? 'Día' : 'Mes'}</th>
              <th scope="col">Ingresos</th>
              {desglose ? (
                <>
                  <th scope="col">Ingresos de barbería</th>
                  <th scope="col">Ingresos de asesorías</th>
                  <th scope="col">Cortes</th>
                  <th scope="col">Asesorías</th>
                </>
              ) : (
                <th scope="col">{vocabulario.etiquetaTotal}</th>
              )}
              <th scope="col">Ingresos del período anterior</th>
            </tr>
          </thead>
          <tbody>
            {puntos.map((p, i) => (
              <tr key={i}>
                <th scope="row">{etiquetaCompleta(agrupar, p)}</th>
                <td>{formatearDinero(p.ingresos)}</td>
                {desglose ? (
                  <>
                    <td>{formatearDinero(p.ingresos_barberia ?? 0)}</td>
                    <td>{formatearDinero(p.ingresos_asesoria ?? 0)}</td>
                    <td>{p.cortes ?? 0}</td>
                    <td>{p.asesorias ?? 0}</td>
                  </>
                ) : (
                  <td>{cuenta(p)}</td>
                )}
                <td>{formatearDinero(anteriores[i].ingresos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

export default GraficoIngresos
