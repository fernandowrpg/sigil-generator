const UPLOAD_FOLDER = "sigil-generator-runas";
const MODULE_ID = "sigil-generator";

const PREFERRED_ITEM_TYPES = [
  "loot", "treasure", "item", "object", "gear", "equipment", "misc", "miscellaneous", "consumable"
];

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

/** Item types the current game system defines (the "base" type only if nothing else exists). */
export function getItemTypes() {
  const baseType = CONST.BASE_DOCUMENT_TYPE ?? "base";
  const all = Array.from(game.documentTypes?.Item ?? Item.TYPES ?? []);
  const nonBase = all.filter((t) => t !== baseType);
  return nonBase.length ? nonBase : all;
}

export function getItemTypeLabel(type) {
  const key = CONFIG.Item?.typeLabels?.[type];
  return key ? game.i18n.localize(key) : type;
}

/** Picks the most sensible default item type: last used, then a "loot-like" one, then the first. */
export function guessItemType(types = getItemTypes()) {
  let saved = "";
  try {
    saved = game.settings.get(MODULE_ID, "itemType");
  } catch (err) { /* setting not registered yet */ }
  if (saved && types.includes(saved)) return saved;
  return PREFERRED_ITEM_TYPES.find((p) => types.includes(p)) ?? types[0];
}

/**
 * Writes the description into whatever description field the system uses.
 * Works for systems with `system.description` (string) or `system.description.value` (string).
 */
async function setItemDescription(item, html) {
  const sys = item.system;
  if (!sys) return false;
  try {
    if (typeof sys.description === "string") {
      await item.update({ "system.description": html });
      return true;
    }
    if (sys.description && typeof sys.description === "object" && typeof sys.description.value === "string") {
      await item.update({ "system.description.value": html });
      return true;
    }
  } catch (err) {
    console.warn("Sigil Generator | Não foi possível gravar a descrição do item", err);
  }
  return false;
}

/**
 * Creates the Item for a rune, links it with its journal (both directions)
 * and optionally delivers a copy to an actor's inventory.
 *
 * @param {JournalEntry} journal
 * @param {object} data - { name, power, description, img, seed, itemType, actorId, reveal }
 * @returns {Promise<{item: Item|null, delivered: Actor|null}>}
 */
async function createRuneItem(journal, data) {
  const types = getItemTypes();
  const type = types.includes(data.itemType) ? data.itemType : guessItemType(types);
  if (!type) {
    ui.notifications.warn(game.i18n.localize("RUNABUILDER.ItemNoTypes"));
    return { item: null, delivered: null };
  }

  const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS;
  const level = data.reveal ? OWNER.OBSERVER : OWNER.NONE;
  const img = data.img && !data.img.startsWith("data:") ? data.img : "icons/svg/item-bag.svg";

  let item = null;
  let delivered = null;
  try {
    item = await Item.create({
      name: data.name,
      type,
      img,
      ownership: { default: level },
      flags: {
        [MODULE_ID]: {
          journalId: journal.id,
          journalUuid: journal.uuid,
          seed: data.seed ?? null
        }
      }
    });
    await game.settings.set(MODULE_ID, "itemType", type);

    await setItemDescription(
      item,
      `<p>${esc(data.description)}</p>` +
        (data.power ? `<p><strong>${game.i18n.localize("RUNABUILDER.Power")}:</strong> ${esc(data.power)}</p>` : "") +
        `<p>@UUID[${journal.uuid}]{${esc(journal.name)}}</p>`
    );

    // Journal -> item link
    await journal.setFlag(MODULE_ID, "itemUuid", item.uuid);
    const page = journal.pages.find((p) => p.type === "text");
    if (page && !(page.text?.content ?? "").includes(item.uuid)) {
      await page.update({
        "text.content":
          (page.text?.content ?? "") +
          `<p>${game.i18n.localize("RUNABUILDER.LinkedItem")}: @UUID[${item.uuid}]{${esc(item.name)}}</p>`
      });
    }

    // Players need to be able to open the journal from the item.
    if (data.reveal && (journal.ownership?.default ?? 0) < OWNER.OBSERVER) {
      await journal.update({ "ownership.default": OWNER.OBSERVER });
    }

    if (data.actorId) {
      const actor = game.actors.get(data.actorId);
      if (actor) {
        const [copy] = await actor.createEmbeddedDocuments("Item", [item.toObject()]);
        delivered = copy ? actor : null;
      }
    }
  } catch (err) {
    console.error("Sigil Generator | Falha ao criar o item", err);
    ui.notifications.error(game.i18n.format("RUNABUILDER.ItemError", { type }));
  }

  if (item) {
    ui.notifications.info(
      delivered
        ? game.i18n.format("RUNABUILDER.ItemDelivered", { item: item.name, actor: delivered.name })
        : game.i18n.format("RUNABUILDER.ItemCreated", { item: item.name })
    );
  }
  return { item, delivered };
}

/**
 * Saves the rune as a PNG, creates a Journal Entry, (optionally) an Item linked to it,
 * (optionally) delivers that Item to an actor, and drops a chest Note on the current scene.
 *
 * @param {object} rune - { svg, seed, name, power, description }
 * @param {object} opts - { name, power, description, createItem, itemType, actorId, reveal }
 */
export async function createRuneJournalAndChest(rune, opts = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("RUNABUILDER.OnlyGM"));
    return null;
  }

  const name = opts.name?.trim() || rune.name;
  const power = opts.power?.trim() || rune.power;
  const description = opts.description?.trim() || rune.description;
  const createItem = opts.createItem !== false;
  const reveal = opts.reveal !== false;
  const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS;

  await ensureUploadFolder();

  const dataUrl = await svgToPngDataURL(rune.svg, 512);
  const file = dataURLtoFile(dataUrl, `runa-${rune.seed}.png`);

  let imgPath;
  try {
    const uploadResult = await FilePicker.upload("data", UPLOAD_FOLDER, file, {}, { notify: false });
    imgPath = uploadResult?.path;
  } catch (err) {
    console.error("Sigil Generator | Falha ao enviar a imagem da runa", err);
  }

  // --- Journal -----------------------------------------------------------
  const journalContent =
    `<figure style="text-align:center;">` +
    `<img src="${imgPath || dataUrl}" style="max-width:280px;" alt="${esc(name)}">` +
    `</figure>` +
    `<p><strong>${game.i18n.localize("RUNABUILDER.Power")}:</strong> ${esc(power)}</p>` +
    `<p>${esc(description)}</p>` +
    `<p><em>${game.i18n.localize("RUNABUILDER.Seed")}: ${rune.seed}</em></p>`;

  const journal = await JournalEntry.create({
    name,
    ownership: { default: reveal ? OWNER.OBSERVER : OWNER.NONE },
    flags: { [MODULE_ID]: { rune: true, seed: rune.seed } },
    pages: [
      {
        name,
        type: "text",
        text: { format: CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1, content: journalContent }
      }
    ]
  });

  // --- Item ----------------------------------------------------------------
  let item = null;
  if (createItem) {
    ({ item } = await createRuneItem(journal, {
      name,
      power,
      description,
      img: imgPath,
      seed: rune.seed,
      itemType: opts.itemType,
      actorId: opts.actorId,
      reveal
    }));
  }

  // --- Chest on the map ---------------------------------------------------
  let note = null;
  if (canvas.ready && canvas.scene) {
    const scene = canvas.scene;
    const centre = canvas.stage?.pivot ?? { x: scene.width / 2, y: scene.height / 2 };
    const [created] = await scene.createEmbeddedDocuments("Note", [
      {
        entryId: journal.id,
        x: Math.round(centre.x),
        y: Math.round(centre.y),
        texture: { src: `modules/${MODULE_ID}/assets/chest-icon.svg` },
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

  return { journal, note, item };
}

// ---------------------------------------------------------------------------
// Existing runes: create an item from a journal that was generated earlier
// ---------------------------------------------------------------------------

function firstTextPage(journal) {
  return journal?.pages?.find((p) => p.type === "text") ?? null;
}

/** True if this journal looks like one produced by this module (flag, or the PNG name in its content). */
export function isRuneJournal(journal) {
  if (!journal || journal.documentName !== "JournalEntry") return false;
  if (journal.getFlag(MODULE_ID, "rune")) return true;
  const html = firstTextPage(journal)?.text?.content ?? "";
  return /runa-\d+\.png/.test(html);
}

/** Extracts image, seed, power and description from a rune journal's HTML. */
export function parseRuneJournal(journal) {
  const html = firstTextPage(journal)?.text?.content ?? "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const img = doc.querySelector("img")?.getAttribute("src") ?? "";
  const seedMatch = img.match(/runa-(\d+)\.png/) ?? html.match(/(?:Semente|Seed):\s*(?:<\/strong>)?\s*(\d+)/);
  const seed = seedMatch ? Number(seedMatch[1]) : (journal.getFlag(MODULE_ID, "seed") ?? null);

  let power = "";
  let description = "";
  for (const p of doc.querySelectorAll("p")) {
    const strong = p.querySelector("strong");
    const text = p.textContent.trim();
    if (strong && !power) {
      power = text.replace(strong.textContent, "").replace(/^[:\s]+/, "").trim();
    } else if (!strong && !p.querySelector("em") && !text.includes("@UUID") && !description) {
      description = text;
    }
  }
  return { name: journal.name, img, seed, power, description };
}

/**
 * Opens a small dialog and creates an Item for a rune journal that already exists.
 * @param {JournalEntry|string} journalOrId - the journal, its id, or its uuid
 */
export async function createItemFromJournal(journalOrId) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("RUNABUILDER.OnlyGM"));
    return null;
  }
  const journal =
    typeof journalOrId === "string"
      ? game.journal.get(journalOrId) ?? (await fromUuid(journalOrId))
      : journalOrId;
  if (!journal || journal.documentName !== "JournalEntry") {
    ui.notifications.warn(game.i18n.localize("RUNABUILDER.JournalNotFound"));
    return null;
  }

  const types = getItemTypes();
  if (!types.length) {
    ui.notifications.warn(game.i18n.localize("RUNABUILDER.ItemNoTypes"));
    return null;
  }

  const parsed = parseRuneJournal(journal);
  const selected = guessItemType(types);
  const typeOptions = types
    .map((t) => `<option value="${esc(t)}" ${t === selected ? "selected" : ""}>${esc(getItemTypeLabel(t))}</option>`)
    .join("");
  const actorOptions = game.actors.contents
    .filter((a) => a.hasPlayerOwner)
    .map((a) => `<option value="${a.id}">${esc(a.name)}</option>`)
    .join("");

  const existing = journal.getFlag(MODULE_ID, "itemUuid");
  const existingItem = existing ? await fromUuid(existing) : null;

  const content =
    `<div class="sigil-generator sigil-dialog">` +
    `<p><strong>${esc(journal.name)}</strong></p>` +
    (existingItem ? `<p class="hint">${game.i18n.localize("RUNABUILDER.ItemAlreadyExists")}</p>` : "") +
    `<div class="form-group"><label>${game.i18n.localize("RUNABUILDER.ItemType")}</label>` +
    `<select name="itemType">${typeOptions}</select></div>` +
    `<div class="form-group"><label>${game.i18n.localize("RUNABUILDER.GiveTo")}</label>` +
    `<select name="actorId"><option value="">${game.i18n.localize("RUNABUILDER.GiveToNone")}</option>${actorOptions}</select></div>` +
    `<label class="checkbox-row"><input type="checkbox" name="reveal" checked> ` +
    `<span>${game.i18n.localize("RUNABUILDER.RevealJournal")}</span></label>` +
    `</div>`;

  const choice = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("RUNABUILDER.ItemFromJournalTitle"), icon: "fa-solid fa-hat-wizard" },
    content,
    ok: {
      label: game.i18n.localize("RUNABUILDER.CreateItemButton"),
      icon: "fa-solid fa-box-archive",
      callback: (_event, button) => {
        const f = button.form.elements;
        return { itemType: f.itemType.value, actorId: f.actorId.value, reveal: f.reveal.checked };
      }
    },
    rejectClose: false
  });
  if (!choice) return null;

  const { item } = await createRuneItem(journal, { ...parsed, ...choice });
  return item;
}
