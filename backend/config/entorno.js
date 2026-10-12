// ¿Se están ejecutando las PRUEBAS automáticas? Solo si NODE_ENV=test Y el ejecutor de pruebas (Vitest, que define
// VITEST) está presente. Así un NODE_ENV=test puesto por error en un servidor real NO apaga los limitadores de intentos,
// no enruta el correo a la memoria ni relaja la validación de secretos: eso solo ocurre dentro de Vitest.
export const esEntornoDePruebas = (variables = process.env) => variables.NODE_ENV === 'test' && Boolean(variables.VITEST);

// Los limitadores se omiten en pruebas salvo que la prueba pida lo contrario (FORZAR_RATE_LIMIT_PRUEBA=true).
export const omitirLimitadores = (variables = process.env) => esEntornoDePruebas(variables) && variables.FORZAR_RATE_LIMIT_PRUEBA !== 'true';
