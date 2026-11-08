/** The app's public base URL for links in emails (APP_URL; localhost in development). */
export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}
