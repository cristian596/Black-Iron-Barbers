import { useEffect } from 'react'
import { useState } from 'react'
import { CgArrowLongRightR } from "react-icons/cg";
import { PiStarFourFill } from "react-icons/pi";


const prhases = [
  "LA CIENCIA DETRAS DE LA IMAGEN",
  "SATISFACCIÓN GARANTIZADA O TE DEVOLVEMOS TU DINERO",
  "UNETE AL CLUB IRON"
]

const FixedFooter = () => {
const [currentSlider,setCurrentSlider] = useState(0)

    useEffect(()=>{
      const interval = setInterval(()=>{
        setCurrentSlider((prevIndex) => (prevIndex + 1) % prhases.length)
      }, 3000)

      return ()=> clearInterval(interval)
    }, [])
  return (
    <>
    <div className='flex justify-center items-center bg-linear-to-r from-[#d2a123]  to-[#e2bc58]  gap-2 p-1 sticky z-50 w-full'>
        <h1 className='text-black font-semibold text-xl p-1' key={currentSlider}>
          <span className='flex items-center gap-1 border-b-3 hover:scale-105 cursor-pointer'>
            <PiStarFourFill size={15}/>
            {prhases[currentSlider]}
            <CgArrowLongRightR />
            <PiStarFourFill size={15}/>
          </span>
          
        </h1>
    </div>
    </>
  )
}

export default FixedFooter
