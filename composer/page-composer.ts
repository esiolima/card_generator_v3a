import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const OUTPUT_DIR = path.resolve("output");

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
    const r = Math.random();
    const g = Math.random();
    const b = Math.random();

    const key = `${r}-${g}-${b}`;
    if (!used.has(key)) {
      used.add(key);
      return { r, g, b };
    }
  }
}

export async function composeJournal(): Promise<string> {

  const files = fs
    .readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith(".pdf") && f !== "cards.zip" && !f.includes("jornal"))
    .sort((a, b) => {
      const aNum = parseInt(a.split("_")[0]);
      const bNum = parseInt(b.split("_")[0]);
      return aNum - bNum;
    });

  if (!files.length) {
    throw new Error("Nenhum card encontrado.");
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const usedColors = new Set<string>();

  let currentCategory = "";
  let currentPage: any = null;
  let y = 0;
  let column = 0;

  for (const file of files) {

    const categoria = normalizeCategoryNameFromFile(file);

    if (categoria !== currentCategory) {

      currentCategory = categoria;

      const pageHeight = 5000;
      currentPage = pdfDoc.addPage([PAGE_WIDTH, pageHeight]);

      y = pageHeight - MARGIN;

      const color = generateUniqueColor(usedColors);

      currentPage.drawRoundedRectangle({
        x: MARGIN,
        y: y - TARJA_HEIGHT,
        width: TARJA_WIDTH,
        height: TARJA_HEIGHT,
        borderRadius: TARJA_RADIUS,
        color: rgb(color.r, color.g, color.b),
      });

      const textWidth = font.widthOfTextAtSize(
        categoria.toUpperCase(),
        TARJA_FONT_SIZE
      );

      currentPage.drawText(categoria.toUpperCase(), {
        x: MARGIN + (TARJA_WIDTH - textWidth) / 2,
        y: y - TARJA_HEIGHT / 2 - TARJA_FONT_SIZE / 3,
        size: TARJA_FONT_SIZE,
        font,
        color: rgb(1, 1, 1),
      });

      y -= TARJA_HEIGHT + GAP;
      column = 0;
    }

    const cardBytes = fs.readFileSync(path.join(OUTPUT_DIR, file));
    const cardPdf = await PDFDocument.load(cardBytes);
    const [cardPage] = await pdfDoc.copyPages(cardPdf, [0]);
    const embedded = await pdfDoc.embedPage(cardPage);

    const x = MARGIN + column * (CARD_TARGET_WIDTH + GAP);

    currentPage.drawPage(embedded, {
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

  const finalPath = path.join(OUTPUT_DIR, "jornal_final.pdf");
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(finalPath, pdfBytes);

  return finalPath;
}
