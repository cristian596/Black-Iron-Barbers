import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useConsentimiento } from '../../hooks/useConsentimiento'
import { RUTAS_LEGALES } from '../../data/legal'
import { abrirPanelCookies, guardarConsentimiento } from '../../utils/consentimiento'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, FOCO } from './estilosCookies'

// Atributo que los elementos fijos de la web pública (WhatsApp, Inicio, barras de selección) usan para subir sobre el
// banner mientras está visible (variante [[data-cookies-banner]_&]:).
const ATRIBUTO_BANNER = 'data-cookies-banner'

// Aviso de la primera visita: no bloquea la página y desaparece al decidir. Aceptar y Rechazar pesan lo mismo.
const BannerCookies = () => {
  const { decision } = useConsentimiento()
  const visible = decision === null

  useEffect(() => {
    if (!visible) return undefined
    document.documentElement.setAttribute(ATRIBUTO_BANNER, '')
    return () => document.documentElement.removeAttribute(ATRIBUTO_BANNER)
  }, [visible])

  if (!visible) return null

  return (
    <section
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-oro/40 bg-zinc-950 text-white shadow-[0_-2px_8px_rgba(0,0,0,0.4)]"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-6 md:py-4">
        <p className="min-w-0 font-poppins text-sm text-zinc-200 md:flex-1">
          Usamos cookies necesarias para que el sitio funcione y, solo si lo aceptas, cookies analíticas de Google para
          entender cómo se usa. Más información en la{' '}
          <Link
            to={RUTAS_LEGALES.cookies}
            className={`underline decoration-oro/60 underline-offset-4 hover:text-oro ${FOCO}`}
          >
            Política de Cookies
          </Link>
          .
        </p>
        <div className="grid grid-cols-3 gap-2 md:flex md:shrink-0">
          <button
            type="button"
            onClick={() => guardarConsentimiento({ analiticas: true })}
            className={`${BOTON_PRIMARIO} px-2 md:px-5`}
          >
            Aceptar
          </button>
          <button
            type="button"
            onClick={() => guardarConsentimiento({ analiticas: false })}
            className={`${BOTON_PRIMARIO} px-2 md:px-5`}
          >
            Rechazar
          </button>
          <button type="button" onClick={abrirPanelCookies} className={`${BOTON_SECUNDARIO} px-2 md:px-5`}>
            Configurar
          </button>
        </div>
      </div>
    </section>
  )
}

export default BannerCookies
