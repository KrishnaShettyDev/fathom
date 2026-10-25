import "server-only";
import { cookies } from "next/headers";
export async function selectBrandCookie(id: string) {
  (await cookies()).set("fathom-brand", id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
