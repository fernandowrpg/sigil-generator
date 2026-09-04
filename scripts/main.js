import { RuneBuilderApp } from "./rune-app.js";

const MODULE_ID = "sigil-generator";

function openRuneBuilder() {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("RUNABUILDER.OnlyGM"));
    return null;
  }
  const app = new RuneBuilderApp();
  app.render(true);
  return app;
}

Hooks.once("init", () => {
  console.log("Runa Builder | inicializando");
});

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = { open: openRuneBuilder };
});

// Adds a button to the Notes scene controls so the GM can open the generator
// without needing a macro.
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
