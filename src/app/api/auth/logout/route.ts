import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

/** Clear the session cookie and return to the home page. */
export async function POST(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
