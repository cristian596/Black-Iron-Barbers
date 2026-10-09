// Íconos de línea de un solo color (currentColor), decorativos: el texto de cada beneficio ya lo dice todo.
const RUTAS = {
  tijera: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.12 8.12 20 20M14.8 9.2 20 4M8.12 15.88 12 12" />
    </>
  ),
  copa: (
    <>
      <path d="M5 4h14l-7 8z" />
      <path d="M12 12v8M8 20h8" />
    </>
  ),
  mando: (
    <>
      <path d="M6 12h4M8 10v4" />
      <circle cx="15" cy="13" r="1" />
      <circle cx="18" cy="11" r="1" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59C2.6 9.42 2 14.46 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 16h4.34a2 2 0 0 1 1.41.59L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.55-.6-6.58-.69-7.26A4 4 0 0 0 17.32 5z" />
    </>
  ),
}

const IconoExperiencia = ({ nombre, className = 'size-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    {RUTAS[nombre]}
  </svg>
)

export default IconoExperiencia
