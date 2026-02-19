import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const OUTPUT_DIR = path.join(process.cwd(), "output");
const FONT_PATH = path.join(process.cwd(), "fonts/Inter-Bold.ttf");

const PAGE_WIDTH = 3360;
const CARD_WIDTH = 1000;
const CARD_HEIGHT = 1510;
const GAP = 80;
const MARGIN = 100;

const TARJA_HEIGHT = 240;
const TARJA_RADIUS = 120;
const TARJA_FONT_SIZE = 115;

function extractCategory(file: string): string {
  const parts = file.replace(".pdf", "").split("_");
  return parts.slice(2).join(" ");
}

function extractOrder(file: string): number {
  return parseInt(file.split("_")[0]) || 0;
}

export async function composeJournal(): Promise<string> {
  const files = fs
    .readdirSync(OUTPUT_DIR)
    .filter((f) => f.endsWith(".pdf") && f !== "jornal_final.pdf")
    .sort((a, b) => extractOrder(a) - extractOrder(b));

  if (!files.length) {
    throw new Error("Nenhum card encontrado.");
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = fs.readFileSync(FONT_PATH);
  const font = await pdfDoc.embedFont(fontBytes);

  let page = pdfDoc.addPage([PAGE_WIDTH, 5000]);
  let y = page.getHeight() - MARGIN;

  let currentCategory = "";
  let column = 0;

  for (const file of files) {
    const categoria = extractCategory(file);

    if (categoria !== currentCategory) {
      currentCategory = categoria;

      if (y < CARD_HEIGHT + TARJA_HEIGHT + 500) {
        page = pdfDoc.addPage([PAGE_WIDTH, 5000]);
        y = page.getHeight() - MARGIN;
      }

      page.drawRoundedRectangle({
        x: MARGIN,
        y: y - TARJA_HEIGHT,
        width: PAGE_WIDTH - MARGIN * 2,
        height: TARJA_HEIGHT,
        borderRadius: TARJA_RADIUS,
        color: rgb(0.15, 0.35, 0.85),
      });

      const text = categoria.toUpperCase();
      const textWidth = font.widthOfTextAtSize(text, TARJA_FONT_SIZE);

      page.drawText(text, {
        x: MARGIN + (PAGE_WIDTH - MARGIN * 2 - textWidth) / 2,
        y: y - TARJA_HEIGHT / 2 - 40,
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

    const x = MARGIN + column * (CARD_WIDTH + GAP);

    page.drawPage(embedded, {
      x,
      y: y - CARD_HEIGHT,
      width: CARD_WIDTH,
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
