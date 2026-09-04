const UPLOAD_FOLDER = "sigil-generator-runas";
const MODULE_ID = "sigil-generator";

/** Renders an SVG string to a PNG data URL of the given size. */
async function svgToPngDataURL(svgString, size = 512) {
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Falha ao rasterizar o SVG da runa."));
      image.src = url;
    });
    const canvasEl = document.createElement("canvas");
    canvasEl.width = size;
    canvasEl.height = size;
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    return canvasEl.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dataURLtoFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

async function ensureUploadFolder() {
  try {
    await FilePicker.createDirectory("data", UPLOAD_FOLDER);
  } catch (err) {
    // Folder likely already exists — safe to ignore.
  }
}

/**
 * Saves the rune's SVG as a PNG under Data/runas-geradas/, creates a Journal
 * Entry describing it, and drops a chest-shaped Note on the current scene
 * that links to that entry.
 *
 * @param {object} rune - { svg, seed, name, power, description }
 * @param {object} overrides - optional { name, power, description } from the form
 */
export async function createRuneJournalAndChest(rune, overrides = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("RUNABUILDER.OnlyGM"));
    return null;
  }

  const name = overrides.name?.trim() || rune.name;
  const power = overrides.power?.trim() || rune.power;
  const description = overrides.description?.trim() || rune.description;

  await ensureUploadFolder();

  const dataUrl = await svgToPngDataURL(rune.svg, 512);
  const filename = `runa-${rune.seed}.png`;
  const file = dataURLtoFile(dataUrl, filename);

  let imgPath;
  try {
    const uploadResult = await FilePicker.upload("data", UPLOAD_FOLDER, file, {}, { notify: false });
    imgPath = uploadResult?.path;
  } catch (err) {
    console.error("Runa Builder | Falha ao enviar a imagem da runa", err);
  }
  if (!imgPath) {
    // Fallback: embed the data URL directly if upload failed for some reason.
    imgPath = dataUrl;
  }

  const journal = await JournalEntry.create({
    name,
    pages: [
      {
        name,
        type: "text",
        text: {
          format: CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1,
          content:
            `<figure style="text-align:center;">` +
            `<img src="${imgPath}" style="max-width:280px;" alt="${name}">` +
            `</figure>` +
            `<p><strong>${game.i18n.localize("RUNABUILDER.Power")}:</strong> ${power}</p>` +
            `<p>${description}</p>` +
            `<p><em>${game.i18n.localize("RUNABUILDER.Seed")}: ${rune.seed}</em></p>`
        }
      }
    ]
  });

  let note = null;
  if (canvas.ready && canvas.scene) {
    const scene = canvas.scene;
    const centre = canvas.stage?.pivot ?? { x: scene.width / 2, y: scene.height / 2 };
    const chestIcon = `modules/${MODULE_ID}/assets/chest-icon.svg`;
    const [created] = await scene.createEmbeddedDocuments("Note", [
      {
        entryId: journal.id,
        x: Math.round(centre.x),
        y: Math.round(centre.y),
        texture: { src: chestIcon },
        iconSize: 64,
        text: name,
        fontSize: 24,
        global: false
      }
    ]);
    note = created;
    ui.notifications.info(game.i18n.format("RUNABUILDER.CreatedWithChest", { name }));
  } else {
    ui.notifications.warn(game.i18n.format("RUNABUILDER.CreatedNoScene", { name }));
  }

  return { journal, note };
}
