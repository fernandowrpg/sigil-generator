import { generateRune } from "./rune-generator.js";
import {
  createRuneJournalAndChest,
  getItemTypes,
  getItemTypeLabel,
  guessItemType
} from "./create-content.js";

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
    this.opts = { createItem: true, reveal: true, itemType: "", actorId: "" };
    this._generate();
  }

  _generate() {
    this.rune = generateRune(this.seed);
  }

  /** @override */
  async _prepareContext(_options) {
    const types = getItemTypes();
    const selectedType = types.includes(this.opts.itemType) ? this.opts.itemType : guessItemType(types);
    const itemTypes = types.map((t) => ({
      value: t,
      label: getItemTypeLabel(t),
      selected: t === selectedType
    }));
    const actors = game.actors.contents
      .filter((a) => a.hasPlayerOwner)
      .map((a) => ({ id: a.id, name: a.name, selected: a.id === this.opts.actorId }));

    return {
      svg: this.rune.svg,
      seed: this.seed,
      name: this.rune.name,
      power: this.rune.power,
      description: this.rune.description,
      isGM: game.user.isGM,
      createItem: this.opts.createItem,
      reveal: this.opts.reveal,
      itemTypes,
      hasItemTypes: itemTypes.length > 0,
      actors
    };
  }

  /** Reads the text fields the user may have edited. */
  _readForm() {
    const el = this.element;
    return {
      name: el.querySelector('[name="name"]')?.value,
      power: el.querySelector('[name="power"]')?.value,
      description: el.querySelector('[name="description"]')?.value,
      ...this._readOptions()
    };
  }

  /** Reads the item / delivery / visibility options. */
  _readOptions() {
    const el = this.element;
    return {
      createItem: el.querySelector('[name="createItem"]')?.checked ?? true,
      reveal: el.querySelector('[name="reveal"]')?.checked ?? true,
      itemType: el.querySelector('[name="itemType"]')?.value ?? "",
      actorId: el.querySelector('[name="actorId"]')?.value ?? ""
    };
  }

  static #onRegenerate(_event, _target) {
    this.opts = this._readOptions();
    this.seed = Math.floor(Math.random() * 1_000_000_000);
    this._generate();
    this.render();
  }

  static #onApplySeed(_event, _target) {
    const input = this.element.querySelector('[name="seed"]');
    const value = parseInt(input?.value, 10);
    if (Number.isFinite(value)) {
      this.opts = this._readOptions();
      this.seed = Math.abs(value);
      this._generate();
      this.render();
    }
  }

  static async #onCreate(_event, target) {
    target.disabled = true;
    try {
      const result = await createRuneJournalAndChest(this.rune, this._readForm());
      if (result?.journal) this.close();
    } catch (err) {
      console.error("Sigil Generator |", err);
      ui.notifications.error(game.i18n.localize("RUNABUILDER.Error"));
    } finally {
      target.disabled = false;
    }
  }
}
