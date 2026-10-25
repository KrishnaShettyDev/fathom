import { revisionSnapshotSchema } from "./validation";
import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { cursorFilter, readCursor, type PageParams } from "../agency/queries";
export async function listFacts(brandId: string, params: PageParams) {
  const { client } = await requireUser();
  const cursor = readCursor(params);
  let query = client
    .from("brand_facts")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(26);
  if (cursor) query = query.or(cursorFilter(cursor));
  const { data, error } = await query;
  if (error) throw new Error("Brand knowledge could not be loaded.");
  return { rows: data.slice(0, 25), hasMore: data.length > 25 };
}
export async function getFact(brandId: string, id: string, params: PageParams) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireUser();
  const before =
    params.before === undefined
      ? 2147483647
      : z.coerce.number().int().positive().safeParse(params.before);
  if (typeof before !== "number" && !before.success) notFound();
  const boundary = typeof before === "number" ? before : before.data;
  const [fact, history] = await Promise.all([
    client
      .from("brand_facts")
      .select("*")
      .eq("brand_id", brandId)
      .eq("id", id)
      .maybeSingle(),
    client
      .from("brand_fact_revisions")
      .select("version,snapshot,actor_id,recorded_at")
      .eq("brand_id", brandId)
      .eq("fact_id", id)
      .lt("version", boundary)
      .order("version", { ascending: false })
      .limit(26),
  ]);
  if (fact.error || history.error)
    throw new Error("Fact history could not be loaded.");
  if (!fact.data) notFound();
  return {
    fact: fact.data,
    history: history.data.slice(0, 25).map((row) => ({
      ...row,
      snapshot: revisionSnapshotSchema.parse(row.snapshot),
    })),
    hasMore: history.data.length > 25,
  };
}
