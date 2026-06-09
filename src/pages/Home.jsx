import Promos from '../components/sections/Promos';
import Descripcion from '../components/sections/Descripcion';
import Agendarcita from '../components/sections/Agendarcita';
import ComeAndTry from '../components/sections/ComeAndTry';
import NuestrosServicos from '../components/sections/NuestrosServicos';
import NuestrosColaboradores from '../components/sections/NuestrosColaboradores';

const Home = () => {
  return (
    <>
      <Promos />
      <Descripcion />
      <Agendarcita />
      <ComeAndTry />
      <NuestrosServicos/>
      <NuestrosColaboradores/>
    </>
  );
};

export default Home;