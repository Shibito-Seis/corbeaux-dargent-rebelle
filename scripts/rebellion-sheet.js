const MODULE_ID = "corbeaux-dargent-rebelle";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const STAT_KEYS = ["loyalty", "secrecy", "security"];

const STAT_LABELS = {
  loyalty: "Loyauté",
  secrecy: "Discrétion",
  security: "Sécurité"
};

export class CorbeauxRebellionSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["corbeaux-rebellion", "sheet", "actor"],
    position: {
      width: 940,
      height: 720
    },
    window: {
      title: "Corbeaux d'Argent - Rébellion",
      resizable: true
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/rebellion-sheet.hbs`,
      scrollable: [".rebellion-body"]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor ?? this.document;
    const stored = foundry.utils.deepClone(actor.getFlag(MODULE_ID, "rebellion") ?? {});
    const rebellion = this.constructor.prepareRebellionData(stored);

    context.actor = actor;
    context.editable = this.isEditable;
    context.rebellion = rebellion;

    context.assetGroups = STAT_KEYS.map((key) => {
      return {
        key,
        label: STAT_LABELS[key],
        assets: rebellion.assets[key]
      };
    });

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const root = this.element;
    if (!root) return;

    root.querySelector("[data-rebellion-save]")?.addEventListener("click", async (event) => {
      event.preventDefault();
      await this.saveSheetData({ notify: true, render: true });
    });

    root.querySelector("[data-rebellion-reset]")?.addEventListener("click", async (event) => {
      event.preventDefault();
      await this.resetRebellionData();
    });

    root.querySelectorAll("input, textarea").forEach((input) => {
      input.addEventListener("change", async () => {
        await this.saveSheetData({ notify: false, render: false });
      });
    });
  }

  static prepareRebellionData(data = {}) {
    const rebellion = {
      notoriety: this.clampNonNegative(data.notoriety, 0),
      authority: this.clampNonNegative(data.authority, 100),
      liberation: this.clampNonNegative(data.liberation, 0),
      notes: typeof data.notes === "string" ? data.notes : "",
      assets: {}
    };

    for (const key of STAT_KEYS) {
      const sourceAssets = Array.isArray(data.assets?.[key]) ? data.assets[key] : [];

      rebellion.assets[key] = Array.from({ length: 10 }, (_unused, index) => {
        const source = sourceAssets[index] ?? {};

        return {
          displayIndex: index + 1,
          name: typeof source.name === "string" ? source.name : "",
          value: this.clampAssetValue(source.value)
        };
      });
    }

    return rebellion;
  }

  static clampAssetValue(value) {
    const numeric = Number.parseInt(value, 10);

    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(9, numeric));
  }

  static clampNonNegative(value, fallback = 0) {
    const numeric = Number.parseInt(value, 10);

    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, numeric);
  }

  collectSheetData() {
    const root = this.element;

    const rebellion = {
      notoriety: this.constructor.clampNonNegative(root.querySelector("[name='notoriety']")?.value, 0),
      authority: this.constructor.clampNonNegative(root.querySelector("[name='authority']")?.value, 100),
      liberation: this.constructor.clampNonNegative(root.querySelector("[name='liberation']")?.value, 0),
      notes: root.querySelector("[name='notes']")?.value ?? "",
      assets: {}
    };

    for (const key of STAT_KEYS) {
      rebellion.assets[key] = [];

      for (let index = 0; index < 10; index++) {
        const nameInput = root.querySelector(`[name='${key}.${index}.name']`);
        const valueInput = root.querySelector(`[name='${key}.${index}.value']`);

        rebellion.assets[key].push({
          name: nameInput?.value ?? "",
          value: this.constructor.clampAssetValue(valueInput?.value ?? 0)
        });
      }
    }

    return this.constructor.prepareRebellionData(rebellion);
  }

  async saveSheetData({ notify = false, render = false } = {}) {
    if (!this.isEditable) {
      if (notify) ui.notifications.warn("Tu n'as pas les droits nécessaires pour modifier cette fiche.");
      return null;
    }

    const actor = this.actor ?? this.document;
    const rebellion = this.collectSheetData();

    try {
      await actor.setFlag(MODULE_ID, "rebellion", rebellion);

      if (notify) ui.notifications.info("Rébellion sauvegardée.");
      if (render) this.render();

      return rebellion;
    } catch (error) {
      console.error(`${MODULE_ID} | Échec de sauvegarde de la rébellion`, error);
      ui.notifications.error("Échec de sauvegarde de la fiche de rébellion.");
      return null;
    }
  }

  async resetRebellionData() {
    if (!this.isEditable) {
      ui.notifications.warn("Tu n'as pas les droits nécessaires pour réinitialiser cette fiche.");
      return;
    }

    const confirmed = globalThis.confirm("Réinitialiser les données de rébellion de cette fiche ?");
    if (!confirmed) return;

    const actor = this.actor ?? this.document;
    await actor.setFlag(MODULE_ID, "rebellion", this.constructor.prepareRebellionData({}));
    this.render();
  }
}