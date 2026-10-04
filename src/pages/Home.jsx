import Hero from '../components/sections/Hero';
import ReservaATuManera from '../components/sections/ReservaATuManera';
import NuestrosColaboradores from '../components/sections/NuestrosColaboradores';
import Estadisticas from '../components/sections/Estadisticas';
import Testimonios from '../components/sections/Testimonios';
import ComeAndTry from '../components/sections/ComeAndTry';
import NuestrosServicos from '../components/sections/NuestrosServicos';

const Home = () => {
  return (
    <>
      <Hero />
      <ReservaATuManera />
      <NuestrosColaboradores />
      <Estadisticas />
      <Testimonios />
      <ComeAndTry />
      <NuestrosServicos />
    </>
  );
};

export default Home;
