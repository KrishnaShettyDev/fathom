import { z } from "zod";
import { boundedJson, ProviderError } from "./shopify.js";
export function subjectMentions(
  answer: string,
  subjects: string[],
): Record<string, boolean> {
  const normalized = answer.normalize("NFKC").toLocaleLowerCase("en");
  return Object.fromEntries(
    subjects.map((subject) => {
      const escaped = subject
        .normalize("NFKC")
        .toLocaleLowerCase("en")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return [
        subject,
        new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(
          normalized,
        ),
      ];
    }),
  );
}
const responseSchema = z.object({
  id: z.string(),
  model: z.string(),
  status: z.string(),
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(z.object({ type: z.string(), text: z.string().optional() }))
        .optional(),
    }),
  ),
  usage: z
    .object({
      input_tokens: z.number().int(),
      output_tokens: z.number().int(),
      total_tokens: z.number().int(),
    })
    .optional(),
});
export async function observeQuestion(
  question: string,
  model: string,
  market: string,
  language: string,
  signal: AbortSignal,
) {
  const key = process.env.OPENAI_API_KEY;
  if (
    !key ||
    !process.env.OBSERVATION_MODEL ||
    model !== process.env.OBSERVATION_MODEL
  )
    throw new ProviderError("OBSERVATION_NOT_CONFIGURED");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: question,
      instructions: `Answer the question in ${language}. The requested market context is ${market}. Do not claim that your execution location has been verified.`,
      max_output_tokens: 1000,
      store: false,
    }),
  });
  const data = responseSchema.parse(await boundedJson(response));
  if (data.status !== "completed")
    throw new ProviderError("OBSERVATION_INCOMPLETE");
  const answer = data.output
    .flatMap((item) => (item.type === "message" ? (item.content ?? []) : []))
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("\n");
  if (!answer.trim()) throw new ProviderError("OBSERVATION_EMPTY");
  return {
    answer,
    responseId: data.id,
    model: data.model,
    usage: data.usage ?? null,
  };
}
