import { useMemo, useState } from 'react'
import { TIPO_TODOS } from '../data/tiposServicio'
import { CATEGORIA_TODAS, claveCategoria, filtrarServicios } from '../utils/servicios'

export const ESTADO_TODOS = 'todos'
const CLAVE_OTROS = 'otros'

// Filtros de /admin/servicios sobre la lista completa (activos e inactivos) que ya cargó la pantalla.
// Como en el catálogo público: por defecto se ve UNA categoría (la primera que tiene servicios) con chips y la
// opción "Todas"; con texto en el buscador se busca en todas. Las categorías vienen de la API (también las
// vacías e inactivas); los servicios sin categoría (catálogo anterior) caen en "Otros".
export const useFiltroServiciosAdmin = (servicios, categorias) => {
  const [categoriaElegida, setCategoriaElegida] = useState(null)
  const [tipo, setTipo] = useState(TIPO_TODOS)
  const [estado, setEstado] = useState(ESTADO_TODOS)
  const [busqueda, setBusqueda] = useState('')

  const chips = useMemo(() => {
    const lista = categorias.map((c) => ({ slug: c.slug, nombre: c.nombre, activa: c.activo }))
    if (servicios.some((s) => s.categoria === null)) lista.push({ slug: CLAVE_OTROS, nombre: 'Otros', activa: true })
    return lista
  }, [categorias, servicios])

  const categoriaPorDefecto = useMemo(() => {
    const conServicios = chips.find((chip) => servicios.some((s) => claveCategoria(s) === chip.slug))
    return conServicios?.slug ?? CATEGORIA_TODAS
  }, [chips, servicios])

  const vigente = categoriaElegida === CATEGORIA_TODAS || chips.some((c) => c.slug === categoriaElegida)
  const categoriaActiva = categoriaElegida !== null && vigente ? categoriaElegida : categoriaPorDefecto

  const visibles = useMemo(() => {
    const porFiltros = filtrarServicios(servicios, { categoria: categoriaActiva, tipo, busqueda })
    if (estado === ESTADO_TODOS) return porFiltros
    return porFiltros.filter((s) => s.activo === (estado === 'activos'))
  }, [servicios, categoriaActiva, tipo, estado, busqueda])

  const buscando = busqueda.trim() !== ''
  const hayFiltros = buscando || tipo !== TIPO_TODOS || estado !== ESTADO_TODOS

  const limpiar = () => {
    setBusqueda('')
    setTipo(TIPO_TODOS)
    setEstado(ESTADO_TODOS)
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
    busqueda,
    setBusqueda,
    buscando,
    hayFiltros,
    visibles,
    limpiar,
  }
}
