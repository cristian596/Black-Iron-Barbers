// Insignia circular con aro dorado. `className` define el tamaño (el logo llena el círculo).
const InsigniaLogo = ({ className = 'size-20' }) => (
  <div className={`rounded-full bg-linear-to-br from-[#f0d878] via-oro to-[#8a6d1a] p-0.5 shadow-lg shadow-oro/20 ${className}`}>
    <div className="size-full overflow-hidden rounded-full bg-black">
      <img src="/Login/logo.jpg" alt="Logo de Black Iron Barbers" className="size-full scale-110 object-cover" />
    </div>
  </div>
)

export default InsigniaLogo
