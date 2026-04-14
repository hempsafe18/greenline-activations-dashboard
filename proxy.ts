import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// 1. Define which pages are public (just the homepage/login screen)
const isPublicRoute = createRouteMatcher(['/']);

// 2. The Bouncer: If it's NOT a public route, protect it!
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect(); // Redirects them to the login screen if they aren't logged in
  }
});

// 3. System config to tell the bouncer where to stand
export const config = {
  matcher: [
    // Skip Next.js internal background files and static files (images, fonts, etc.)
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run the bouncer on your API routes
    '/(api|trpc)(.*)',
  ],
};
