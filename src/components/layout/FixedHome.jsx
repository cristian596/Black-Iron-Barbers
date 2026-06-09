import React from 'react'
import { IoHomeOutline } from "react-icons/io5";
import { useNavigate } from 'react-router';

const FixedHome = () => {
    const navigate = useNavigate()
  return (
    <>
    <div className='md:hidden fixed bottom-32 right-4 z-50  rounded-2xl border bg-white'>
            <IoHomeOutline onClick={()=> navigate("/")} size={50} className='p-2 cursor-pointer active:scale-95 duration-300 hover:scale-105 '/> 
    </div>
    </>
  )
}

export default FixedHome
