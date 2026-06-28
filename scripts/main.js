import { CorbeauxRebellionSheet } from "./rebellion-sheet.js";

const MODULE_ID = "corbeaux-dargent-rebelle";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initialisation du module.`);

  foundry.documents.collections.Actors.registerSheet(MODULE_ID, CorbeauxRebellionSheet, {
    types: ["party"],
    label: "Corbeaux d'Argent - Rébellion",
    makeDefault: false
  });
});