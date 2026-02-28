import { updateSession } from "@/utils/supabase/middleware";
import { NextResponse } from "next/server";

export async function middleware(request) {
  try {
    // racing updateSession against a 1.4s timeout
    // if supabase auth is slow on the edge, we fall through instead of causing a 504
    const result = await Promise.race([
      updateSession(request),
      new Promise((resolve) =>
        setTimeout(() => resolve(NextResponse.next()), 1400)
      ),
    ]);
    return result;
  } catch (error) {
    console.error("Middleware session refresh failed:", error.message);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // running on page routes only — skipping api routes, auth callbacks, and static assets
    "/((?!_next/static|_next/image|favicon.ico|api/|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
