import { defineTool } from "@lovable.dev/mcp-js";
import { ATTRIBUTES } from "@/engine/data";

export default defineTool({
  name: "list_questions",
  title: "List questions",
  description: "List every sensory question (attribute id, category, question text and hint) the genre engine can ask.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const questions = ATTRIBUTES.map((a) => ({ id: a.id, category: a.category, question: a.question, hint: a.hint }));
    return { content: [{ type: "text", text: JSON.stringify(questions) }], structuredContent: { questions } };
  },
});
