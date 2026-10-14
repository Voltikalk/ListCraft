import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Всё, кроме статики, картинок, API генерации и превью для соцсетей.
    "/((?!_next/static|_next/image|api/|favicon.ico|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
