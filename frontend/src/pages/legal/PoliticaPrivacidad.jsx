import DatosResponsable from '../../components/legal/DatosResponsable'
import PaginaLegal from '../../components/legal/PaginaLegal'
import { EnlaceLegal, Lista, Parrafo } from '../../components/legal/Texto'
import { LEGAL, NOMBRES_LEGALES, RUTAS_LEGALES } from '../../data/legal'

const SECCIONES = [
  {
    id: 'quienes-somos',
    titulo: 'Quiénes somos',
    contenido: (
      <>
        <Parrafo>
          {LEGAL.nombreComercial} es el responsable de los datos que nos das en este sitio. Puedes contactarnos aquí:
        </Parrafo>
        <DatosResponsable />
      </>
    ),
  },
  {
    id: 'que-datos',
    titulo: 'Qué datos te pedimos',
    contenido: (
      <>
        <Parrafo>Al reservar una cita te pedimos:</Parrafo>
        <Lista items={['Tu nombre.', 'Tu correo electrónico.', 'Tu teléfono celular.']} />
        <Parrafo>
          Además guardamos los datos de la cita (servicio, profesional, fecha y hora) y te enviamos un código para comprobar
          tu correo. No te pedimos datos sensibles ni crear una cuenta.
        </Parrafo>
      </>
    ),
  },
  {
    id: 'para-que',
    titulo: 'Para qué los usamos',
    contenido: (
      <Lista
        items={[
          'Gestionar y confirmar tu reserva.',
          'Enviarte el código de verificación, la confirmación y un recordatorio de tu cita.',
          'Responder tus consultas.',
          'Entender, de forma agregada, cómo se usa el sitio (solo si aceptas las cookies analíticas).',
        ]}
      />
    ),
  },
  {
    id: 'con-quien',
    titulo: 'Con quién los compartimos',
    contenido: (
      <>
        <Parrafo>
          No vendemos tus datos. Solo los comparten con nosotros los proveedores que hacen posible el servicio: alojamiento,
          base de datos, envío de correo y, si lo aceptas, Google Analytics. Algunos pueden estar en otros países, incluido
          Estados Unidos.
        </Parrafo>
        <Parrafo>
          El detalle está en la <EnlaceLegal to={RUTAS_LEGALES.datos}>{NOMBRES_LEGALES.datos}</EnlaceLegal>.
        </Parrafo>
      </>
    ),
  },
  {
    id: 'cuanto-tiempo',
    titulo: 'Cuánto tiempo los guardamos',
    contenido: (
      <Parrafo>
        El tiempo que haga falta para atenderte, mantener el historial de tus citas y cumplir la ley. Después los eliminamos
        o anonimizamos. Los códigos de verificación vencen a los pocos minutos.
      </Parrafo>
    ),
  },
  {
    id: 'tus-derechos',
    titulo: 'Tus derechos y cómo ejercerlos',
    contenido: (
      <>
        <Parrafo>
          Puedes pedirnos conocer, actualizar o corregir tus datos, pedir que los eliminemos o retirar tu autorización.
          Escríbenos al correo de contacto y te respondemos en los plazos de ley (consultas: 10 días hábiles; reclamos: 15
          días hábiles). También puedes quejarte ante la Superintendencia de Industria y Comercio.
        </Parrafo>
      </>
    ),
  },
  {
    id: 'mas-informacion',
    titulo: 'Más información',
    contenido: (
      <Lista
        items={[
          {
            key: 'datos',
            contenido: (
              <>
                <EnlaceLegal to={RUTAS_LEGALES.datos}>{NOMBRES_LEGALES.datos}</EnlaceLegal>: el texto completo, con
                finalidades, derechos y procedimientos.
              </>
            ),
          },
          {
            key: 'cookies',
            contenido: (
              <>
                <EnlaceLegal to={RUTAS_LEGALES.cookies}>{NOMBRES_LEGALES.cookies}</EnlaceLegal>: qué guarda el sitio en tu
                navegador y cómo cambiar tu decisión.
              </>
            ),
          },
        ]}
      />
    ),
  },
]

const PoliticaPrivacidad = () => (
  <PaginaLegal
    titulo={NOMBRES_LEGALES.privacidad}
    descripcion="Qué datos pide Black Iron Barbers al reservar, para qué los usa, con quién los comparte y cómo ejercer tus derechos."
    secciones={SECCIONES}
  />
)

export default PoliticaPrivacidad
