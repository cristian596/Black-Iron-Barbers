import { Link } from 'react-router-dom'

// Piezas de texto de las páginas legales (párrafos, listas y enlaces con el mismo estilo).
export const Parrafo = ({ children }) => (
  <p className="mt-3 font-poppins text-base leading-relaxed text-zinc-300">{children}</p>
)

export const Lista = ({ items }) => (
  <ul className="mt-3 list-disc space-y-2 pl-6 font-poppins text-base leading-relaxed text-zinc-300 marker:text-oro">
    {items.map((item) => (
      <li key={typeof item === 'string' ? item : item.key}>{typeof item === 'string' ? item : item.contenido}</li>
    ))}
  </ul>
)

export const Subtitulo = ({ children }) => (
  <h3 className="mt-6 font-poppins text-lg font-semibold text-white">{children}</h3>
)

export const EnlaceLegal = ({ to, children }) => (
  <Link
    to={to}
    className="text-oro underline decoration-oro/60 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro"
  >
    {children}
  </Link>
)
