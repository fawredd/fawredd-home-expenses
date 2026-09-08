import { extractStatementFromAI } from "./lib/extraction";

async function main() {
  const rawText = `
BANCO GALICIA - ESTADO DE CUENTA
Fecha de emisión: 01/05/2026
Cliente: FAWREDD

Fecha       Concepto                      Importe
02/05/2026  CARREFOUR SA                  -45000.00
05/05/2026  TRANSFERENCIA RECIBIDA        +150000.00
08/05/2026  UBER TRIP                     -5000.50
12/05/2026  PAGO SERVICIO EDESUR          -12000.00
  `;

  const result = await extractStatementFromAI(rawText);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
