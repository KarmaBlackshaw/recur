import { router, type Href, type NativeIntent } from "expo-router";
import { QUICK_ACTION_HREF, QUICK_ADD_URL_PREFIX, isWidgetQuickAction } from "@/constants/quickActions";
import { SHARE_URL_PREFIX } from "@/constants/shareIntent";
import { WIDGET_URL_PREFIX, widgetLinkHref } from "@/constants/widgetLinks";
import { smsShareHref } from "@/utils/sms/smsShareHref";
import { takeSharedText } from "@/utils/systemScreens";

// Warm taps are pushed here instead of left to default linking, which NAVIGATEs and would overwrite the params of an open form.
export const redirectSystemPath: NonNullable<NativeIntent["redirectSystemPath"]> = ({ path, initial }) => {
  try {
    if (path.startsWith(SHARE_URL_PREFIX)) {
      const text = takeSharedText();
      if (!text?.trim()) {
        return initial ? "/" : null;
      }
      const href = smsShareHref(text);
      if (initial) {
        return href;
      }
      router.push(href as Href);
      return null;
    }
    if (path.startsWith(WIDGET_URL_PREFIX)) {
      const href = widgetLinkHref(path);
      if (href === null) {
        return initial ? "/" : null;
      }
      if (initial) {
        return href;
      }
      // Home is already in the stack: pushing it again would stack a second copy over the open screen.
      if (href === "/") {
        router.navigate(href);
      } else {
        router.push(href as Href);
      }
      return null;
    }
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
    console.error("Opening link failed", error);
    return initial ? "/" : null;
  }
};
