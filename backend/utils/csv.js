// CSV para abrir en Excel en español: separador `;`, BOM UTF-8 al inicio y saltos de línea CRLF.
const SEPARADOR_CSV = ';';
const BOM = '\uFEFF';

// Una celda de texto que empieza con = + - @ (o tabulación / retorno) la interpretaría una hoja de cálculo como
// fórmula (inyección de fórmulas): se le antepone una comilla simple para que se lea como texto.
const neutralizarFormula = (texto) => (/^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto);

export const celdaCsv = (valor) => {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return String(valor);
  const texto = neutralizarFormula(String(valor));
  // Se entrecomilla si hay separador, comillas o saltos de línea; las comillas internas se duplican.
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

export const generarCsv = (filas) => BOM + filas.map((fila) => fila.map(celdaCsv).join(SEPARADOR_CSV)).join('\r\n') + '\r\n';
