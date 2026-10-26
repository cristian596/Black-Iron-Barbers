// Clases compartidas por el banner y las opciones de cookies (react-refresh pide que los componentes no exporten constantes).
export const FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro'

const BOTON = `min-h-11 cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold duration-200 motion-reduce:transition-none ${FOCO}`

export const BOTON_PRIMARIO = `${BOTON} bg-oro text-black hover:bg-[#e2bc58]`
export const BOTON_SECUNDARIO = `${BOTON} border border-zinc-500 text-white hover:border-oro hover:text-oro`
