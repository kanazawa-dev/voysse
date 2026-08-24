// English dictionary (source of truth). `es.ts` mirrors this exact shape.
// Access with dotted paths, e.g. t("nav.clients"), t("welcome.hero.sub").
import { core } from "./dicts/core";
import { welcome } from "./dicts/welcome";

export const en = {
  ...core.en,
  welcome: welcome.en,
};

export type Dictionary = typeof en;
