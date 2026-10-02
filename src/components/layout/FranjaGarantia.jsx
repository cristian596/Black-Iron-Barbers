import { TbShieldCheck } from 'react-icons/tb'

const FranjaGarantia = () => {
  return (
    <div className='flex items-center justify-center gap-2 bg-black text-[#D4AF37] text-center text-xs sm:text-sm font-poppins font-semibold py-2 px-4'>
      <TbShieldCheck size={18} className='shrink-0' />
      <p>
        Garantía de satisfacción 100%: si tu corte no te convence, lo corregimos sin costo adicional.
      </p>
    </div>
  )
}

export default FranjaGarantia
