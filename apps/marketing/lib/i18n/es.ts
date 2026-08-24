import type { Dictionary } from "./en";
import { core } from "./dicts/core";
import { welcome } from "./dicts/welcome";

// Spanish dictionary. Typed as Dictionary so it must mirror the exact shape of `en`.
export const es: Dictionary = {
  ...core.es,
  welcome: welcome.es,
};
