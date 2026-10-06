import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { GENRES } from "@/engine/data";

export default defineTool({
  name: "get_genre",
  title: "Get genre",
  description: "Get a genre's description, family, parent genre, subgenres and a benchmark track. Omit id to list all genres.",
  inputSchema: { id: z.string().optional().describe("Genre id, e.g. 'tech_house'. Omit to list all genres.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ id }) => {
    if (!id) {
      const genres = GENRES.map((g) => ({ id: g.id, name: g.name, family: g.family, parent: g.parent }));
      return { content: [{ type: "text", text: JSON.stringify(genres) }], structuredContent: { genres } };
    }
    const g = GENRES.find((x) => x.id === id);
    if (!g) throw new ToolError(`Unknown genre id '${id}'. Call get_genre without an id to list them.`);
    const genre = {
      id: g.id, name: g.name, family: g.family, parent: g.parent, summary: g.summary,
      benchmark: { artist: g.benchmark.artist, title: g.benchmark.title },
      subgenres: GENRES.filter((s) => s.parent === g.id).map((s) => s.id),
    };
    return { content: [{ type: "text", text: JSON.stringify(genre) }], structuredContent: { genre } };
  },
});
