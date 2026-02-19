import path from "path";
import fs from "fs";
import puppeteer, { Browser } from "puppeteer";
import archiver from "archiver";
import xlsx from "xlsx";
import { EventEmitter } from "events";

const OUTPUT_DIR = path.join(process.cwd(), "output");
const TMP_DIR = path.join(process.cwd(), "tmp");
const TEMPLATES_DIR = path.join(process.cwd(), "templates");

interface CardData {
  ordem?: string;
  tipo: string;
  texto?: string;
  valor?: any;
  categoria?: string;
}

interface GenerationProgress {
  total: number;
  processed: number;
  percentage: number;
  currentCard: string;
}

function getTimestampFileName(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(
    now.getSeconds()
  )}.zip`;
}

function normalizeType(tipo: string): string {
  if (!tipo) return "";

  const normalized = String(tipo)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized.includes("promo")) return "promocao";
  if (normalized.includes("cupom")) return "cupom";
  if (normalized.includes("queda")) return "queda";
  if (normalized === "bc") return "bc";

  return "";
}

export class CardGenerator extends EventEmitter {
  private browser: Browser | null = null;

  async initialize() {
    if (!fs.existsSync(OUTPUT_DIR))
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    if (!fs.existsSync(TMP_DIR))
      fs.mkdirSync(TMP_DIR, { recursive: true });

    this.browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
  }

  async generateCards(
    excelFilePath: string,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<string> {
    if (!this.browser) throw new Error("Generator not initialized");

    const workbook = xlsx.readFile(excelFilePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json<CardData>(sheet, { defval: "" });

    const validRows = rows.filter((row) => {
      const tipo = normalizeType(row.tipo);
      return tipo && fs.existsSync(path.join(TEMPLATES_DIR, `${tipo}.html`));
    });

    const total = validRows.length;
    let processed = 0;

    for (const row of validRows) {
      const tipo = normalizeType(row.tipo);
      const templatePath = path.join(TEMPLATES_DIR, `${tipo}.html`);
      let html = fs.readFileSync(templatePath, "utf8");

      html = html.replaceAll("{{TEXTO}}", String(row.texto ?? ""));
      html = html.replaceAll("{{VALOR}}", String(row.valor ?? ""));

      const tmpHtmlPath = path.join(TMP_DIR, `card_${processed + 1}.html`);
      fs.writeFileSync(tmpHtmlPath, html);

      const page = await this.browser.newPage();
      await page.setViewport({ width: 1400, height: 2115 });

      await page.goto(`file://${tmpHtmlPath}`, {
        waitUntil: "networkidle0",
      });

      const ordem = String(row.ordem || processed + 1).trim();
      const categoria = String(row.categoria || "SEM_CATEGORIA")
        .toUpperCase()
        .replace(/\s+/g, "_");

      const pdfName = `${ordem}_${tipo.toUpperCase()}_${categoria}.pdf`;
      const pdfPath = path.join(OUTPUT_DIR, pdfName);

      await page.pdf({
        path: pdfPath,
        width: "1400px",
        height: "2115px",
        printBackground: true,
      });

      await page.close();

      processed++;

      const percentage = Math.round((processed / total) * 100);

      if (onProgress) {
        onProgress({
          total,
          processed,
          percentage,
          currentCard: `${processed}/${total}`,
        });
      }

      this.emit("progress", {
        total,
        processed,
        percentage,
        currentCard: `${processed}/${total}`,
      });
    }

    const zipName = getTimestampFileName();
    const zipPath = path.join(OUTPUT_DIR, zipName);

    await this.createZip(zipPath);

    return zipPath;
  }

  private async createZip(zipPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => resolve());
      archive.on("error", reject);

      archive.pipe(output);

      const files = fs.readdirSync(OUTPUT_DIR);

      for (const file of files) {
        if (file.endsWith(".pdf")) {
          archive.file(path.join(OUTPUT_DIR, file), { name: file });
        }
      }

      archive.finalize();
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
