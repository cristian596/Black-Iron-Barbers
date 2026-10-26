// Elementos que el sitio guarda en el navegador (localStorage, sessionStorage y cookies), para la tabla de la Política de
// Cookies. Debe coincidir con el código: si se añade o quita una clave de almacenamiento, se actualiza aquí.
//   token                     → context/AuthContext.jsx
//   seleccion-servicios       → utils/carrito.js
//   pulso-cliente-nuevo       → components/layout/BotonClienteNuevo.jsx
//   bienvenida-barbero-vista  → utils/bienvenida.js
//   consentimiento-cookies    → utils/consentimiento.js
// El sitio NO crea cookies propias; las únicas cookies son las de Google Analytics, y solo con consentimiento.
export const CATEGORIA_NECESARIA = 'Necesaria'
export const CATEGORIA_ANALITICA = 'Analítica'

export const ELEMENTOS_ALMACENAMIENTO = [
  {
    clave: 'consentimiento-cookies',
    tipo: 'localStorage',
    finalidad: 'Recuerda tu decisión sobre las cookies (versión de la política, si aceptas las analíticas y la fecha).',
    duracion: 'Hasta que la borres o cambie la versión de las políticas',
    categoria: CATEGORIA_NECESARIA,
  },
  {
    clave: 'seleccion-servicios',
    tipo: 'sessionStorage',
    finalidad: 'Guarda los servicios que elegiste mientras reservas, para no perderlos al cambiar de página.',
    duracion: 'Hasta que cierres la pestaña',
    categoria: CATEGORIA_NECESARIA,
  },
  {
    clave: 'pulso-cliente-nuevo',
    tipo: 'sessionStorage',
    finalidad: 'Recuerda que ya se animó el botón de cliente nuevo para no repetirlo en cada página.',
    duracion: 'Hasta que cierres la pestaña',
    categoria: CATEGORIA_NECESARIA,
  },
  {
    clave: 'token',
    tipo: 'localStorage',
    finalidad: 'Mantiene la sesión del personal y de la administración. Solo existe si alguien inicia sesión en el área privada.',
    duracion: 'Hasta cerrar la sesión o hasta que venza (8 horas)',
    categoria: CATEGORIA_NECESARIA,
  },
  {
    clave: 'bienvenida-barbero-vista',
    tipo: 'sessionStorage',
    finalidad: 'Recuerda que el personal ya vio la ventana de bienvenida en esta sesión. Solo existe en el área privada.',
    duracion: 'Hasta que cierres la pestaña',
    categoria: CATEGORIA_NECESARIA,
  },
  {
    clave: '_ga',
    tipo: 'Cookie de Google',
    finalidad: 'Google Analytics: distingue visitantes de forma anónima para contar visitas.',
    duracion: '2 años',
    categoria: CATEGORIA_ANALITICA,
  },
  {
    clave: '_ga_<ID>',
    tipo: 'Cookie de Google',
    finalidad: 'Google Analytics: mantiene el estado de la sesión de navegación.',
    duracion: '2 años',
    categoria: CATEGORIA_ANALITICA,
  },
]
