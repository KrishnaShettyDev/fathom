import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "../auth/session";
export type PageParams = Record<string, string | string[] | undefined>;
export function readCursor(params: PageParams, prefix = "") {
  if (
    params[`${prefix}before`] === undefined &&
    params[`${prefix}cursor`] === undefined
  )
    return null;
  const parsed = z
    .object({ before: z.iso.datetime({ offset: true }), cursor: z.uuid() })
    .safeParse({
      before: params[`${prefix}before`],
      cursor: params[`${prefix}cursor`],
    });
  if (!parsed.success) notFound();
  return parsed.data;
}
export function cursorFilter(cursor: { before: string; cursor: string }) {
  return `created_at.lt.${cursor.before},and(created_at.eq.${cursor.before},id.lt.${cursor.cursor})`;
}
export function nextPage(
  path: string,
  row: { id: string; created_at: string },
  prefix = "",
) {
  const params = new URLSearchParams({
    [`${prefix}before`]: row.created_at,
    [`${prefix}cursor`]: row.id,
  });
  return `${path}?${params}`;
}
export async function getAgencies() {
  const { client } = await requireUser();
  const { data, error } = await client
    .from("agency_organizations")
    .select("organization_id,created_at,organizations!inner(name)")
    .order("created_at")
    .limit(100);
  if (error) throw new Error("Agency organizations could not be loaded.");
  return data.map((row) => ({
    id: row.organization_id,
    name: row.organizations.name,
    createdAt: row.created_at,
  }));
}
export function accessLabel(level: string) {
  return level === "operator" ? "Connection operator" : "Read-only analyst";
}
