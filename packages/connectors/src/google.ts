import { z } from "zod";
import { boundedJson, ProviderError } from "./shopify.js";
export const googleScopes = {
  gsc: "https://www.googleapis.com/auth/webmasters.readonly",
  ga4: "https://www.googleapis.com/auth/analytics.readonly",
} as const;
export const googleTokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
  scope: z.string(),
});
export type GoogleProvider = keyof typeof googleScopes;
export function propertyReference(
  provider: GoogleProvider,
  value: string,
): string {
  if (provider === "ga4")
    return z
      .string()
      .regex(/^properties\/\d+$/)
      .parse(value);
  if (/^sc-domain:[a-zA-Z0-9.-]+$/.test(value)) return value;
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  )
    throw new ProviderError("INVALID_PROPERTY");
  return value;
}
export async function googleToken(
  fields: Record<string, string>,
  previous?: z.infer<typeof googleTokenSchema>,
) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  const raw = googleTokenSchema
    .partial({ refresh_token: true, scope: true })
    .parse(await boundedJson(response));
  return googleTokenSchema.parse({
    ...raw,
    refresh_token: raw.refresh_token ?? previous?.refresh_token,
    scope: raw.scope ?? previous?.scope,
  });
}
async function googleJson(url: string, token: string, body?: unknown) {
  return boundedJson(
    await fetch(url, {
      method: body ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}
export async function verifyGoogleProperty(
  provider: GoogleProvider,
  reference: string,
  token: string,
) {
  const selected = propertyReference(provider, reference);
  if (provider === "gsc") {
    const result = z
      .object({ siteUrl: z.string(), permissionLevel: z.string() })
      .parse(
        await googleJson(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(selected)}`,
          token,
        ),
      );
    if (
      result.siteUrl !== selected ||
      !["siteOwner", "siteFullUser", "siteRestrictedUser"].includes(
        result.permissionLevel,
      )
    )
      throw new ProviderError("PROPERTY_ACCESS_DENIED");
    return {
      reference: selected,
      timezone: "America/Los_Angeles",
      metadata: { permissionLevel: result.permissionLevel },
    };
  }
  const result = z
    .object({
      name: z.string(),
      timeZone: z.string(),
      currencyCode: z.string().optional(),
      displayName: z.string().optional(),
    })
    .parse(
      await googleJson(
        `https://analyticsadmin.googleapis.com/v1beta/${selected}`,
        token,
      ),
    );
  if (result.name !== selected) throw new ProviderError("PROPERTY_MISMATCH");
  return {
    reference: selected,
    timezone: result.timeZone,
    metadata: {
      currencyCode: result.currencyCode,
      displayName: result.displayName,
    },
  };
}
export function dateRange(start: string, end: string): string[] {
  z.iso.date().parse(start);
  z.iso.date().parse(end);
  const result = [];
  for (
    let date = Date.parse(start);
    date <= Date.parse(end);
    date += 86400000
  ) {
    if (result.length >= 31) throw new ProviderError("DATE_RANGE_TOO_LARGE");
    result.push(new Date(date).toISOString().slice(0, 10));
  }
  if (!result.length) throw new ProviderError("INVALID_DATE_RANGE");
  return result;
}
const gscSchema = z.object({
  rows: z
    .array(
      z.object({
        keys: z.tuple([z.iso.date()]),
        clicks: z.number().int().nonnegative().safe(),
        impressions: z.number().int().nonnegative().safe(),
        ctr: z.number().min(0).max(1),
        position: z.number().nonnegative(),
      }),
    )
    .default([]),
  responseAggregationType: z.string().optional(),
});
const decimal = z.string().regex(/^\d+(\.\d+)?$/);
const ga4Schema = z.object({
  dimensionHeaders: z.array(z.object({ name: z.string() })).default([]),
  metricHeaders: z.array(z.object({ name: z.string() })).default([]),
  rows: z
    .array(
      z.object({
        dimensionValues: z.tuple([
          z.object({ value: z.string().regex(/^\d{8}$/) }),
        ]),
        metricValues: z.tuple([
          z.object({ value: decimal }),
          z.object({ value: decimal }),
          z.object({ value: decimal }),
        ]),
      }),
    )
    .default([]),
  rowCount: z.number().int().nonnegative().default(0),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export function normalizeDaily(
  provider: GoogleProvider,
  raw: unknown,
  start: string,
  end: string,
) {
  const dates = dateRange(start, end);
  const rows = new Map<string, Record<string, string | number>>();
  let metadata: Record<string, unknown> = {};
  if (provider === "gsc") {
    const data = gscSchema.parse(raw);
    metadata = {
      method: "Search Console date dimension, web search, final data",
      aggregation: data.responseAggregationType ?? null,
      limitations:
        "Search Console API may omit rows; absent dates remain unavailable.",
    };
    for (const row of data.rows) {
      const date = row.keys[0];
      if (rows.has(date) || !dates.includes(date))
        throw new ProviderError("INVALID_DATE_ROWS");
      rows.set(date, {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      });
    }
  } else {
    const data = ga4Schema.parse(raw);
    if (
      data.dimensionHeaders.map((h) => h.name).join(",") !== "date" ||
      data.metricHeaders.map((h) => h.name).join(",") !==
        "sessions,totalUsers,keyEvents" ||
      data.rowCount !== data.rows.length
    )
      throw new ProviderError("INCOMPLETE_ANALYTICS_RESPONSE");
    metadata = {
      ...data.metadata,
      method:
        "GA4 daily sessions, totalUsers and keyEvents; keepEmptyRows enabled",
    };
    for (const row of data.rows) {
      const rawDate = row.dimensionValues[0].value;
      const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      if (rows.has(date) || !dates.includes(date))
        throw new ProviderError("INVALID_DATE_ROWS");
      rows.set(date, {
        sessions: row.metricValues[0].value,
        totalUsers: row.metricValues[1].value,
        keyEvents: row.metricValues[2].value,
      });
    }
  }
  return dates.map((date) => ({
    date,
    metrics: rows.get(date) ?? null,
    metadata,
  }));
}
export async function collectDaily(
  provider: GoogleProvider,
  reference: string,
  token: string,
  start: string,
  end: string,
) {
  propertyReference(provider, reference);
  dateRange(start, end);
  const raw =
    provider === "gsc"
      ? await googleJson(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(reference)}/searchAnalytics/query`,
          token,
          {
            startDate: start,
            endDate: end,
            dimensions: ["date"],
            type: "web",
            dataState: "final",
            rowLimit: 1000,
          },
        )
      : await googleJson(
          `https://analyticsdata.googleapis.com/v1beta/${reference}:runReport`,
          token,
          {
            dateRanges: [{ startDate: start, endDate: end }],
            dimensions: [{ name: "date" }],
            metrics: [
              { name: "sessions" },
              { name: "totalUsers" },
              { name: "keyEvents" },
            ],
            keepEmptyRows: true,
            limit: "1000",
            returnPropertyQuota: true,
          },
        );
  return normalizeDaily(provider, raw, start, end);
}
