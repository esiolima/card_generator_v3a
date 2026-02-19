import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.resolve("output");

export async function composeJournal(): Promise<string> {

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const testFilePath = path.join(OUTPUT_DIR, "teste_jornal.txt");

  fs.writeFileSync(
    testFilePath,
    "JORNAL FUNCIONOU - TESTE OK"
  );

  return testFilePath;
}
