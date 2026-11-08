import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Signed-in pages (app/(app)): signed-out visitors go to sign-in here, before
// any page shell renders. The pages still check the user themselves.
// API routes are not listed: they answer 401/404 on their own, and webhooks,
// Inngest and one-click unsubscribe must stay reachable without a session.
const isAppPage = createRouteMatcher(["/home(.*)", "/spaces(.*)", "/planner(.*)", "/billing(.*)", "/settings(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isAppPage(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
