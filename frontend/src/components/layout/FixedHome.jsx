import { IoHomeOutline } from "react-icons/io5";
import { useNavigate } from 'react-router-dom';

const FixedHome = () => {
    const navigate = useNavigate()
  return (
    <>
    <div className='md:hidden fixed bottom-28 right-3 z-50  rounded-2xl border bg-white'>
            <IoHomeOutline onClick={()=> navigate("/")} size={40} className='size-9 p-2 cursor-pointer active:scale-95 duration-300 hover:scale-105 '/>
    </div>
    </>
  )
}

export default FixedHome
