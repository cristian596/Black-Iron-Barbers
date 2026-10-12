import PanelAdmin from './PanelAdmin'
import FormularioServicio from './FormularioServicio'

// `servicio` null = alta. La key reinicia el formulario al cambiar de servicio.
const PanelEdicionServicio = ({ lateral, servicio, categorias, alGuardar, alCerrar, errorInicial }) => (
  <PanelAdmin lateral={lateral} titulo={servicio ? 'Editar servicio' : 'Nuevo servicio'} alCerrar={alCerrar}>
    <FormularioServicio
      key={servicio?.id ?? 'nuevo'}
      servicio={servicio}
      categorias={categorias}
      alGuardar={alGuardar}
      alCancelar={alCerrar}
      errorInicial={errorInicial}
    />
  </PanelAdmin>
)

export default PanelEdicionServicio
