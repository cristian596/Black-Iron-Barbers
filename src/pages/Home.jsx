import Hero from '../components/sections/Hero';
import ReservaATuManera from '../components/sections/ReservaATuManera';
import Descripcion from '../components/sections/Descripcion';
import CatalogoServicios from '../components/sections/CatalogoServicios';
import NuestrosColaboradores from '../components/sections/NuestrosColaboradores';
import Agendarcita from '../components/sections/Agendarcita';
import ComeAndTry from '../components/sections/ComeAndTry';
import NuestrosServicos from '../components/sections/NuestrosServicos';

const Home = () => {
  return (
    <>
      <Hero />
      <ReservaATuManera />
      <Descripcion />
      <CatalogoServicios />
      <NuestrosColaboradores />
      <Agendarcita />
      <ComeAndTry />
      <NuestrosServicos />
    </>
  );
};

export default Home;
