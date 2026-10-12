import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import FixedWhatsapp from '../components/layout/FixedWhatsapp'
import {
  enlaceWhatsApp,
  numeroWhatsApp,
  MENSAJE_WHATSAPP_GENERAL,
  WHATSAPP_PLACEHOLDER,
} from '../data/negocio'

afterEach(() => vi.unstubAllEnvs())

describe('enlaceWhatsApp', () => {
  it('con VITE_WHATSAPP_NUMERO usa ese número y codifica el mensaje', () => {
    vi.stubEnv('VITE_WHATSAPP_NUMERO', '570000000000')
    expect(enlaceWhatsApp('¡Hola! ¿Qué tal?')).toBe(
      `https://wa.me/570000000000?text=${encodeURIComponent('¡Hola! ¿Qué tal?')}`
    )
  })

  it('limpia el número: solo quedan dígitos', () => {
    vi.stubEnv('VITE_WHATSAPP_NUMERO', ' +57 (000) 000-0000 ')
    expect(numeroWhatsApp()).toBe('570000000000')
  })

  it.each([[''], ['   '], ['changeme']])('sin variable válida (%j) usa el placeholder', (valor) => {
    vi.stubEnv('VITE_WHATSAPP_NUMERO', valor)
    expect(numeroWhatsApp()).toBe(WHATSAPP_PLACEHOLDER)
    expect(enlaceWhatsApp('hola')).toBe(`https://wa.me/${WHATSAPP_PLACEHOLDER}?text=hola`)
  })

  it('el código no contiene ningún número de teléfono (el placeholder no tiene dígitos)', () => {
    expect(WHATSAPP_PLACEHOLDER).not.toMatch(/\d/)
  })
})

describe('FixedWhatsapp', () => {
  it('usa el helper con el mensaje general', () => {
    vi.stubEnv('VITE_WHATSAPP_NUMERO', '570000000000')
    render(<FixedWhatsapp />)
    const enlace = screen.getByRole('link', { name: /WhatsApp/ })
    expect(enlace).toHaveAttribute('href', enlaceWhatsApp(MENSAJE_WHATSAPP_GENERAL))
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
