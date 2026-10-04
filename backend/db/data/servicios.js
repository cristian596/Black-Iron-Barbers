// Catálogo de servicios de la barbería: una categoría por bloque, en el orden en que se muestran.
// Dentro de cada categoría: original -> elite -> vip (de menor a mayor precio).
// `id` solo sirve para casar cada servicio con su descripción (descripciones.js); NO es el id de la base de datos.
// `clave` es el identificador ESTABLE de cada servicio y categoría: el seed y la migración casan las filas de la base
// por ella (columna clave_seed), así un servicio que el admin renombre no se vuelve a crear. Nunca la cambies una vez
// publicada; para un servicio nuevo usa una clave nueva.
// `duracion` está en minutos y se guarda como duracion_min.

export default [
  // 1. CORTES
  {
    categoria: "Cortes",
    slug: "cortes",
    clave: "cortes",
    servicios: [
      { id: 1, clave: "corte-militar", nombre: "Corte militar", tipo: "original", precio: 18000, duracion: 25 },
      { id: 2, clave: "corte-clasico", nombre: "Corte clásico", tipo: "original", precio: 18000, duracion: 30 },
      { id: 3, clave: "corte-infantil", nombre: "Corte infantil", tipo: "original", precio: 18000, duracion: 30 },
      { id: 4, clave: "corte-degradado-fade", nombre: "Corte degradado (Fade)", tipo: "elite", precio: 25000, duracion: 40 },
      { id: 5, clave: "corte-mullet", nombre: "Corte mullet", tipo: "elite", precio: 28000, duracion: 45 },
      { id: 6, clave: "corte-ejecutivo", nombre: "Corte ejecutivo", tipo: "elite", precio: 30000, duracion: 40 },
      { id: 7, clave: "corte-premium-con-asesoria-de-imagen", nombre: "Corte premium con asesoría de imagen", tipo: "vip", precio: 40000, duracion: 60 },
      { id: 8, clave: "corte-con-diseno-personalizado", nombre: "Corte con diseño personalizado", tipo: "vip", precio: 40000, duracion: 60 },
    ],
  },

  // 2. BARBA
  {
    categoria: "Barba",
    slug: "barba",
    clave: "barba",
    servicios: [
      { id: 9, clave: "perfilado-de-barba", nombre: "Perfilado de barba", tipo: "original", precio: 12000, duracion: 20 },
      { id: 10, clave: "afeitado-clasico", nombre: "Afeitado clásico", tipo: "original", precio: 15000, duracion: 25 },
      { id: 11, clave: "arreglo-y-definicion-de-barba", nombre: "Arreglo y definición de barba", tipo: "elite", precio: 20000, duracion: 30 },
      { id: 12, clave: "diseno-de-barba", nombre: "Diseño de barba", tipo: "elite", precio: 25000, duracion: 35 },
      { id: 13, clave: "ritual-vip-de-barba-con-toalla-caliente", nombre: "Ritual VIP de barba con toalla caliente", tipo: "vip", precio: 35000, duracion: 45 },
      { id: 14, clave: "diseno-premium-y-tratamiento-de-barba", nombre: "Diseño premium y tratamiento de barba", tipo: "vip", precio: 40000, duracion: 50 },
    ],
  },

  // 3. KERATINAS
  {
    categoria: "Keratinas",
    slug: "keratinas",
    clave: "keratinas",
    servicios: [
      { id: 15, clave: "keratina-express-antifrizz", nombre: "Keratina express antifrizz", tipo: "original", precio: 45000, duracion: 60 },
      { id: 16, clave: "keratina-cabello-corto", nombre: "Keratina cabello corto", tipo: "original", precio: 60000, duracion: 90 },
      { id: 17, clave: "keratina-cabello-medio", nombre: "Keratina cabello medio", tipo: "elite", precio: 90000, duracion: 120 },
      { id: 18, clave: "keratina-premium-con-hidratacion", nombre: "Keratina premium con hidratación", tipo: "elite", precio: 110000, duracion: 150 },
      { id: 19, clave: "keratina-cabello-largo", nombre: "Keratina cabello largo", tipo: "vip", precio: 130000, duracion: 180 },
      { id: 20, clave: "alisado-premium-y-reconstruccion-capilar", nombre: "Alisado premium y reconstrucción capilar", tipo: "vip", precio: 160000, duracion: 210 },
    ],
  },

  // 4. FACIALES
  {
    categoria: "Faciales",
    slug: "faciales",
    clave: "faciales",
    servicios: [
      { id: 21, clave: "exfoliacion-facial", nombre: "Exfoliación facial", tipo: "original", precio: 20000, duracion: 25 },
      { id: 22, clave: "limpieza-facial-basica", nombre: "Limpieza facial básica", tipo: "original", precio: 25000, duracion: 30 },
      { id: 23, clave: "mascarilla-hidratante", nombre: "Mascarilla hidratante", tipo: "elite", precio: 30000, duracion: 35 },
      { id: 24, clave: "limpieza-facial-profunda", nombre: "Limpieza facial profunda", tipo: "elite", precio: 45000, duracion: 50 },
      { id: 25, clave: "limpieza-facial-mascarilla-premium", nombre: "Limpieza facial + mascarilla premium", tipo: "vip", precio: 60000, duracion: 60 },
      { id: 26, clave: "tratamiento-facial-vip", nombre: "Tratamiento facial VIP", tipo: "vip", precio: 70000, duracion: 75 },
    ],
  },

  // 5. CORTES + BARBA
  // Los combos cuestan alrededor de un 7-10 % menos que la suma de sus partes
  // y duran algo menos que la suma de sus partes.
  {
    categoria: "Cortes + barba",
    slug: "cortes-barba",
    clave: "cortes-barba",
    servicios: [
      { id: 27, clave: "corte-clasico-perfilado-de-barba", nombre: "Corte clásico + perfilado de barba", tipo: "original", precio: 27000, duracion: 45 },
      { id: 28, clave: "corte-mullet-perfilado-de-barba", nombre: "Corte mullet + perfilado de barba", tipo: "elite", precio: 37000, duracion: 60 },
      { id: 29, clave: "fade-arreglo-de-barba", nombre: "Fade + arreglo de barba", tipo: "elite", precio: 42000, duracion: 60 },
      { id: 30, clave: "corte-ejecutivo-barba", nombre: "Corte ejecutivo + barba", tipo: "elite", precio: 46000, duracion: 65 },
      { id: 31, clave: "corte-con-diseno-barba-definida", nombre: "Corte con diseño + barba definida", tipo: "vip", precio: 55000, duracion: 85 },
      { id: 32, clave: "corte-premium-ritual-de-barba", nombre: "Corte premium + ritual de barba", tipo: "vip", precio: 70000, duracion: 95 },
      { id: 33, clave: "experiencia-black-iron-vip", nombre: "Experiencia Black Iron VIP", tipo: "vip", precio: 95000, duracion: 120 },
    ],
  },

  // 6. ONDULADOS
  {
    categoria: "Ondulados",
    slug: "ondulados",
    clave: "ondulados",
    servicios: [
      { id: 34, clave: "ondulado-cabello-corto", nombre: "Ondulado cabello corto", tipo: "original", precio: 50000, duracion: 75 },
      { id: 35, clave: "ondulado-corto-corte", nombre: "Ondulado corto + corte", tipo: "elite", precio: 65000, duracion: 95 },
      { id: 36, clave: "ondulado-cabello-medio", nombre: "Ondulado cabello medio", tipo: "elite", precio: 75000, duracion: 105 },
      { id: 37, clave: "ondulado-medio-corte", nombre: "Ondulado medio + corte", tipo: "vip", precio: 90000, duracion: 130 },
      { id: 38, clave: "ondulado-cabello-largo", nombre: "Ondulado cabello largo", tipo: "vip", precio: 110000, duracion: 150 },
      { id: 39, clave: "ondulado-largo-corte-premium", nombre: "Ondulado largo + corte premium", tipo: "vip", precio: 130000, duracion: 180 },
    ],
  },
];
