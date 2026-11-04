import { router, type NativeIntent } from "expo-router";
import { QUICK_ACTION_HREF, QUICK_ADD_URL_PREFIX, isWidgetQuickAction } from "@/constants/quickActions";

// Warm taps are pushed here instead of left to default linking, which NAVIGATEs and would overwrite the params of an open form.
export const redirectSystemPath: NonNullable<NativeIntent["redirectSystemPath"]> = ({ path, initial }) => {
  try {
    if (!path.startsWith(QUICK_ADD_URL_PREFIX)) {
      return path;
    }
    const [remainder] = path.slice(QUICK_ADD_URL_PREFIX.length).split(/[?#]/);
    const action = remainder.replace(/\/+$/, "");
    if (!isWidgetQuickAction(action)) {
      return initial ? "/" : null;
    }
    if (initial) {
      return QUICK_ACTION_HREF[action];
    }
    router.push(QUICK_ACTION_HREF[action]);
    return null;
  } catch (error) {
    console.error("Quick-add widget link failed", error);
    return initial ? "/" : null;
  }
};
