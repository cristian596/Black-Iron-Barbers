import React from 'react'

const CartaBebidas = () => {
  return (
    <>
    <div className='grid md:grid-cols-2 bg-linear-to-br from-black/80 to-gray-400 justify-center'>
      <div className=''>
        <img src="/Carta/cocktails.jpg" alt="" className='w-full h-full rounded-2xl'/>
      </div>

      <div> 
        <img src="/Carta/drinks.jpg" alt="" className='w-full h-full rounded-2xl'/>
      </div>
      
    </div>
    </>
  )
}

export default CartaBebidas
