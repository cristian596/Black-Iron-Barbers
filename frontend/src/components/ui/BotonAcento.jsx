import { Link } from 'react-router-dom'

// Botón principal de las secciones de la Home: acento oro de la paleta (mismo lenguaje que el botón del hero).
const CLASES =
  'inline-flex min-h-12 max-w-full items-center justify-center rounded-full bg-oro px-8 py-3 text-center font-poppins font-semibold text-black shadow-lg shadow-oro/20 duration-300 hover:bg-[#e2bc58] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100'

const BotonAcento = ({ to, children, className = '' }) => (
  <Link to={to} className={`${CLASES} ${className}`.trim()}>
    {children}
  </Link>
)

export default BotonAcento
