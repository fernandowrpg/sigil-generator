import { generateRune } from "./rune-generator.js";
import { createRuneJournalAndChest } from "./create-content.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class RuneBuilderApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "sigil-generator-app",
    tag: "form",
    window: {
      title: "RUNABUILDER.Title",
      icon: "fa-solid fa-hat-wizard",
      resizable: true
    },
    position: { width: 460, height: "auto" },
    actions: {
      regenerate: RuneBuilderApp.#onRegenerate,
      applySeed: RuneBuilderApp.#onApplySeed,
      create: RuneBuilderApp.#onCreate
    }
  };

  static PARTS = {
    body: { template: `modules/sigil-generator/templates/rune-app.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this.seed = options.seed ?? Math.floor(Math.random() * 1_000_000_000);
    this._generate();
  }

  _generate() {
    this.rune = generateRune(this.seed);
  }

  /** @override */
  async _prepareContext(_options) {
    return {
      svg: this.rune.svg,
      seed: this.seed,
      name: this.rune.name,
      power: this.rune.power,
      description: this.rune.description,
      isGM: game.user.isGM
    };
  }

  _readForm() {
    const el = this.element;
    return {
      name: el.querySelector('[name="name"]')?.value,
      power: el.querySelector('[name="power"]')?.value,
      description: el.querySelector('[name="description"]')?.value
    };
  }

  static #onRegenerate(_event, _target) {
    this.seed = Math.floor(Math.random() * 1_000_000_000);
    this._generate();
    this.render();
  }

  static #onApplySeed(_event, _target) {
    const input = this.element.querySelector('[name="seed"]');
    const value = parseInt(input?.value, 10);
    if (Number.isFinite(value)) {
      this.seed = Math.abs(value);
      this._generate();
      this.render();
    }
  }

  static async #onCreate(_event, target) {
    target.disabled = true;
    try {
      const overrides = this._readForm();
      const result = await createRuneJournalAndChest(this.rune, overrides);
      if (result?.journal) this.close();
    } catch (err) {
      console.error("Runa Builder |", err);
      ui.notifications.error(game.i18n.localize("RUNABUILDER.Error"));
    } finally {
      target.disabled = false;
    }
  }
}
