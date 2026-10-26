import DatosResponsable from '../../components/legal/DatosResponsable'
import PaginaLegal from '../../components/legal/PaginaLegal'
import { EnlaceLegal, Lista, Parrafo } from '../../components/legal/Texto'
import { LEGAL, NOMBRES_LEGALES, RUTAS_LEGALES } from '../../data/legal'

const PROVEEDORES = [
  'Alojamiento del servidor (back-end) y de la base de datos donde se guardan las reservas.',
  'Envío de correo transaccional (código de verificación, confirmaciones y recordatorios de cita).',
  'Alojamiento del sitio web (Cloudflare), que recibe tus visitas y conexiones.',
  'Google (Google Analytics), solo si aceptas las cookies analíticas, para medir el uso del sitio de forma agregada; además, el sitio carga tipografías desde Google Fonts.',
]

const DERECHOS = [
  'Conocer, actualizar y rectificar tus datos personales.',
  'Solicitar prueba de la autorización que nos diste.',
  'Ser informado, previa solicitud, del uso que se ha dado a tus datos.',
  'Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley, una vez agotado el trámite de consulta o reclamo ante nosotros.',
  'Revocar la autorización y solicitar la supresión de tus datos cuando no se respeten los principios, derechos y garantías legales, y siempre que no exista un deber legal o contractual de conservarlos.',
  'Acceder de forma gratuita a tus datos personales que hayan sido objeto de tratamiento.',
]

const SECCIONES = [
  {
    id: 'responsable',
    titulo: 'Responsable del tratamiento',
    contenido: (
      <>
        <Parrafo>
          {LEGAL.nombreComercial} (en adelante, «nosotros») es el responsable del tratamiento de los datos personales que
          recogemos a través de este sitio web, conforme a la Ley 1581 de 2012 y sus normas reglamentarias (Decreto 1074 de
          2015). Estos son nuestros datos de contacto:
        </Parrafo>
        <DatosResponsable />
      </>
    ),
  },
  {
    id: 'datos',
    titulo: 'Datos que recolectamos',
    contenido: (
      <>
        <Parrafo>Recolectamos únicamente los datos necesarios para prestar el servicio:</Parrafo>
        <Lista
          items={[
            'Datos de la reserva: nombre, correo electrónico y teléfono celular de quien reserva.',
            'Datos de la cita: servicios elegidos, profesional, fecha, hora, duración, precio y estado (pendiente, completada o cancelada), con su historial.',
            'Código de verificación del correo: lo generamos y te lo enviamos para comprobar que el correo es tuyo; vence a los pocos minutos.',
            'Datos de las cuentas del personal y de la administración: usuario, contraseña (guardada de forma cifrada), nombre y foto de perfil del panel.',
            'Datos técnicos mínimos de navegación, como tu dirección IP, que se usan para la seguridad del sitio y para limitar abusos.',
          ]}
        />
        <Parrafo>
          No recolectamos datos sensibles (los que afectan tu intimidad o pueden generar discriminación, como salud, origen
          racial, orientación sexual, convicciones o datos biométricos). Si una asesoría de imagen te lleva a compartirnos
          alguno, no es obligatorio y no lo registramos en el sitio.
        </Parrafo>
      </>
    ),
  },
  {
    id: 'finalidades',
    titulo: 'Finalidades del tratamiento',
    contenido: (
      <>
        <Parrafo>Usamos tus datos únicamente para estas finalidades:</Parrafo>
        <Lista
          items={[
            'Gestionar y confirmar tus reservas, asignar el profesional y administrar la agenda.',
            'Enviarte el código de verificación del correo, la confirmación de la cita, avisos de cambios o cancelaciones y un recordatorio antes de la cita.',
            'Atender tus consultas, solicitudes y reclamos.',
            'Controlar que la asesoría gratuita se use una sola vez por persona.',
            'Mantener el historial del servicio y cumplir obligaciones legales y contables.',
            'Mejorar el servicio mediante analítica agregada, solo si aceptas las cookies analíticas.',
          ]}
        />
        <Parrafo>No usamos tus datos con fines publicitarios ni los vendemos.</Parrafo>
      </>
    ),
  },
  {
    id: 'autorizacion',
    titulo: 'Autorización y su prueba',
    contenido: (
      <>
        <Parrafo>
          Tratamos tus datos con tu autorización previa, expresa e informada. La otorgas al marcar la casilla «He leído y
          acepto el tratamiento de mis datos personales» del formulario de reserva, antes de que te enviemos el código de
          verificación y de que se cree la cita. Sin esa autorización no podemos gestionar la reserva.
        </Parrafo>
        <Parrafo>
          Conservamos la prueba de la autorización: junto con cada cita guardamos la fecha y hora en que la otorgaste. Tu
          decisión sobre las cookies se guarda en tu propio navegador (consulta la{' '}
          <EnlaceLegal to={RUTAS_LEGALES.cookies}>{NOMBRES_LEGALES.cookies}</EnlaceLegal>).
        </Parrafo>
      </>
    ),
  },
  {
    id: 'derechos',
    titulo: 'Derechos del titular',
    contenido: (
      <>
        <Parrafo>Como titular de los datos tienes derecho a:</Parrafo>
        <Lista items={DERECHOS} />
      </>
    ),
  },
  {
    id: 'menores',
    titulo: 'Niños, niñas y adolescentes',
    contenido: (
      <Parrafo>
        Los datos de niños, niñas y adolescentes solo se tratan con la autorización de su padre, madre o representante legal
        y respetando el interés superior del menor y sus derechos fundamentales. Si la reserva es para un menor de edad, debe
        hacerla su representante legal, que es quien da la autorización. Si detectamos que un menor registró datos sin ella,
        los suprimiremos.
      </Parrafo>
    ),
  },
  {
    id: 'proveedores',
    titulo: 'Encargados y proveedores',
    contenido: (
      <>
        <Parrafo>
          Para operar el sitio nos apoyamos en proveedores que tratan datos por nuestra cuenta y bajo nuestras instrucciones
          (encargados) o que prestan servicios de infraestructura:
        </Parrafo>
        <Lista items={PROVEEDORES} />
        <Parrafo>
          Algunos de estos proveedores pueden tratar los datos en servidores ubicados en otros países, incluido Estados
          Unidos. Lo hacemos con proveedores que ofrecen garantías razonables de seguridad y confidencialidad. No vendemos
          tus datos ni los cedemos a terceros para fines propios de ellos.
        </Parrafo>
      </>
    ),
  },
  {
    id: 'seguridad',
    titulo: 'Medidas de seguridad',
    contenido: (
      <Parrafo>
        Aplicamos medidas técnicas, humanas y administrativas razonables para proteger tus datos contra pérdida, acceso o
        uso no autorizado: conexiones cifradas, contraseñas guardadas de forma cifrada, acceso al panel solo con cuenta
        autorizada y por roles, y límites a los intentos abusivos. Ninguna medida es infalible; si ocurre un incidente que
        afecte tus datos, actuaremos conforme a la ley.
      </Parrafo>
    ),
  },
  {
    id: 'consultas',
    titulo: 'Consultas y reclamos',
    contenido: (
      <>
        <Parrafo>
          Para ejercer tus derechos escríbenos al correo indicado en la sección «Responsable del tratamiento», con tu nombre,
          el medio de contacto, la descripción de tu solicitud y, si es un reclamo, los hechos y lo que pides.
        </Parrafo>
        <Lista
          items={[
            {
              key: 'consultas',
              contenido:
                'Consultas: las respondemos en máximo 10 días hábiles desde su recibo. Si no es posible, te avisaremos el motivo y la nueva fecha, que no superará 5 días hábiles adicionales.',
            },
            {
              key: 'reclamos',
              contenido:
                'Reclamos (corrección, actualización, supresión o revocatoria): los resolvemos en máximo 15 días hábiles desde su recibo completo. Si no es posible, te informaremos el motivo y la nueva fecha, que no superará 8 días hábiles adicionales. Si el reclamo está incompleto, te pediremos que lo completes dentro de los 5 días siguientes.',
            },
          ]}
        />
        <Parrafo>
          Si no estás conforme con la respuesta, puedes presentar una queja ante la Superintendencia de Industria y Comercio.
        </Parrafo>
      </>
    ),
  },
  {
    id: 'conservacion',
    titulo: 'Tiempo de conservación',
    contenido: (
      <Parrafo>
        Conservamos tus datos mientras sean necesarios para las finalidades descritas, para mantener el historial de las
        citas y para cumplir obligaciones legales, contables o contractuales. Cuando dejen de serlo, los suprimimos o los
        anonimizamos. Puedes pedir la supresión antes, salvo que exista un deber legal de conservarlos. Los códigos de
        verificación vencen a los pocos minutos y no se conservan.
      </Parrafo>
    ),
  },
  {
    id: 'vigencia',
    titulo: 'Vigencia y cambios',
    contenido: (
      <Parrafo>
        Esta política rige desde su fecha de actualización y mientras sigamos tratando datos personales. Si la modificamos de
        forma sustancial, publicaremos la nueva versión en esta página con su fecha y, cuando la ley lo exija, volveremos a
        pedir tu autorización. Para un resumen en lenguaje sencillo, consulta la{' '}
        <EnlaceLegal to={RUTAS_LEGALES.privacidad}>{NOMBRES_LEGALES.privacidad}</EnlaceLegal>.
      </Parrafo>
    ),
  },
]

const TratamientoDatos = () => (
  <PaginaLegal
    titulo={NOMBRES_LEGALES.datos}
    descripcion="Cómo Black Iron Barbers trata tus datos personales conforme a la Ley 1581 de 2012: finalidades, derechos, consultas y reclamos."
    secciones={SECCIONES}
  />
)

export default TratamientoDatos
