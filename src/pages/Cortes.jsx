import { GoClockFill } from "react-icons/go";
import { FaMoneyCheck } from "react-icons/fa";
import { IoIosArrowDown } from "react-icons/io";
import { IoIosArrowUp } from "react-icons/io";
import { RxScissors } from "react-icons/rx";

const Cortes = () => {
  return (
    <>
        <div className='grid justify-center items-center py-3 bg-linear-to-br from-zinc-800 to-amber-600'>
            <h1 className='flex items-center justify-center text-white py-3 font-bold font-cinzel text-3xl lg:text-6xl'>NUESTRA CARTA DE SERVICIOS</h1>
            <h1 className='flex justify-center font-bold font-cinzel tracking-wide text-3xl lg:text-5xl mx-2 text-white py-5'>Barberias</h1>
                <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-center py-2 text-left p-2'>

                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>SERVICIO DE BARBA TRADICIONAL</h1>
                            <p className='flex items-center gap-2'><GoClockFill />45 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$48.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MASCARILLA BLACK MASK COMPLETA</h1>
                            <p className='flex items-center gap-2'><GoClockFill />45 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$69.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>BLACK MASK VAPOR</h1>
                            <p className='flex items-center gap-2'><GoClockFill />45 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$42.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>BARBA CON VAPOR</h1>
                            <p className='flex items-center gap-2'><GoClockFill />45 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$55.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>CERA</h1>
                            <p className='flex items-center gap-2'><GoClockFill />15 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$22.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>BARBA CON CERA</h1>
                            <p className='flex items-center gap-2'><GoClockFill />45 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$65.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>CERA COMPLETA</h1>
                            <p className='flex items-center gap-2'><GoClockFill />25 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$40.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>TINTURA BARABA BIGEN</h1>
                            <p className='flex items-center gap-2'><GoClockFill />30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$58.000</span></p>
                        </div>

                </div>  

                <h1 className='flex justify-center font-bold font-cinzel tracking-wide text-3xl lg:text-5xl mx-2 text-white py-5'>Cortes</h1>
                <div className='grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-4 items-center py-2 text-left p-2'>
                    
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>CORTE CLASICO</h1>
                            <p className='flex items-center gap-2'><GoClockFill />35 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$55.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>CORTE Y BARBA TRADICIONAL</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$103.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>CORTE Y BARBA CON VAPOR</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$110.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>CORTE BONO EMPRESARIAL</h1>
                            <p className='flex items-center gap-2'><GoClockFill />20 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$55.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>CORTE PREMIUM</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$100.000</span></p>
                        </div>
                </div>

                <h1 className='flex justify-center font-bold font-cinzel tracking-wide text-3xl lg:text-5xl mx-2 text-white py-5'>Uñas</h1>
                <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-center py-2 text-left p-2'>

                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MANICURE TRADICIONAL</h1>
                            <p className='flex items-center gap-2'><GoClockFill />30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$30.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>PEDICURE TRADICIONAL</h1>
                            <p className='flex items-center gap-2'><GoClockFill />45 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$40.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MANICURE POLISH</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$42.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>PEDICURE POLISH</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$42.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MANICURE CON HIDRATACION PARAFINA</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$75.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>PEDICURE CON HIDRATACION PARAFINA</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$85.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MANICURE SEMIPERMANENTE</h1>
                            <p className='flex items-center gap-2'><GoClockFill />2 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$64.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>RETIRO ESMALTE SEMIPERMANENTE</h1>
                            <p className='flex items-center gap-2'><GoClockFill />45 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$13.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>SPA DE MANOS</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$40.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>SPAN DE PIES</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$40.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>JELLY SPA PARA PIES</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$30.000</span></p>
                        </div>
                    </div>

                <h1 className='flex justify-center font-bold font-cinzel tracking-wide text-3xl lg:text-5xl mx-2 text-white py-5'>Barberias</h1>
                <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-center py-2 text-left p-2'>

                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>PEINADO Y SHAMPOO</h1>
                            <p className='flex items-center gap-2'><GoClockFill />15 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$25.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>SERVICIO DE KERATINA CORTO</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h|<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>190.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>SERVICIO DE KERATINA LARGO</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$245.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>TINTURA PARA EL CABELLO</h1>
                            <p className='flex items-center gap-2'><GoClockFill />2 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$250.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>AMPOLLETA ANTI CAÍDA O ANTI CASPA</h1>
                            <p className='flex items-center gap-2'><GoClockFill />30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$35.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>TINTURA RAYITOS LARGOS</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$300.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>SEMIPERMANENTE CORTO</h1>
                            <p className='flex items-center gap-2'><GoClockFill />2 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$250.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>SEMIPERMANENTE LARGO</h1>
                            <p className='flex items-center gap-2'><GoClockFill />2 h|<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$300.000</span></p>
                        </div>
                    </div>

                <h1 className='flex justify-center font-bold font-cinzel tracking-wide text-3xl lg:text-5xl mx-2 text-white py-5'>Cejas</h1>
                <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-center py-2 text-left p-2'>

                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>DEPILACIÓN DE CEJAS</h1>
                            <p className='flex items-center gap-2'><GoClockFill />15 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$25.000</span></p>
                        </div>
                    </div>  

                <h1 className='flex justify-center font-bold font-cinzel tracking-wide text-3xl lg:text-5xl mx-2 text-white py-5'>Mascarillas</h1>
                <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-center py-2 text-left p-2'>

                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>BLACK MASK TRADICIONAL</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$35.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MASCARILLA BLACK MASK COMPLETA </h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h|<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$63.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MASCARILLA COLÁGENO</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$35.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MASCARILLA LED 3 COLORES</h1>
                            <p className='flex items-center gap-2'><GoClockFill />45 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$63.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>DEPILACIÓN CON HILO Y CONTORNO FACIAL</h1>
                            <p className='flex items-center gap-2'><GoClockFill />15 min|<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$30.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>SPA FACIAL</h1>
                            <p className='flex items-center gap-2'><GoClockFill />45 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$85.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MASCARILLA DORADA CON VAPOR</h1>
                            <p className='flex items-center gap-2'><GoClockFill />45 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$45.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MASCARILLA COLÁGENO Y CAVIAR</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$45.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>SPA CÁSMARA</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$310.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>SPA FACIAL ANTIESTRÉS</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$140.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MASCARILLA RENOVACIÓN CELULAR</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$86.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MASCARILLA ANTIEDAD</h1>
                            <p className='flex items-center gap-2'><GoClockFill />40 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$110.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MASCARILLA MAGNETICA</h1>
                            <p className='flex items-center gap-2'><GoClockFill />15 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$160.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1>MASCARILLA 2 EN 1 CON VITAMINA B5</h1>
                            <p className='flex items-center gap-2'><GoClockFill />30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$80.000</span></p>
                        </div>
                    </div>

                <h1 className='flex justify-center font-bold font-cinzel tracking-wide text-3xl lg:text-5xl mx-2 text-white py-5'>Combos</h1> 
                <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-center py-2 text-left p-2'>

                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1 className='flex items-center gap-2'><RxScissors /> CORTE + SPA FACIAL</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$140.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1 className='flex items-center gap-2'><RxScissors /> CORTE + SPA ANTIESTRÉS</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$190.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1 className='flex items-center gap-2'><RxScissors /> CORTE + RENOVACIÓN</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$135.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1 className='flex items-center gap-2'><RxScissors /> CORTE + CÁSMARA MAGNÉTICA</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$210.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1 className='flex items-center gap-2'><RxScissors /> CORTE + MASCARILLA DORADA VAPOR</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$130.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1 className='flex items-center gap-2'><RxScissors /> CORTE + BARBA TRADICIONAL + SPA FACIAL</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$185.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1 className='flex items-center gap-2'><RxScissors /> CORTE + BARBA VAPOR + SPA ANTIESTRÉS</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$245.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1 className='flex items-center gap-2'><RxScissors /> CORTE + BARBA VAPOR + CÁSMARA MAGNÉTICA</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 45 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$265.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1 className='flex items-center gap-2'><RxScissors /> CORTE + BARBA VAPOR + RENOVACIÓN</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$190.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1 className='flex items-center gap-2'><RxScissors /> CORTE + BARBA VAPOR + MASCARILLA DORADA</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$195.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1 className='flex items-center gap-2'><RxScissors /> CORTE + BARBA TRADICIONAL + MASCARILLA</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h 30 min |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$185.000</span></p>
                        </div>
                        <div className='bg-white rounded-2xl p-5 shadow-lg hover:-translate-y-1 transition-all duration-300'>
                            <h1 className='flex items-center gap-2'><RxScissors /> CORTE + BARBA VAPOR + MASCARILLA  ANTIEDAD</h1>
                            <p className='flex items-center gap-2'><GoClockFill />1 h |<FaMoneyCheck className='text-[#d4af37]'/> <span className='text-black font-bold'>$210.000</span></p>
                        </div>
                </div>
            </div>
    </>
  )
}

export default Cortes
