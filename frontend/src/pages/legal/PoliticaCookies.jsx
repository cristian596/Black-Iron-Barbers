import OpcionesCookies from '../../components/cookies/OpcionesCookies'
import PaginaLegal from '../../components/legal/PaginaLegal'
import { EnlaceLegal, Lista, Parrafo } from '../../components/legal/Texto'
import { ELEMENTOS_ALMACENAMIENTO } from '../../data/almacenamiento'
import { NOMBRES_LEGALES, RUTAS_LEGALES } from '../../data/legal'

const COLUMNAS = [
  { id: 'clave', etiqueta: 'Nombre o clave' },
  { id: 'tipo', etiqueta: 'Tipo' },
  { id: 'finalidad', etiqueta: 'Finalidad' },
  { id: 'duracion', etiqueta: 'Duración' },
  { id: 'categoria', etiqueta: 'Categoría' },
]

// Tabla que en pantallas pequeñas se apila (cada fila es una tarjeta con sus etiquetas). Los roles ARIA son explícitos
// porque cambiar el `display` de los elementos de tabla hace que algunos navegadores pierdan su semántica.
const TablaAlmacenamiento = () => (
  <div role="table" aria-label="Elementos que guarda el sitio en tu navegador" className="mt-4 text-sm md:table md:w-full">
    <div role="rowgroup" className="sr-only md:not-sr-only md:table-header-group">
      <div role="row" className="md:table-row">
        {COLUMNAS.map(({ id, etiqueta }) => (
          <div
            key={id}
            role="columnheader"
            className="px-3 py-2 text-left font-semibold text-oro md:table-cell md:border-b md:border-oro/40"
          >
            {etiqueta}
          </div>
        ))}
      </div>
    </div>
    <div role="rowgroup" className="md:table-row-group">
      {ELEMENTOS_ALMACENAMIENTO.map((elemento) => (
        <div
          key={elemento.clave}
          role="row"
          className="mb-3 block rounded-xl border border-white/10 bg-white/5 p-3 md:mb-0 md:table-row md:rounded-none md:border-0 md:bg-transparent md:p-0"
        >
          {COLUMNAS.map(({ id, etiqueta }) => (
            <div
              key={id}
              role="cell"
              className={`flex flex-col gap-0.5 py-1 text-zinc-200 md:table-cell ${
                id === 'tipo' || id === 'categoria' ? 'md:whitespace-nowrap' : 'wrap-anywhere'
              } md:border-b md:border-white/10 md:px-3 md:py-3 md:align-top`}
            >
              <span aria-hidden="true" className="text-xs font-semibold uppercase tracking-wide text-zinc-400 md:hidden">
                {etiqueta}
              </span>
              <span className={id === 'clave' ? 'font-mono text-white' : undefined}>{elemento[id]}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
)

const SECCIONES = [
  {
    id: 'que-son',
    titulo: 'Qué son las cookies y el almacenamiento local',
    contenido: (
      <>
        <Parrafo>
          Las cookies son pequeños archivos que un sitio guarda en tu navegador. El almacenamiento local (localStorage y
          sessionStorage) cumple una función parecida: guarda datos en tu dispositivo, de forma permanente o hasta que cierras
          la pestaña. Esta política explica cuáles usa este sitio, para qué y cómo puedes controlarlos.
        </Parrafo>
      </>
    ),
  },
  {
    id: 'que-usamos',
    titulo: 'Qué usa este sitio',
    contenido: (
      <>
        <Parrafo>
          El sitio no crea cookies propias. Guarda unos pocos datos necesarios en tu navegador y, solo si aceptas las
          analíticas, Google Analytics instala sus cookies. Hay dos categorías:
        </Parrafo>
        <Lista
          items={[
            'Necesarias: hacen que el sitio funcione (tu selección de servicios, la sesión del personal, tu decisión sobre las cookies). Siempre están activas.',
            'Analíticas: nos dicen, de forma agregada, qué páginas se visitan. Solo se activan si las aceptas.',
          ]}
        />
        <TablaAlmacenamiento />
        <Parrafo>
          Además, para mostrar las tipografías, tu navegador solicita los archivos de fuentes a Google Fonts, lo que implica
          que Google recibe tu dirección IP; esa solicitud no instala cookies.
        </Parrafo>
      </>
    ),
  },
  {
    id: 'analiticas',
    titulo: 'Analítica con Google',
    contenido: (
      <Parrafo>
        Si aceptas las cookies analíticas, cargamos Google Analytics 4 y registramos las páginas que visitas (solo la ruta,
        sin parámetros de búsqueda ni datos personales; nunca registramos las áreas privadas). Google puede tratar esa
        información en servidores de otros países, incluido Estados Unidos. Si no las aceptas, no cargamos el script de Google
        ni hacemos ninguna solicitud a sus servidores de analítica.
      </Parrafo>
    ),
  },
  {
    id: 'cambiar-consentimiento',
    titulo: 'Cambiar o retirar tu consentimiento',
    contenido: (
      <>
        <Parrafo>
          Puedes cambiar tu decisión cuando quieras aquí mismo o con el botón «Configuración de cookies» del pie de página.
          Al retirar el consentimiento dejamos de enviar datos a Google y borramos sus cookies; el cambio se completa del todo
          al recargar la página.
        </Parrafo>
        <div className="mt-4">
          <OpcionesCookies idBase="cookies-pagina" />
        </div>
      </>
    ),
  },
  {
    id: 'bloquear',
    titulo: 'Bloquear cookies desde el navegador',
    contenido: (
      <Parrafo>
        También puedes bloquear o borrar las cookies y el almacenamiento local desde la configuración de tu navegador. Si
        bloqueas el almacenamiento necesario, el sitio seguirá funcionando, pero no recordará tu selección de servicios al
        recargar y el personal no podrá mantener su sesión.
      </Parrafo>
    ),
  },
  {
    id: 'mas-informacion',
    titulo: 'Más información',
    contenido: (
      <Parrafo>
        Cómo tratamos tus datos personales está en la{' '}
        <EnlaceLegal to={RUTAS_LEGALES.datos}>{NOMBRES_LEGALES.datos}</EnlaceLegal> y en la{' '}
        <EnlaceLegal to={RUTAS_LEGALES.privacidad}>{NOMBRES_LEGALES.privacidad}</EnlaceLegal>.
      </Parrafo>
    ),
  },
]

const PoliticaCookies = () => (
  <PaginaLegal
    titulo={NOMBRES_LEGALES.cookies}
    descripcion="Qué cookies y almacenamiento local usa Black Iron Barbers, para qué sirven y cómo cambiar o retirar tu consentimiento."
    secciones={SECCIONES}
  />
)

export default PoliticaCookies
