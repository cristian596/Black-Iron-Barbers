import { useMemo, useState } from 'react'
import { TIPO_TODOS } from '../data/tiposServicio'
import { CATEGORIA_TODAS, claveCategoria, filtrarServicios } from '../utils/servicios'

export const ESTADO_TODOS = 'todos'
export const AREA_TODAS = ''
const CLAVE_OTROS = 'otros'

// Filtros de /admin/servicios sobre la lista completa (activos e inactivos) que ya cargó la pantalla.
// Como en el catálogo público: por defecto se ve UNA categoría (la primera que tiene servicios) con chips y la
// opción "Todas"; con texto en el buscador se busca en todas. Las categorías vienen de la API (también las
// vacías e inactivas); los servicios sin categoría (catálogo anterior) caen en "Otros".
export const useFiltroServiciosAdmin = (servicios, categorias) => {
  const [categoriaElegida, setCategoriaElegida] = useState(null)
  const [tipo, setTipo] = useState(TIPO_TODOS)
  const [estado, setEstado] = useState(ESTADO_TODOS)
  const [area, setArea] = useState(AREA_TODAS)
  const [busqueda, setBusqueda] = useState('')

  const chips = useMemo(() => {
    // Con un área elegida, solo sus categorías (una categoría es de una sola área). «Otros» (sin categoría) es de barbería.
    const lista = categorias
      .filter((c) => area === AREA_TODAS || (c.area ?? 'barberia') === area)
      .map((c) => ({ slug: c.slug, nombre: c.nombre, activa: c.activo }))
    if (servicios.some((s) => s.categoria === null) && (area === AREA_TODAS || area === 'barberia')) {
      lista.push({ slug: CLAVE_OTROS, nombre: 'Otros', activa: true })
    }
    return lista
  }, [categorias, servicios, area])

  const categoriaPorDefecto = useMemo(() => {
    const conServicios = chips.find((chip) =>
      servicios.some((s) => claveCategoria(s) === chip.slug && (area === AREA_TODAS || (s.area ?? 'barberia') === area))
    )
    return conServicios?.slug ?? CATEGORIA_TODAS
  }, [chips, servicios, area])

  const vigente = categoriaElegida === CATEGORIA_TODAS || chips.some((c) => c.slug === categoriaElegida)
  const categoriaActiva = categoriaElegida !== null && vigente ? categoriaElegida : categoriaPorDefecto

  const visibles = useMemo(() => {
    const deArea = area === AREA_TODAS ? servicios : servicios.filter((s) => (s.area ?? 'barberia') === area)
    const porFiltros = filtrarServicios(deArea, { categoria: categoriaActiva, tipo, busqueda })
    if (estado === ESTADO_TODOS) return porFiltros
    return porFiltros.filter((s) => s.activo === (estado === 'activos'))
  }, [servicios, categoriaActiva, tipo, estado, busqueda, area])

  const buscando = busqueda.trim() !== ''
  const hayFiltros = buscando || tipo !== TIPO_TODOS || estado !== ESTADO_TODOS || area !== AREA_TODAS

  const limpiar = () => {
    setBusqueda('')
    setTipo(TIPO_TODOS)
    setEstado(ESTADO_TODOS)
    setArea(AREA_TODAS)
    setCategoriaElegida(null)
  }

  return {
    chips,
    categoriaActiva,
    setCategoria: setCategoriaElegida,
    tipo,
    setTipo,
    estado,
    setEstado,
    area,
    setArea,
    busqueda,
    setBusqueda,
    buscando,
    hayFiltros,
    visibles,
    limpiar,
  }
}
