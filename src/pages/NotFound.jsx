import { Link } from 'react-router-dom'

const NotFound = () => {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="font-cinzel text-6xl font-bold text-mauve-800">404</h1>
      <p className="font-poppins text-xl text-mauve-700">
        La página que buscas no existe.
      </p>
      <Link
        to="/"
        className="mt-2 rounded-xl bg-black px-6 py-2 font-poppins font-semibold text-white active:scale-95 duration-200 hover:bg-gray-800"
      >
        Volver al inicio
      </Link>
    </div>
  )
}

export default NotFound
