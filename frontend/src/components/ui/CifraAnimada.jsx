import useContarAlVer from '../../hooks/useContarAlVer'
import { formatearCifra } from '../../utils/conteo'

const CifraAnimada = ({ etiqueta, valor, prefijo = '', sufijo = '', activo, retraso = 0 }) => {
  const actual = useContarAlVer(valor, { activo, retraso })
  const final = formatearCifra({ prefijo, valor, sufijo })

  return (
    <div className='flex flex-col items-center gap-1'>
      {/* Lectores de pantalla: solo el valor final, nunca los intermedios */}
      <span className='sr-only'>{final} {etiqueta}</span>

      {/* El valor final invisible reserva el ancho; el número animado va encima */}
      <span aria-hidden='true' className='grid justify-items-center font-cinzel text-4xl font-bold text-oro lg:text-5xl'>
        <span className='invisible col-start-1 row-start-1'>{final}</span>
        <span data-testid='cifra-animada' className='col-start-1 row-start-1'>
          {formatearCifra({ prefijo, valor: actual, sufijo })}
        </span>
      </span>
      <span aria-hidden='true' className='font-poppins text-sm uppercase tracking-widest text-zinc-400'>
        {etiqueta}
      </span>
    </div>
  )
}

export default CifraAnimada
