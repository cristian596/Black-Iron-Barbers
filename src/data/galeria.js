export const ANTES_DESPUES = Array.from({ length: 6 }, (_, i) => ({
  src: `/Hair/hair_man_${i + 1}.jpg`,
  alt: `Corte de cabello antes y después, cliente ${i + 1}`,
}));

export const CORTES_MASCULINOS = Array.from({ length: 20 }, (_, i) => ({
  src: `/CourtMan/court_${i + 1}.jpg`,
  alt: `Corte de cabello masculino ${i + 1}`,
}));
