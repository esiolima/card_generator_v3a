import path from "path";
import fs from "fs";
import puppeteer, { Browser } from "puppeteer";
import archiver from "archiver";
import xlsx from "xlsx";
import { EventEmitter } from "events";

const TEMPLATES_DIR = path.resolve("templates");
const LOGOS_DIR = path.resolve("logos");
const OUTPUT_DIR = path.resolve("output");
const TMP_DIR = path.resolve("tmp");
const ERROR_LOG = path.join(OUTPUT_DIR, "error.log");

interface CardData {
  ordem?: string;
  tipo: string;
  logo: string;
  cupom?: string;
  texto?: string;
  valor?: string;
  legal?: string;
  uf?: string;
  segmento?: string;
}

interface GenerationProgress {
  total: number;
  processed: number;
  percentage: number;
  currentCard: string;
}

const upper = (v: string | undefined) => String(v || "").toUpperCase();

function logError(message: string) {
  const time = new Date().toISOString();
  fs.appendFileSync(ERROR_LOG, `[${time}] ${message}\n`);
}

function imageToBase64(imagePath: string): string {
  if (!fs.existsSync(imagePath)) return "";
  const ext = path.extname(imagePath).replace(".", "");
  const buffer = fs.readFileSync(imagePath);
  return `data:image/${ext};base64,${buffer.toString("base64")}`;
}

function normalizeType(tipo: string): string {
  if (!tipo) return "";

  let normalized = String(tipo)
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
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

    if (fs.existsSync(ERROR_LOG)) fs.unlinkSync(ERROR_LOG);

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

    const validRows = rows.filter((row) => normalizeType(row.tipo));

    const total = validRows.length;
    let processed = 0;

    for (const row of validRows) {
      const tipo = normalizeType(row.tipo);

      if (!tipo) {
        logError(`Tipo inválido na linha: ${JSON.stringify(row)}`);
        continue;
      }

      const templatePath = path.join(TEMPLATES_DIR, `${tipo}.html`);
      let html = fs.readFileSync(templatePath, "utf8");

      /* ========================
         LOGO PADRÃO
      ======================== */

      let logoFile = row.logo?.trim();

      if (!logoFile) {
        logoFile = "Blank.png";
      }

      const logoPath = path.join(LOGOS_DIR, logoFile);

      if (!fs.existsSync(logoPath)) {
        logError(`Logo não encontrado: ${logoFile}`);
      }

      const logoBase64 = imageToBase64(
        fs.existsSync(logoPath)
          ? logoPath
          : path.join(LOGOS_DIR, "Blank.png")
      );

      /* ========================
         VALOR COM %
      ======================== */

      let valorFinal = upper(row.valor);

      if (["cupom", "queda", "bc"].includes(tipo)) {
        if (!valorFinal) {
          logError(`Valor vazio para tipo ${tipo}`);
        } else {
          valorFinal = valorFinal.replace("%", "");
          valorFinal = `${valorFinal}%`;
        }
      }

      if (tipo === "promocao") {
        valorFinal = upper(row.valor);
      }

      /* ========================
         REPLACEMENTS
      ======================== */

      html = html.replaceAll("{{LOGO}}", logoBase64);
      html = html.replaceAll("{{TEXTO}}", upper(row.texto));
      html = html.replaceAll("{{VALOR}}", valorFinal);
      html = html.replaceAll("{{CUPOM}}", upper(row.cupom));
      html = html.replaceAll("{{LEGAL}}", upper(row.legal));
      html = html.replaceAll("{{UF}}", upper(row.uf));
      html = html.replaceAll("{{SEGMENTO}}", upper(row.segmento));

      const tmpHtmlPath = path.join(TMP_DIR, `card_${processed + 1}.html`);
      fs.writeFileSync(tmpHtmlPath, html, "utf8");

      const page = await this.browser.newPage();
      await page.setViewport({ width: 1400, height: 2115 });

      await page.goto(`file://${path.resolve(tmpHtmlPath)}`, {
        waitUntil: "networkidle0",
      });

      /* ========================
         NOME DO PDF
      ======================== */

      const ordem = String(row.ordem || processed + 1).trim();
      const tipoUpper = tipo.toUpperCase();

      const pdfPath = path.join(
        OUTPUT_DIR,
        `${ordem}_${tipoUpper}.pdf`
      );

      await page.pdf({
        path: pdfPath,
        width: "1400px",
        height: "2115px",
        printBackground: true,
      });

      await page.close();

      processed++;
    }

    const zipPath = path.join(OUTPUT_DIR, "cards.zip");
    await this.createZip(OUTPUT_DIR, zipPath);

    return zipPath;
  }

  private async createZip(sourceDir: string, zipPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => resolve());
      archive.on("error", reject);

      archive.pipe(output);

      const files = fs.readdirSync(sourceDir);
      for (const file of files) {
        if (file.endsWith(".pdf")) {
          archive.file(path.join(sourceDir, file), { name: file });
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
