import { useMemo, useState } from 'react'
import { TIPO_TODOS } from '../data/tiposServicio'
import {
  CATEGORIA_TODAS,
  agruparPorCategoria,
  categoriasDe,
  claveCategoria,
  filtrarServicios,
} from '../utils/servicios'

// Estado de los filtros del catálogo (categoría, tipo y búsqueda) sobre la lista plana que ya cargó
// la pantalla. Categoría por defecto: la del servicio ya seleccionado o, si no hay, la primera.
// Con texto en el buscador se busca en todas las categorías; al borrarlo vuelve la elegida.
export const useFiltroServicios = (servicios, { servicioId } = {}) => {
  const [categoriaElegida, setCategoriaElegida] = useState(null)
  const [tipo, setTipo] = useState(TIPO_TODOS)
  const [busqueda, setBusqueda] = useState('')

  const categorias = useMemo(() => categoriasDe(servicios), [servicios])

  const categoriaPorDefecto = useMemo(() => {
    const seleccionado = servicios.find((servicio) => servicio.id === servicioId)
    return seleccionado ? claveCategoria(seleccionado) : (categorias[0]?.slug ?? CATEGORIA_TODAS)
  }, [servicios, servicioId, categorias])

  const elegidaVigente =
    categoriaElegida === CATEGORIA_TODAS || categorias.some((c) => c.slug === categoriaElegida)
  const categoriaActiva = categoriaElegida !== null && elegidaVigente ? categoriaElegida : categoriaPorDefecto

  const visibles = useMemo(
    () => filtrarServicios(servicios, { categoria: categoriaActiva, tipo, busqueda }),
    [servicios, categoriaActiva, tipo, busqueda]
  )
  const grupos = useMemo(() => agruparPorCategoria(visibles), [visibles])

  const buscando = busqueda.trim() !== ''

  const limpiar = () => {
    setBusqueda('')
    setTipo(TIPO_TODOS)
    setCategoriaElegida(null)
  }

  return {
    categorias,
    categoriaActiva,
    setCategoria: setCategoriaElegida,
    tipo,
    setTipo,
    busqueda,
    setBusqueda,
    buscando,
    visibles,
    grupos,
    limpiar,
  }
}
