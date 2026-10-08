import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { esFechaISO } from '../utils/fechas'
import { totalPaginas } from '../utils/paginacion'
import { AREA_ASESORIA, AREA_BARBERIA } from '../utils/areas'

const ESPERA_BUSQUEDA_MS = 300

// Todo el estado de una lista de citas vive en la URL (?pestana=&q=&desde=&hasta=&barbero=&pagina=): atrás, adelante,
// F5 y los enlaces compartidos funcionan. Un valor inválido se ignora en vez de romper la página. Lo comparten
// /admin/citas (con `conBarbero` y `conArea`: ?area=barberia|asesoria) y /panel/citas.
const leerParametros = (params, pestanas, pestanaPorDefecto, conBarbero, conArea) => {
  const pestana = params.get('pestana')
  const pagina = params.get('pagina')
  const barbero = params.get('barbero')
  const desde = params.get('desde')
  const hasta = params.get('hasta')
  const area = params.get('area')
  return {
    pestana: pestanas.some((p) => p.id === pestana) ? pestana : pestanaPorDefecto,
    q: (params.get('q') ?? '').trim().slice(0, 100),
    desde: esFechaISO(desde) ? desde : '',
    hasta: esFechaISO(hasta) ? hasta : '',
    barbero: conBarbero && /^\d{1,9}$/.test(barbero ?? '') && Number(barbero) > 0 ? barbero : '',
    area: conArea && (area === AREA_BARBERIA || area === AREA_ASESORIA) ? area : '',
    pagina: /^\d{1,6}$/.test(pagina ?? '') && Number(pagina) > 0 ? Number(pagina) : 1,
  }
}

export const useFiltrosCitasUrl = ({ pestanas, pestanaPorDefecto, conBarbero = false, conArea = false }) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const filtros = leerParametros(searchParams, pestanas, pestanaPorDefecto, conBarbero, conArea)
  const { q } = filtros

  const [texto, setTexto] = useState(q)

  // Cambia parámetros de la URL. Cualquier cambio que no traiga `pagina` vuelve a la página 1.
  const cambiar = useCallback(
    (cambios, { reemplazar = false } = {}) => {
      const siguiente = new URLSearchParams(searchParams)
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === '' || valor === null || valor === undefined) siguiente.delete(clave)
        else siguiente.set(clave, String(valor))
      }
      if (!('pagina' in cambios) || siguiente.get('pagina') === '1') siguiente.delete('pagina')
      if (siguiente.get('pestana') === pestanaPorDefecto) siguiente.delete('pestana')
      setSearchParams(siguiente, { replace: reemplazar })
    },
    [searchParams, setSearchParams, pestanaPorDefecto]
  )

  // La búsqueda se aplica un instante después de dejar de escribir y no llena el historial con cada pausa.
  useEffect(() => {
    if (texto.trim() === q) return undefined
    const espera = setTimeout(() => cambiar({ q: texto.trim() }, { reemplazar: true }), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(espera)
  }, [texto, q, cambiar])

  // Atrás/adelante o "Limpiar filtros" cambian q en la URL: el campo la sigue (ajuste durante el render, sin
  // efecto). Si q cambió porque la búsqueda misma la escribió, el campo ya coincide y no se toca.
  const [qVista, setQVista] = useState(q)
  if (q !== qVista) {
    setQVista(q)
    if (texto.trim() !== q) setTexto(q)
  }

  const hayFiltros = Boolean(q || filtros.desde || filtros.hasta || filtros.barbero || filtros.area || texto)
  const limpiar = () => {
    setTexto('')
    cambiar({ q: '', desde: '', hasta: '', barbero: '', area: '' })
  }

  return { ...filtros, texto, setTexto, cambiar, hayFiltros, limpiar }
}

// Una página que no existe (URL vieja, o la última se vació) lleva a la última válida.
export const useCorregirPagina = (datos, pagina, limite, cambiar) => {
  useEffect(() => {
    if (!datos || datos.pagina !== pagina) return
    const ultima = totalPaginas(datos.total, limite)
    if (pagina > ultima) cambiar({ pagina: ultima }, { reemplazar: true })
  }, [datos, pagina, limite, cambiar])
}
