const CartaBebidas = () => {
  return (
    <>
    <h1 className='sr-only'>Carta de bebidas</h1>
    <div className='grid md:grid-cols-2 bg-linear-to-br from-black/80 to-gray-400 justify-center'>
      <div className=''>
        <img src="/Carta/cocktails.jpg" alt="Selección de cócteles de la carta de bebidas" className='w-full h-full rounded-2xl' loading='lazy'/>
      </div>

      <div>
        <img src="/Carta/drinks.jpg" alt="Selección de bebidas sin alcohol de la carta" className='w-full h-full rounded-2xl' loading='lazy'/>
      </div>
      
    </div>
    </>
  )
}

export default CartaBebidas
