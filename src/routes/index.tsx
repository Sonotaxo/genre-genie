import { createFileRoute } from "@tanstack/react-router";
import { AudioAkinator } from "@/components/AudioAkinator";

const title = "Audio-Akinator — Guess Any Music Genre";
const description = "Answer simple questions about what you hear and Audio-Akinator identifies the music genre in about 10 taps.";

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
  component: AudioAkinator,
});
