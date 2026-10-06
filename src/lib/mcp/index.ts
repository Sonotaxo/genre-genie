import { defineMcp } from "@lovable.dev/mcp-js";
import listQuestions from "./tools/list-questions";
import getGenre from "./tools/get-genre";
import diagnose from "./tools/diagnose";

export default defineMcp({
  name: "genre-genie",
  title: "Genre Genie",
  version: "0.1.0",
  instructions:
    "Identify a music genre by asking simple sensory questions. Call diagnose_genre with an empty answer list to get the first question, ask the user, then call it again with all answers so far until converged is true. Use get_genre for details and list_questions to see all questions.",
  tools: [diagnose, listQuestions, getGenre],
});
