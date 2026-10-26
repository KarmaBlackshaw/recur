import createIconSet from "@expo/vector-icons/createIconSet";
import { IONICON_GLYPHS } from "@/constants/ionicons";

// Ionicons from a font holding only the glyphs in constants/ionicons.ts (5 KB instead of 390 KB).
export const Ionicon = createIconSet(IONICON_GLYPHS, "ionicons-subset", require("@/assets/fonts/ionicons/Ionicons-Subset.ttf"));
