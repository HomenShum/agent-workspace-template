import type { NextConfig } from "next";

const redirects = [
  {
    source: "/packs/grounded-operator-rail",
    destination: "/packs/operator-chat-rail",
    permanent: true,
  },
  {
    source: "/packs/planner-workers-synthesizer",
    destination: "/packs/planning-and-worker-flow",
    permanent: true,
  },
  {
    source: "/packs/answer-packets-quality-gates",
    destination: "/packs/answer-review-and-quality-checks",
    permanent: true,
  },
  {
    source: "/packs/elicitation-first-operating-system",
    destination: "/packs/workflow-elicitation",
    permanent: true,
  },
  {
    source: "/packs/deterministic-plus-llm-hybrid",
    destination: "/packs/hybrid-runtime",
    permanent: true,
  },
  {
    source: "/packs/durable-streaming-events",
    destination: "/packs/durable-streaming",
    permanent: true,
  },
];

const nextConfig: NextConfig = {
  async redirects() {
    return redirects;
  },
};

export default nextConfig;
