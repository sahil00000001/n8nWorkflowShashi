import { shashiPack } from "./shashi.js";
import { sahilPack } from "./sahil.js";

export const PACKS = {
  shashi: shashiPack,
  sahil: sahilPack,
};

export const OWNER_IDS = ["sahil", "shashi"];

export const DEFAULT_OWNER = "sahil";

export function getPack(ownerId) {
  return PACKS[ownerId] || PACKS[DEFAULT_OWNER];
}

export function listPacks() {
  return OWNER_IDS.map((id) => PACKS[id]);
}
