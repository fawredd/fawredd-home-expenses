import fs from "fs";
import { extractDocumentData } from "./lib/extraction";
import { db } from "./db";

async function main() {
  const filePath = "storage/documents/2026/06/1780603818391-owy17t.pdf";
  const buffer = fs.readFileSync(filePath);
  const result = await extractDocumentData(buffer, "application/pdf");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
