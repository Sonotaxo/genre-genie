import { createFileRoute } from "@tanstack/react-router";
import { GenreGenie } from "@/components/GenreGenie";

const title = "Genre Genie — Guess Any Music Genre";
const description = "Answer simple questions about what you hear and Genre Genie identifies the music genre in about 10 taps.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GenreGenie,
});
