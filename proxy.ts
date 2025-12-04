import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  // Check if the user is accessing a protected route
  if (request.nextUrl.pathname.startsWith("/app")) {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // THIS IS NOT SECURE!
    // This is the recommended approach to optimistically redirect users
    // We recommend handling auth checks in each page/route
    if (!session) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs", // Required for auth.api calls
  matcher: ["/app/:path*"], // Specify the routes the proxy applies to
};

