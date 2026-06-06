import { createServerFn } from "@tanstack/react-start";

// Public: returns the widget config the browser needs to boot MSG91.
// widgetId + tokenAuth are public values (they ship in the browser bundle of
// any MSG91-using site). Keeping them in env makes rotation trivial.
export const getMsg91Config = createServerFn({ method: "GET" }).handler(async () => {
  return {
    widgetId: process.env.MSG91_WIDGET_ID ?? "",
    tokenAuth: process.env.MSG91_TOKEN_AUTH ?? "",
  };
});
