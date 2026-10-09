import { act, render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import PasoFechaHora from '../components/sections/reserva/PasoFechaHora'
import { ahoraBogota } from '../utils/fechas'
import { bloquePasado, generarBloques } from '../utils/bloquesHorarios'
import { obtenerDisponibilidad } from '../services/api'

vi.mock('../services/api', () => ({
  obtenerDisponibilidad: vi.fn(),
}))

// Instantes en UTC; Bogotá es UTC-5 todo el año (sin horario de verano). Hoy en Bogotá = 2026-10-09.
const HOY = '2026-10-09'
const FUTURA = '2026-10-12'
const a = (horaBogota) => new Date(`${HOY}T${horaBogota}:00-05:00`)

// Rejilla completa de inicios (30 min), como la que devuelve el back-end sin ocupación ni filtro de hora.
const TODAS = Array.from({ length: 20 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
// Lo que el back-end responde hoy a las 15:10: solo inicios posteriores al minuto actual.
const DESDE_1510 = TODAS.filter((h) => h > '15:10')

const botonBloque = (inicio) => screen.queryByRole('button', { name: new RegExp(`^${inicio}:00 – ${inicio + 1}:00`) })

const montar = (props = {}) =>
  render(
    <PasoFechaHora
      servicioIds={[1]}
      barberoId={null}
      fecha={HOY}
      hora=""
      onSeleccionarFecha={vi.fn()}
      onSeleccionarHora={vi.fn()}
      {...props}
    />
  )

// Se esperan las horas con act + microtareas (setTimeout real queda sin falsear para no trabar la promesa del mock).
const cargado = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('PasoFechaHora — bloques pasados de hoy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('hoy a las 15:10 oculta 10–11 … 14–15 y muestra 15–16 y los siguientes', async () => {
    vi.setSystemTime(a('15:10'))
    obtenerDisponibilidad.mockResolvedValue({ horas: DESDE_1510 })
    montar()
    await cargado()

    const grupo = await screen.findByRole('group', { name: /horas disponibles/i })
    expect(within(grupo).getAllByRole('button')).toHaveLength(5)
    for (const inicio of [10, 11, 12, 13, 14]) expect(botonBloque(inicio)).toBeNull()
    // 15–16 sigue: su inicio 15:30 es posterior al minuto actual (misma regla del back-end, sin antelación).
    for (const inicio of [15, 16, 17, 18, 19]) expect(botonBloque(inicio)).not.toBeNull()
    expect(within(grupo).queryAllByText('Completa')).toHaveLength(0)
  })

  it('el bloque actual desaparece cuando ya no queda ningún inicio posterior (15:30 → 15–16 fuera)', async () => {
    vi.setSystemTime(a('15:30'))
    obtenerDisponibilidad.mockResolvedValue({ horas: TODAS.filter((h) => h > '15:30') })
    montar()
    await cargado()

    expect(botonBloque(15)).toBeNull()
    expect(botonBloque(16)).not.toBeNull()
  })

  it('hoy a las 15:10 un bloque futuro totalmente ocupado sigue como "Completa"', async () => {
    vi.setSystemTime(a('15:10'))
    obtenerDisponibilidad.mockResolvedValue({ horas: DESDE_1510.filter((h) => !h.startsWith('16:')) })
    montar()
    await cargado()

    const ocupado = botonBloque(16)
    expect(ocupado).toHaveAttribute('aria-disabled', 'true')
    expect(ocupado).toHaveTextContent('Completa')
    expect(botonBloque(17)).not.toHaveAttribute('aria-disabled')
  })

  it('una fecha futura sigue mostrando los 10 bloques', async () => {
    vi.setSystemTime(a('15:10'))
    obtenerDisponibilidad.mockResolvedValue({ horas: ['10:00', '13:00'] })
    montar({ fecha: FUTURA })
    await cargado()

    const grupo = await screen.findByRole('group', { name: /horas disponibles/i })
    expect(within(grupo).getAllByRole('button')).toHaveLength(10)
    expect(within(grupo).getAllByText('Completa')).toHaveLength(8)
  })

  it('hoy a las 20:05 avisa "Ya no quedan horarios para hoy" (role="status") y no pinta bloques', async () => {
    vi.setSystemTime(a('20:05'))
    obtenerDisponibilidad.mockResolvedValue({ horas: [] })
    montar()
    await cargado()

    expect(screen.getByText('Ya no quedan horarios para hoy. Elige otra fecha.')).toHaveAttribute('role', 'status')
    expect(screen.queryByRole('group', { name: /horas disponibles/i })).toBeNull()
    // El resto del paso sigue funcionando: las fechas se pueden elegir.
    expect(screen.getByRole('group', { name: /fechas disponibles/i })).toBeInTheDocument()
  })

  it('a las 19:30 ya no queda ningún inicio posible: mensaje de día terminado', async () => {
    vi.setSystemTime(a('19:30'))
    obtenerDisponibilidad.mockResolvedValue({ horas: [] })
    montar()
    await cargado()

    expect(screen.getByText('Ya no quedan horarios para hoy. Elige otra fecha.')).toBeInTheDocument()
  })

  describe('zona horaria', () => {
    const TZ_ORIGINAL = globalThis.process.env.TZ
    afterEach(() => {
      if (TZ_ORIGINAL === undefined) delete globalThis.process.env.TZ
      else globalThis.process.env.TZ = TZ_ORIGINAL
    })

    it('con el navegador en otra zona, "hoy" y "ahora" siguen siendo los de America/Bogota', async () => {
      // En Tokio es 10 de octubre 05:10; en Bogotá sigue siendo 9 de octubre 15:10.
      globalThis.process.env.TZ = 'Asia/Tokyo'
      vi.setSystemTime(a('15:10'))
      expect(new Date().getDate()).toBe(10) // el reloj "del navegador" está en otro día
      expect(ahoraBogota()).toEqual({ fecha: HOY, minutos: 15 * 60 + 10 })

      obtenerDisponibilidad.mockResolvedValue({ horas: DESDE_1510 })
      montar()
      await cargado()

      expect(botonBloque(14)).toBeNull()
      expect(botonBloque(15)).not.toBeNull()
    })
  })

  describe('el tiempo avanza con la pantalla abierta', () => {
    it('al pasar un minuto, un bloque que se vuelve pasado desaparece', async () => {
      vi.setSystemTime(a('15:29'))
      obtenerDisponibilidad.mockResolvedValue({ horas: TODAS.filter((h) => h > '15:29') })
      montar()
      await cargado()
      expect(botonBloque(15)).not.toBeNull()

      act(() => {
        vi.advanceTimersByTime(60_000) // 15:30
      })
      expect(botonBloque(15)).toBeNull()
      expect(botonBloque(16)).not.toBeNull()
    })

    it('si la hora elegida ya pasó, limpia la selección y avisa con role="status"', async () => {
      vi.setSystemTime(a('15:29'))
      obtenerDisponibilidad.mockResolvedValue({ horas: TODAS.filter((h) => h > '15:29') })
      const onSeleccionarHora = vi.fn()
      const { rerender } = montar({ hora: '15:30', onSeleccionarHora })
      await cargado()
      expect(onSeleccionarHora).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(60_000) // 15:30: la hora elegida (15:30) ya no es posterior a "ahora"
      })
      expect(onSeleccionarHora).toHaveBeenCalledWith('')
      // El padre aplica la limpieza (hora vacía) y el paso muestra el aviso.
      rerender(
        <PasoFechaHora servicioIds={[1]} barberoId={null} fecha={HOY} hora="" onSeleccionarFecha={vi.fn()} onSeleccionarHora={onSeleccionarHora} />
      )
      expect(screen.getByRole('status')).toHaveTextContent('El horario que elegiste ya pasó')
    })

    it('al llegar el cierre aparece el mensaje de día terminado', async () => {
      vi.setSystemTime(a('19:29'))
      obtenerDisponibilidad.mockResolvedValue({ horas: ['19:30'] })
      montar()
      await cargado()
      expect(botonBloque(19)).not.toBeNull()

      act(() => {
        vi.advanceTimersByTime(60_000) // 19:30
      })
      expect(screen.getByText('Ya no quedan horarios para hoy. Elige otra fecha.')).toBeInTheDocument()
    })

    it('limpia el temporizador al desmontar', async () => {
      vi.setSystemTime(a('15:10'))
      obtenerDisponibilidad.mockResolvedValue({ horas: DESDE_1510 })
      const { unmount } = montar()
      await cargado()
      expect(vi.getTimerCount()).toBe(1)
      unmount()
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})

describe('utils: ahoraBogota y bloquePasado', () => {
  it('ahoraBogota da fecha y minutos de Bogotá, incluso cerca de medianoche UTC', () => {
    expect(ahoraBogota(new Date('2026-10-10T04:59:00Z'))).toEqual({ fecha: '2026-10-09', minutos: 23 * 60 + 59 })
    expect(ahoraBogota(new Date('2026-10-10T05:00:00Z'))).toEqual({ fecha: '2026-10-10', minutos: 0 })
  })

  it('un bloque está pasado cuando su último inicio posible (fin - 30 min) no es posterior a ahora', () => {
    const bloque = generarBloques().find((b) => b.clave === '15:00')
    expect(bloquePasado(bloque, 15 * 60 + 29)).toBe(false)
    expect(bloquePasado(bloque, 15 * 60 + 30)).toBe(true)
  })
})
