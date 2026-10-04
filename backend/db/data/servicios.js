// Catálogo de servicios de la barbería: una categoría por bloque, en el orden en que se muestran.
// Dentro de cada categoría: original -> elite -> vip (de menor a mayor precio).
// `id` solo sirve para casar cada servicio con su descripción (descripciones.js); NO es el id de la base de datos.
// `duracion` está en minutos y se guarda como duracion_min.

export default [
  // 1. CORTES
  {
    categoria: "Cortes",
    slug: "cortes",
    servicios: [
      { id: 1, nombre: "Corte militar", tipo: "original", precio: 18000, duracion: 25 },
      { id: 2, nombre: "Corte clásico", tipo: "original", precio: 18000, duracion: 30 },
      { id: 3, nombre: "Corte infantil", tipo: "original", precio: 18000, duracion: 30 },
      { id: 4, nombre: "Corte degradado (Fade)", tipo: "elite", precio: 25000, duracion: 40 },
      { id: 5, nombre: "Corte mullet", tipo: "elite", precio: 28000, duracion: 45 },
      { id: 6, nombre: "Corte ejecutivo", tipo: "elite", precio: 30000, duracion: 40 },
      { id: 7, nombre: "Corte premium con asesoría de imagen", tipo: "vip", precio: 40000, duracion: 60 },
      { id: 8, nombre: "Corte con diseño personalizado", tipo: "vip", precio: 40000, duracion: 60 },
    ],
  },

  // 2. BARBA
  {
    categoria: "Barba",
    slug: "barba",
    servicios: [
      { id: 9, nombre: "Perfilado de barba", tipo: "original", precio: 12000, duracion: 20 },
      { id: 10, nombre: "Afeitado clásico", tipo: "original", precio: 15000, duracion: 25 },
      { id: 11, nombre: "Arreglo y definición de barba", tipo: "elite", precio: 20000, duracion: 30 },
      { id: 12, nombre: "Diseño de barba", tipo: "elite", precio: 25000, duracion: 35 },
      { id: 13, nombre: "Ritual VIP de barba con toalla caliente", tipo: "vip", precio: 35000, duracion: 45 },
      { id: 14, nombre: "Diseño premium y tratamiento de barba", tipo: "vip", precio: 40000, duracion: 50 },
    ],
  },

  // 3. KERATINAS
  {
    categoria: "Keratinas",
    slug: "keratinas",
    servicios: [
      { id: 15, nombre: "Keratina express antifrizz", tipo: "original", precio: 45000, duracion: 60 },
      { id: 16, nombre: "Keratina cabello corto", tipo: "original", precio: 60000, duracion: 90 },
      { id: 17, nombre: "Keratina cabello medio", tipo: "elite", precio: 90000, duracion: 120 },
      { id: 18, nombre: "Keratina premium con hidratación", tipo: "elite", precio: 110000, duracion: 150 },
      { id: 19, nombre: "Keratina cabello largo", tipo: "vip", precio: 130000, duracion: 180 },
      { id: 20, nombre: "Alisado premium y reconstrucción capilar", tipo: "vip", precio: 160000, duracion: 210 },
    ],
  },

  // 4. FACIALES
  {
    categoria: "Faciales",
    slug: "faciales",
    servicios: [
      { id: 21, nombre: "Exfoliación facial", tipo: "original", precio: 20000, duracion: 25 },
      { id: 22, nombre: "Limpieza facial básica", tipo: "original", precio: 25000, duracion: 30 },
      { id: 23, nombre: "Mascarilla hidratante", tipo: "elite", precio: 30000, duracion: 35 },
      { id: 24, nombre: "Limpieza facial profunda", tipo: "elite", precio: 45000, duracion: 50 },
      { id: 25, nombre: "Limpieza facial + mascarilla premium", tipo: "vip", precio: 60000, duracion: 60 },
      { id: 26, nombre: "Tratamiento facial VIP", tipo: "vip", precio: 70000, duracion: 75 },
    ],
  },

  // 5. CORTES + BARBA
  // Los combos cuestan alrededor de un 7-10 % menos que la suma de sus partes
  // y duran algo menos que la suma de sus partes.
  {
    categoria: "Cortes + barba",
    slug: "cortes-barba",
    servicios: [
      { id: 27, nombre: "Corte clásico + perfilado de barba", tipo: "original", precio: 27000, duracion: 45 },
      { id: 28, nombre: "Corte mullet + perfilado de barba", tipo: "elite", precio: 37000, duracion: 60 },
      { id: 29, nombre: "Fade + arreglo de barba", tipo: "elite", precio: 42000, duracion: 60 },
      { id: 30, nombre: "Corte ejecutivo + barba", tipo: "elite", precio: 46000, duracion: 65 },
      { id: 31, nombre: "Corte con diseño + barba definida", tipo: "vip", precio: 55000, duracion: 85 },
      { id: 32, nombre: "Corte premium + ritual de barba", tipo: "vip", precio: 70000, duracion: 95 },
      { id: 33, nombre: "Experiencia Black Iron VIP", tipo: "vip", precio: 95000, duracion: 120 },
    ],
  },

  // 6. ONDULADOS
  {
    categoria: "Ondulados",
    slug: "ondulados",
    servicios: [
      { id: 34, nombre: "Ondulado cabello corto", tipo: "original", precio: 50000, duracion: 75 },
      { id: 35, nombre: "Ondulado corto + corte", tipo: "elite", precio: 65000, duracion: 95 },
      { id: 36, nombre: "Ondulado cabello medio", tipo: "elite", precio: 75000, duracion: 105 },
      { id: 37, nombre: "Ondulado medio + corte", tipo: "vip", precio: 90000, duracion: 130 },
      { id: 38, nombre: "Ondulado cabello largo", tipo: "vip", precio: 110000, duracion: 150 },
      { id: 39, nombre: "Ondulado largo + corte premium", tipo: "vip", precio: 130000, duracion: 180 },
    ],
  },
];
