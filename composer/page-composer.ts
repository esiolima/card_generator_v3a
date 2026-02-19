import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const OUTPUT_DIR = path.resolve("output");
const FONT_PATH = path.resolve("fonts/Inter-Bold.ttf");

const PAGE_WIDTH = 3360;
const CARD_TARGET_WIDTH = 1000;
const ORIGINAL_CARD_WIDTH = 1400;
const ORIGINAL_CARD_HEIGHT = 2115;

const SCALE = CARD_TARGET_WIDTH / ORIGINAL_CARD_WIDTH;
const CARD_HEIGHT = ORIGINAL_CARD_HEIGHT * SCALE;

const GAP = 80;
const MARGIN = 100;

const TARJA_WIDTH = 3160;
const TARJA_HEIGHT = 240;
const TARJA_RADIUS = 120;
const TARJA_FONT_SIZE = 115;

function normalizeCategoryNameFromFile(fileName: string): string {
  const parts = fileName.replace(".pdf", "").split("_");
  return parts.slice(2).join(" ");
}

function generateUniqueColor(used: Set<string>) {
  while (true) {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 0.7;
    const lightness = 0.4;

    const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = lightness - c / 2;

    let r1 = 0, g1 = 0, b1 = 0;

    if (hue < 60) [r1, g1, b1] = [c, x, 0];
    else if (hue < 120) [r1, g1, b1] = [x, c, 0];
    else if (hue < 180) [r1, g1, b1] = [0, c, x];
    else if (hue < 240) [r1, g1, b1] = [0, x, c];
    else if (hue < 300) [r1, g1, b1] = [x, 0, c];
    else [r1, g1, b1] = [c, 0, x];

    const r = r1 + m;
    const g = g1 + m;
    const b = b1 + m;

    const key = `${r}-${g}-${b}`;

    if (!used.has(key)) {
      used.add(key);
      return { r, g, b };
    }
  }
}

export async function composeJournal(): Promise<string> {
  console.log("📄 Iniciando composição do jornal...");

  const files = fs
    .readdirSync(OUTPUT_DIR)
    .filter((f) => f.endsWith(".pdf") && f !== "cards.zip")
    .sort((a, b) => {
      const aNum = parseInt(a.split("_")[0]);
      const bNum = parseInt(b.split("_")[0]);
      return aNum - bNum;
    });

  if (!files.length) {
    throw new Error("Nenhum card encontrado na pasta output.");
  }

  if (!fs.existsSync(FONT_PATH)) {
    throw new Error(`Fonte não encontrada em: ${FONT_PATH}`);
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = fs.readFileSync(FONT_PATH);
  const interBold = await pdfDoc.embedFont(fontBytes);

  const usedColors = new Set<string>();

  let currentCategory = "";
  let cardsOnPage = 0;
  let pageFiles: string[] = [];

  for (const file of files) {
    const categoria = normalizeCategoryNameFromFile(file);

    if (categoria !== currentCategory) {
      if (cardsOnPage >= 15) {
        await createPage(pdfDoc, pageFiles, interBold, usedColors);
        pageFiles = [];
        cardsOnPage = 0;
      }
      currentCategory = categoria;
    }

    pageFiles.push(file);
    cardsOnPage++;
  }

  if (pageFiles.length) {
    await createPage(pdfDoc, pageFiles, interBold, usedColors);
  }

  const finalPath = path.join(OUTPUT_DIR, "jornal_final.pdf");
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(finalPath, pdfBytes);

  console.log("✅ Jornal gerado com sucesso.");

  return finalPath;
}

async function createPage(
  pdfDoc: PDFDocument,
  pageFiles: string[],
  interBold: any,
  usedColors: Set<string>
) {
  const totalCards = pageFiles.length;
  const totalRows = Math.ceil(totalCards / 3);

  const pageHeight =
    MARGIN +
    TARJA_HEIGHT +
    GAP +
    totalRows * CARD_HEIGHT +
    (totalRows - 1) * GAP +
    MARGIN;

  const page = pdfDoc.addPage([PAGE_WIDTH, pageHeight]);

  let y = pageHeight - MARGIN;

  const categoria = normalizeCategoryNameFromFile(pageFiles[0]);
  const color = generateUniqueColor(usedColors);

  page.drawRoundedRectangle({
    x: MARGIN,
    y: y - TARJA_HEIGHT,
    width: TARJA_WIDTH,
    height: TARJA_HEIGHT,
    borderRadius: TARJA_RADIUS,
    color: rgb(color.r, color.g, color.b),
  });

  const text = categoria.toUpperCase();
  const textWidth = interBold.widthOfTextAtSize(text, TARJA_FONT_SIZE);

  page.drawText(text, {
    x: MARGIN + (TARJA_WIDTH - textWidth) / 2,
    y: y - TARJA_HEIGHT / 2 - TARJA_FONT_SIZE / 3,
    size: TARJA_FONT_SIZE,
    font: interBold,
    color: rgb(1, 1, 1),
  });

  y -= TARJA_HEIGHT + GAP;

  let column = 0;

  for (const file of pageFiles) {
    const cardBytes = fs.readFileSync(path.join(OUTPUT_DIR, file));
    const cardPdf = await PDFDocument.load(cardBytes);
    const [cardPage] = await pdfDoc.copyPages(cardPdf, [0]);
    const embedded = await pdfDoc.embedPage(cardPage);

    const x = MARGIN + column * (CARD_TARGET_WIDTH + GAP);

    page.drawPage(embedded, {
      x,
      y: y - CARD_HEIGHT,
      width: CARD_TARGET_WIDTH,
      height: CARD_HEIGHT,
    });

    column++;

    if (column === 3) {
      column = 0;
      y -= CARD_HEIGHT + GAP;
    }
  }
}
