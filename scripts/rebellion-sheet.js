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
    },
    actions: {
      saveRebellion: CorbeauxRebellionSheet.saveRebellion,
      adjustAuthority: CorbeauxRebellionSheet.adjustAuthority,
      rollRebellion: CorbeauxRebellionSheet.rollRebellion,
      resetRebellion: CorbeauxRebellionSheet.resetRebellion
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
    const stored = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "rebellion") ?? {});
    const rebellion = this.constructor.prepareRebellionData(stored);
    const liberation = this.constructor.calculateLiberation(rebellion);
    const authority = Number(rebellion.authority ?? 100);
    const victoryRatio = authority > 0 ? Math.min(100, Math.round((liberation / authority) * 100)) : 100;

    context.actor = this.actor;
    context.editable = this.isEditable;
    context.rebellion = rebellion;
    context.authority = authority;
    context.liberation = liberation;
    context.victoryRatio = victoryRatio;

    context.assetGroups = STAT_KEYS.map((key) => {
      const assets = rebellion.assets[key];
      const total = assets.reduce((sum, asset) => sum + Number(asset.value ?? 0), 0);

      return {
        key,
        label: STAT_LABELS[key],
        assets,
        total
      };
    });

    return context;
  }

  static prepareRebellionData(data = {}) {
    const rebellion = {
      authority: Number.isFinite(Number(data.authority)) ? Number(data.authority) : 100,
      notes: typeof data.notes === "string" ? data.notes : "",
      assets: {}
    };

    for (const key of STAT_KEYS) {
      const sourceAssets = Array.isArray(data.assets?.[key]) ? data.assets[key] : [];

      rebellion.assets[key] = Array.from({ length: 10 }, (_unused, index) => {
        const source = sourceAssets[index] ?? {};

        return {
          name: typeof source.name === "string" ? source.name : "",
          value: this.clampAssetValue(source.value)
        };
      });
    }

    return rebellion;
  }

  static calculateLiberation(rebellion) {
    return STAT_KEYS.reduce((total, key) => {
      const assets = rebellion.assets?.[key] ?? [];

      return total + assets.reduce((subtotal, asset) => {
        return subtotal + this.clampAssetValue(asset.value);
      }, 0);
    }, 0);
  }

  static clampAssetValue(value) {
    const numeric = Number.parseInt(value, 10);

    if (!Number.isFinite(numeric)) return 0;
    return Math.clamp(numeric, 0, 9);
  }

  collectSheetData() {
    const root = this.element;
    const authorityInput = root.querySelector("[name='authority']");
    const notesInput = root.querySelector("[name='notes']");

    const rebellion = {
      authority: Number.parseInt(authorityInput?.value ?? "100", 10),
      notes: notesInput?.value ?? "",
      assets: {}
    };

    if (!Number.isFinite(rebellion.authority)) rebellion.authority = 100;

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

  async saveSheetData() {
    const rebellion = this.collectSheetData();
    await this.actor.setFlag(MODULE_ID, "rebellion", rebellion);
    return rebellion;
  }

  static async saveRebellion() {
    await this.saveSheetData();
    ui.notifications.info("Rébellion sauvegardée.");
    this.render();
  }

  static async adjustAuthority(event, target) {
    const rebellion = await this.saveSheetData();
    const root = this.element;
    const valueInput = root.querySelector("[name='authorityDelta']");
    const rawValue = Number.parseInt(valueInput?.value ?? "0", 10);
    const value = Number.isFinite(rawValue) ? rawValue : 0;
    const mode = target.dataset.mode;

    if (value <= 0) {
      ui.notifications.warn("Indique une valeur positive.");
      return;
    }

    if (mode === "captured") rebellion.authority += value;
    if (mode === "encounter") rebellion.authority -= value;

    rebellion.authority = Math.max(0, rebellion.authority);

    await this.actor.setFlag(MODULE_ID, "rebellion", rebellion);
    this.render();
  }

  static async rollRebellion(event, target) {
    const rebellion = await this.saveSheetData();
    const stat = target.dataset.stat;
    const assets = rebellion.assets?.[stat] ?? [];
    const total = assets.reduce((sum, asset) => sum + Number(asset.value ?? 0), 0);
    const label = STAT_LABELS[stat] ?? "Rébellion";

    const roll = new Roll("1d20 + @bonus", { bonus: total });
    await roll.evaluate();

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<strong>Action de rébellion — ${label}</strong><br>Bonus utilisé : ${total}`
    });
  }

  static async resetRebellion() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Réinitialiser la rébellion"
      },
      content: "<p>Réinitialiser les données de rébellion de cette fiche ?</p>",
      yes: {
        label: "Réinitialiser"
      },
      no: {
        label: "Annuler"
      }
    });

    if (!confirmed) return;

    await this.actor.setFlag(MODULE_ID, "rebellion", this.constructor.prepareRebellionData({}));
    this.render();
  }
}