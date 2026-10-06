import { ordenarEmpleados } from './empleados'

// Utilidades de la sección "Nuestro Equipo" del inicio.

const cargoDe = (barbero) => (barbero.cargo ?? '').trim()

// Equipo en orden alfabético en español (convención del proyecto: "Ángel" antes de "Boby").
export const ordenarEquipo = ordenarEmpleados

// Cargos distintos con su conteo, generados de los datos reales: del más numeroso al menos y, a igualdad, alfabético.
// Quien no tiene cargo no genera chip (sigue apareciendo en "Todos").
export const cargosDelEquipo = (barberos) => {
  const conteo = new Map()
  barberos.forEach((barbero) => {
    const cargo = cargoDe(barbero)
    if (cargo) conteo.set(cargo, (conteo.get(cargo) ?? 0) + 1)
  })
  return [...conteo]
    .map(([cargo, total]) => ({ cargo, total }))
    .sort((a, b) => b.total - a.total || a.cargo.localeCompare(b.cargo, 'es'))
}

// `cargo` null = todos.
export const filtrarPorCargo = (barberos, cargo) =>
  cargo ? barberos.filter((barbero) => cargoDe(barbero) === cargo) : barberos

// Reserva con el barbero ya elegido (el paso Barbero lo lee de ?barbero=) o sin él ("Cualquier barbero").
export const enlaceReserva = (barbero) => (barbero ? `/reservar-corte?barbero=${barbero.id}` : '/reservar-corte')
