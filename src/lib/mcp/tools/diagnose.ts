import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { AkinatorEngine } from "@/engine/engine";
import { ATTRIBUTES, GENRES } from "@/engine/data";

export default defineTool({
  name: "diagnose_genre",
  title: "Diagnose genre",
  description:
    "Run the genre-guessing engine on a list of answers and return the most likely genres, whether it is confident, and the best next question to ask.",
  inputSchema: {
    answers: z
      .array(z.object({
        attributeId: z.string().describe("Question id from list_questions."),
        value: z.number().min(-1).max(1).describe("1 yes, 0.5 probably, 0 don't know, -0.5 probably not, -1 no."),
      }))
      .default([])
      .describe("Answers given so far."),
    family: z.enum(["electronic", "rock", "hiphop", "jazz", "acoustic"]).optional().describe("Limit to one genre family."),
    parent: z.string().optional().describe("Genre id to pinpoint its subgenres, e.g. 'house'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ answers, family, parent }) => {
    for (const a of answers) {
      if (!ATTRIBUTES.some((x) => x.id === a.attributeId)) throw new ToolError(`Unknown question id '${a.attributeId}'.`);
    }
    if (parent && !GENRES.some((g) => g.parent === parent)) throw new ToolError(`'${parent}' has no subgenres.`);
    const e = new AkinatorEngine({ ...(family && { family }), ...(parent && { parent }) });
    for (const a of answers) e.answer(a.attributeId, a.value);
    const next = e.nextQuestion();
    const result = {
      topCandidates: e.ranked().slice(0, 5).map((r) => ({ id: r.genre.id, name: r.genre.name, probability: Number(r.prob.toFixed(4)) })),
      certainty: Number(e.certainty().toFixed(4)),
      converged: e.isConverged(),
      nextQuestion: next ? { id: next.attribute.id, category: next.attribute.category, question: next.attribute.question, hint: next.attribute.hint } : null,
    };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
