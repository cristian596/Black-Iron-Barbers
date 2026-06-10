import React from 'react'

const CartaBebidas = () => {
  return (
    <>
    <div className='grid lg:grid-cols-3 bg-linear-to-br from-black/80 to-gray-400'>
      <div className='relative'>
        <h1>Imagen grande y titulo del menu</h1>
        <h1>Imagen grande y titulo del menu</h1>
        <h1>Imagen grande y titulo del menu</h1>
        <h1>Imagen grande y titulo del menu</h1>
        <h1>Imagen grande y titulo del menu</h1>
        <h1>Imagen grande y titulo del menu</h1>
        <h1>Imagen grande y titulo del menu</h1><h1>Imagen grande y titulo del menu</h1>

        <div className=''>
          <img src="/Carta/coctels.png" alt="" />
        </div>
      </div>

      <div>
        <h1>Bebidas con alcohol</h1>
      </div>
      
      <div>
        <h1>Bebidas sin alcohol</h1>
      </div>
    </div>
    </>
  )
}

export default CartaBebidas
