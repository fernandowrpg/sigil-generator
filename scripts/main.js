import { RuneBuilderApp } from "./rune-app.js";
import { createItemFromJournal, isRuneJournal } from "./create-content.js";

const MODULE_ID = "sigil-generator";
const FLAG_JOURNAL_UUID = "journalUuid";

function openRuneBuilder() {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("RUNABUILDER.OnlyGM"));
    return null;
  }
  const app = new RuneBuilderApp();
  app.render(true);
  return app;
}

/** Opens the Journal Entry linked to a rune item. */
async function openRuneJournal(uuid) {
  const journal = await fromUuid(uuid);
  if (!journal) {
    ui.notifications.warn(game.i18n.localize("RUNABUILDER.JournalNotFound"));
    return;
  }
  if (!journal.testUserPermission(game.user, "OBSERVER")) {
    ui.notifications.warn(game.i18n.localize("RUNABUILDER.JournalNoPermission"));
    return;
  }
  journal.sheet.render(true);
}

Hooks.once("init", () => {
  console.log("Sigil Generator | inicializando");
  game.settings.register(MODULE_ID, "itemType", {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });
});

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = { open: openRuneBuilder, openRuneJournal, createItemFromJournal };
});

// Scene control button (Notes tools) so the GM can open the generator without a macro.
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;
  const notesControl = Array.isArray(controls)
    ? controls.find((c) => c.name === "notes")
    : controls?.notes;
  if (!notesControl) return;

  const tool = {
    name: "runaBuilder",
    title: "RUNABUILDER.OpenApp",
    icon: "fa-solid fa-hat-wizard",
    button: true,
    onClick: () => openRuneBuilder(),
    onChange: () => openRuneBuilder()
  };

  if (Array.isArray(notesControl.tools)) {
    notesControl.tools.push(tool);
  } else if (notesControl.tools && typeof notesControl.tools === "object") {
    notesControl.tools[tool.name] = tool;
  }
});

// Header buttons for ApplicationV2 sheets:
//  - rune items get "Open rune"
//  - rune journals get "Create item" (GM only) — works for runes generated earlier too
Hooks.on("getHeaderControlsApplicationV2", (app, controls) => {
  const doc = app.document;
  if (!doc) return;

  if (doc.documentName === "Item") {
    const uuid = doc.getFlag(MODULE_ID, FLAG_JOURNAL_UUID);
    if (!uuid) return;
    controls.push({
      icon: "fa-solid fa-hat-wizard",
      label: "RUNABUILDER.OpenRune",
      action: "sigilOpenRune",
      onClick: () => openRuneJournal(uuid)
    });
  } else if (doc.documentName === "JournalEntry" && game.user.isGM && isRuneJournal(doc)) {
    controls.push({
      icon: "fa-solid fa-box-archive",
      label: "RUNABUILDER.CreateItemFromJournal",
      action: "sigilCreateItem",
      onClick: () => createItemFromJournal(doc)
    });
  }
});

// Right-click menu in the Journal directory: "Create rune item".
// The hook name differs between Foundry versions, so both are registered.
function addJournalContextOption(options) {
  if (!game.user.isGM) return;
  const name = "RUNABUILDER.CreateItemFromJournal";
  if (options.some((o) => o.name === name)) return;
  const getId = (li) => {
    const el = li instanceof HTMLElement ? li : li?.[0];
    return el?.dataset?.entryId ?? el?.dataset?.documentId;
  };
  options.push({
    name,
    icon: '<i class="fa-solid fa-box-archive"></i>',
    condition: (li) => isRuneJournal(game.journal.get(getId(li))),
    callback: (li) => createItemFromJournal(game.journal.get(getId(li)))
  });
}
Hooks.on("getJournalEntryContextOptions", (_app, options) => addJournalContextOption(options));
Hooks.on("getJournalDirectoryEntryContext", (_html, options) => addJournalContextOption(options));

// Same button for systems that still use legacy (V1) item sheets.
Hooks.on("getItemSheetHeaderButtons", (sheet, buttons) => {
  const uuid = sheet.document?.getFlag(MODULE_ID, FLAG_JOURNAL_UUID);
  if (!uuid) return;
  buttons.unshift({
    label: game.i18n.localize("RUNABUILDER.OpenRune"),
    class: "sigil-open-rune",
    icon: "fa-solid fa-hat-wizard",
    onclick: () => openRuneJournal(uuid)
  });
});
