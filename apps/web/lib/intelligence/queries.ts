import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { cursorFilter, readCursor, type PageParams } from "../agency/queries";
import { reportSnapshotSchema } from "./validation";
export async function listOpportunities(brandId: string, params: PageParams) {
  const { client } = await requireUser();
  const cursor = readCursor(params);
  let q = client
    .from("opportunities")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(26);
  if (cursor) q = q.or(cursorFilter(cursor));
  const { data, error } = await q;
  if (error) throw new Error("Opportunities could not be loaded.");
  return { rows: data.slice(0, 25), hasMore: data.length > 25 };
}
export async function getOpportunity(
  brandId: string,
  id: string,
  params: PageParams,
) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireUser();
  const cursor = readCursor(params);
  let events = client
    .from("opportunity_events")
    .select("*")
    .eq("brand_id", brandId)
    .eq("opportunity_id", id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(26);
  if (cursor) events = events.or(cursorFilter(cursor));
  const [result, history] = await Promise.all([
    client
      .from("opportunities")
      .select("*")
      .eq("brand_id", brandId)
      .eq("id", id)
      .maybeSingle(),
    events,
  ]);
  if (result.error || history.error)
    throw new Error("Opportunity could not be loaded.");
  if (!result.data) notFound();
  const { data: fact, error } = await client
    .from("brand_fact_revisions")
    .select("snapshot")
    .eq("brand_id", brandId)
    .eq("fact_id", result.data.fact_id)
    .eq("version", result.data.fact_version)
    .single();
  if (error) throw new Error("Supporting evidence could not be loaded.");
  return {
    opportunity: result.data,
    fact: fact.snapshot,
    events: history.data.slice(0, 25),
    hasMore: history.data.length > 25,
  };
}
export async function listReports(brandId: string, params: PageParams) {
  const { client } = await requireUser();
  const cursor = readCursor(params);
  let q = client
    .from("client_reports")
    .select("id,title,range_start,range_end,created_at")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(26);
  if (cursor) q = q.or(cursorFilter(cursor));
  const { data, error } = await q;
  if (error) throw new Error("Reports could not be loaded.");
  return { rows: data.slice(0, 25), hasMore: data.length > 25 };
}
export async function getReport(brandId: string, id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireUser();
  const { data, error } = await client
    .from("client_reports")
    .select("*")
    .eq("brand_id", brandId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Report could not be loaded.");
  if (!data) notFound();
  return { ...data, snapshot: reportSnapshotSchema.parse(data.snapshot) };
}
