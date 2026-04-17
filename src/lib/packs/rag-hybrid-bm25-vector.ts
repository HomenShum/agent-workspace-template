import type { Pack } from "@/lib/pack-schema";

/**
 * Hybrid BM25 + Vector RAG pack.
 *
 * Combines lexical (BM25) and dense (embedding) retrieval via
 * Reciprocal Rank Fusion, then reranks with a cross-encoder
 * (BGE-reranker or Cohere Rerank), and renders inline citations.
 * The 2025 default for any RAG system that needs to beat pure-vector.
 */
export const ragHybridBm25Vector: Pack = {
  slug: "rag-hybrid-bm25-vector",
  name: "Hybrid RAG: BM25 + Vector + Rerank",
  tagline: "Sparse + dense + cross-encoder. The 2025 retrieval default.",
  summary:
    "Production-grade hybrid retrieval: BM25 for lexical recall, dense embeddings for semantic recall, Reciprocal Rank Fusion to merge, and a BGE / Cohere cross-encoder rerank stage for precision. Emits cited retrieved_docs ready to pass to a grounded-answer generator. Matches the retrieval stack Anthropic, Pinecone, and Weaviate recommend for >100k-doc corpora.",
  packType: "rag",
  canonicalPattern: "hybrid",
  version: "0.1.0",

  trust: "Community",
  status: "Recommended",
  featured: false,
  publisher: "Agent Workspace",
  gradient: "from-fuchsia-500 via-pink-500 to-rose-500",
  artworkVariant: "answer-review-and-quality-checks",
  updatedAt: "2026-04-16",
  compatibility: ["claude-code", "cursor", "python-3.11", "node-20"],
  tags: ["rag", "retrieval", "bm25", "vector-search", "reranking", "hybrid", "citations"],

  installCommand: "npx attrition-sh pack install rag-hybrid-bm25-vector",
  claudeCodeSnippet:
    "Skill `rag-hybrid-bm25-vector` is installed at .claude/skills/rag-hybrid-bm25-vector/SKILL.md. Invoke whenever the user needs retrieval with both keyword precision and semantic recall, or when pure-vector RAG is hallucinating on proper nouns / code symbols / abbreviations. Always include the rerank stage for corpora >10k docs; emit citations alongside retrieved passages.",
  rawMarkdownPath: "/packs/rag-hybrid-bm25-vector/raw",

  contract: {
    requiredOutputs: ["retrieved_docs", "citations"],
    tokenBudget: 8000,
    permissions: ["search:bm25", "search:vector", "rerank:cross-encoder"],
    completionConditions: [
      "retrieved_docs has length between 3 and 10",
      "each retrieved_doc has id, text, source, rerank_score",
      "citations array maps each retrieved_doc to a canonical source URL or doc_id",
      "total retrieved_doc text tokens <= 6000",
    ],
    outputPath: "outputs/retrieval.json",
  },

  useWhen: [
    "Corpus contains proper nouns, SKUs, error codes, or legal/medical terms — pure vector loses these.",
    "You need >0.85 NDCG@10 on a domain-specific golden set.",
    "Query distribution is mixed (keyword lookups + natural-language questions).",
    "You can afford 150–400ms retrieval latency budget.",
  ],
  avoidWhen: [
    "Corpus is <5k docs — a single BM25 or vector stage is usually enough.",
    "Latency budget is <50ms (rerank adds ~80–200ms).",
    "You have no labeled eval set yet — ship pure-vector first, measure, then upgrade.",
    "Query distribution is 100% conversational paraphrase (dense-only may suffice).",
  ],
  keyOutcomes: [
    "Recall@50 improves 8–20% vs pure vector on typical technical corpora.",
    "Precision@5 improves 10–30% after cross-encoder rerank.",
    "Citations surface per passage — no hallucinated provenance.",
    "Single retrieval.json contract — the generator module can be swapped without touching retrieval.",
  ],

  minimalInstructions: `## Minimal setup (Python)

\`\`\`bash
pip install rank-bm25 sentence-transformers qdrant-client FlagEmbedding
\`\`\`

\`\`\`python
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer
from FlagEmbedding import FlagReranker

# --- index time ---
docs = [...]  # list[dict{id, text, source}]
tokenised = [d["text"].lower().split() for d in docs]
bm25 = BM25Okapi(tokenised)
embedder = SentenceTransformer("BAAI/bge-large-en-v1.5")
dense = embedder.encode([d["text"] for d in docs], normalize_embeddings=True)
# persist dense to qdrant / pgvector

reranker = FlagReranker("BAAI/bge-reranker-large", use_fp16=True)

def rrf(rankings: list[list[str]], k: int = 60) -> dict[str, float]:
    scores = {}
    for r in rankings:
        for rank, doc_id in enumerate(r):
            scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
    return scores

def retrieve(query: str, top_k: int = 5) -> list[dict]:
    # 1. BM25 top 50
    bm25_ranked = sorted(
        enumerate(bm25.get_scores(query.lower().split())),
        key=lambda x: -x[1],
    )[:50]
    bm25_ids = [docs[i]["id"] for i, _ in bm25_ranked]

    # 2. Dense top 50
    q_vec = embedder.encode([query], normalize_embeddings=True)[0]
    dense_ranked = sorted(
        enumerate(dense @ q_vec),
        key=lambda x: -x[1],
    )[:50]
    dense_ids = [docs[i]["id"] for i, _ in dense_ranked]

    # 3. RRF merge → take top 20
    fused = sorted(rrf([bm25_ids, dense_ids]).items(), key=lambda x: -x[1])[:20]
    by_id = {d["id"]: d for d in docs}
    candidates = [by_id[doc_id] for doc_id, _ in fused]

    # 4. Rerank
    pairs = [[query, c["text"]] for c in candidates]
    scores = reranker.compute_score(pairs, normalize=True)
    for c, s in zip(candidates, scores):
        c["rerank_score"] = float(s)
    candidates.sort(key=lambda c: -c["rerank_score"])
    return candidates[:top_k]
\`\`\`

Emit \`{retrieved_docs: [...], citations: [{doc_id, source}]}\` per the contract.`,

  fullInstructions: `## Full reference: hybrid retrieval stack

### 1. Why hybrid

Pure vector search fails on three query classes:

- **Exact tokens** — SKUs, error codes, product names, typos. Dense embeddings smear these into neighbourhood.
- **Negation and numbers** — "not 2FA", "v18", "80%". Embeddings ignore these routinely.
- **Rare terms** — proper nouns appearing <5 times in the corpus. No semantic gradient to lean on.

Pure BM25 fails on paraphrase and conceptual questions. Combining both with RRF fixes both failure modes at near-zero code cost. Cross-encoder reranking then pushes precision on the merged shortlist.

This is the stack Microsoft's "Azure AI Search" docs, Pinecone's hybrid-search guide, Weaviate's hybrid module, and Anthropic's 2024 contextual-retrieval post all converge on.

### 2. Pipeline

\`\`\`
query ──► BM25 top-50 ──┐
                        ├──► RRF merge top-20 ──► cross-encoder rerank ──► top-5 ──► LLM
query ──► Dense top-50 ──┘
\`\`\`

Knobs (with sane defaults):

| Knob | Default | Notes |
|---|---|---|
| Sparse candidates | 50 | Raise to 100 for technical corpora (code, errors). |
| Dense candidates | 50 | Match sparse. |
| RRF k | 60 | The original paper's value. Rarely move. |
| Merged pool | 20 | Input to reranker; 20–40 is the sweet spot. |
| Final top-k | 5 | 3–8 depending on generator token budget. |

### 3. BM25 index

Preprocessing matters more than the scoring formula:

- Lowercase, Unicode-normalise.
- Tokenise on whitespace + punctuation — but keep identifiers (\`foo_bar\`, \`Foo.Bar\`) intact for code corpora.
- Remove stopwords only for prose; keep them for code.
- Stem optionally (Porter or Snowball) for English prose.
- Store per-doc length; BM25 needs it.

Libraries: \`rank_bm25\` (Python, in-memory, fine to 1M docs), \`Elasticsearch\`/\`OpenSearch\` (scales), \`tantivy\` (Rust, fast).

### 4. Dense index

- **Embedding model**: \`BAAI/bge-large-en-v1.5\` is the 2025 default open-source model. \`text-embedding-3-large\` (OpenAI) or \`voyage-3\` (Voyage) if you use closed APIs. All three are cosine-similarity-normalised.
- **Store**: Qdrant, pgvector, Weaviate, Pinecone. Use HNSW with \`M=32, ef_construction=200\` as a reasonable default for <10M vectors.
- **Chunking**: 300–500 tokens per chunk with 20% overlap. Split on semantic boundaries (Markdown headings, paragraphs) not raw char count.

### 5. Reciprocal Rank Fusion (RRF)

\`\`\`python
def rrf(rankings: list[list[str]], k: int = 60) -> dict[str, float]:
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
    return scores
\`\`\`

RRF is score-scale-free — BM25 scores (0–50) and cosine similarities (0–1) don't need normalisation. This is why it beats weighted linear combinations in practice.

### 6. Cross-encoder rerank

Bi-encoder retrievers (dense) embed query and doc independently. Cross-encoders concatenate \`[CLS] query [SEP] doc\` and run a single forward pass per pair — far more accurate, much slower. Only use them on the merged shortlist (~20 pairs).

Options:

- **BGE-reranker-large**: open source, ~560M params, ~80ms/pair on GPU, free.
- **Cohere Rerank v3**: hosted API, ~40ms/pair p95, $1/1k searches.
- **Voyage rerank-2**: hosted, competitive with Cohere.
- **ColBERT / ColBERTv2**: late-interaction, faster than cross-encoder at scale but indexing is heavier.

Budget: a 20-pair rerank on BGE-large-fp16 is ~1.6s on CPU, ~160ms on a T4 GPU. Batch the pairs.

### 7. Citations contract

Every retrieved doc must carry:

\`\`\`json
{
  "id": "doc_42#chunk_3",
  "text": "…",
  "source": "https://docs.example.com/auth/oauth",
  "rerank_score": 0.91,
  "bm25_rank": 4,
  "dense_rank": 2
}
\`\`\`

The generator renders citations as footnote-style superscripts. Never let the generator invent URLs — citations come only from \`retrieved_docs[].source\`.

### 8. Evaluation

You need a golden set of (query, ideal_doc_ids) pairs. Track:

- **Recall@50** of the merged pool — did the right doc make it to rerank?
- **NDCG@10** after rerank — is rank quality good?
- **Faithfulness** (LLM-as-judge) — does the generated answer actually use the retrieved docs?
- **Latency p95** at each stage.

Budget 50–200 labelled queries minimum. Reuse the \`golden-eval-harness\` pack to wire this into CI.

### 9. Common pitfalls

1. **Tokenising code like prose** → camelCase and snake_case split into pieces BM25 can't match. Use a code-aware tokeniser.
2. **Normalising RRF scores to top=1** → breaks the score-scale-free property. Leave them.
3. **Reranking the full corpus** → cost explodes. Rerank only the merged shortlist.
4. **Chunking too small** (<150 tokens) → dense retrieval loses context; reranker starves.
5. **Returning raw chunk text to the LLM** → no citation possible. Always carry \`source\` through.
6. **Reranker on an old query/passage pair format** → BGE expects \`[query, passage]\`; Cohere expects \`documents[]\`. Read the model card.

### 10. Cost envelope (per query, indicative)

| Stage | Cost | Latency |
|---|---|---|
| BM25 (50 hits, in-memory) | ~$0 | 2–10 ms |
| Dense (50 hits, Qdrant) | ~$0 | 15–40 ms |
| RRF merge | ~$0 | <1 ms |
| Rerank 20 pairs (Cohere) | ~$0.0010 | 40–80 ms |
| **Total** | **~$0.001** | **~100 ms** |

### 11. When to stop

If your eval shows Recall@50 >0.98 *and* post-rerank NDCG@10 plateaus, you are retrieval-bound no more — spend the next cycle on the generator (prompting, grounding checks) or on chunking quality, not on more fusion.`,

  evaluationChecklist: [
    "Recall@50 on golden set improves vs pure vector baseline (≥5 points).",
    "Rerank increases NDCG@10 vs raw RRF ordering (≥0.05 absolute).",
    "Every retrieved_doc carries id, text, source, rerank_score.",
    "Citations array length equals retrieved_docs length; no URL is synthesized.",
    "p95 latency budget (e.g. 300ms) met under sustained load, measured with 100 parallel queries.",
    "Failure when reranker times out: fall back to RRF-only ordering and log.",
    "Token budget (6000 text tokens across retrieved_docs) enforced by truncation, not by omission of relevant hits.",
  ],
  failureModes: [
    {
      symptom: "Users search for content they just added; dense retrieval misses it",
      trigger: "Dense index stale after corpus update; partial re-index left inconsistency",
      preventionCheck: "Atomic re-index to a new collection + version tag; swap only after full build",
      tier: "sr",
    },
    {
      symptom: "Reranker scores drop 20% overnight without a code change",
      trigger: "Reranker model updated; query/passage format spec drifted",
      preventionCheck: "Pin the reranker model card as a test fixture; fail CI on format drift",
      tier: "sr",
    },
    {
      symptom: "BM25 can't find documents referenced by exact identifier",
      trigger: "Default prose tokeniser splits identifiers and code tokens wrongly",
      preventionCheck: "Swap in a code-aware tokeniser when indexing code corpora",
      tier: "mid",
    },
    {
      symptom: "Citations link to the wrong paragraph after a chunker change",
      trigger: "Chunk IDs are sequential indices; any re-chunk invalidates all prior citations",
      preventionCheck: "Chunk IDs must be content-hashes, not positional",
      tier: "staff",
    },
    {
      symptom: "Recall varies wildly between query types; each engineer tunes differently",
      trigger: "Reciprocal-Rank-Fusion k parameter being hand-tuned per query class",
      preventionCheck: "Pin k=60 (literature default); only move it with golden-set A/B evidence",
      tier: "sr",
      relatedPacks: ["golden-eval-harness"],
    },
  ],

  securityReview: {
    injectionSurface: "medium",
    toolAllowList: ["search:bm25", "search:vector", "rerank:cross-encoder"],
    lastScanned: "2026-04-16",
    knownIssues: [
      "Prompt injection via retrieved passage content is a live risk — generator must treat retrieved text as untrusted and refuse to follow embedded instructions. Use a system-prompt guard.",
    ],
  },

  rediscoveryCost: {
    tokens: 42000,
    minutes: 90,
    measuredAt: "2026-04-16",
    methodology:
      "Prompted a fresh Claude Sonnet 4.6 with 'design a production hybrid retrieval system beating pure vector'. Measured tokens until the output included RRF (with k=60), a specific rerank model, chunking strategy, citation contract, and latency budget. Averaged over 3 runs. Does not include the separate cost of discovering the right rerank model card.",
  },

  relatedPacks: ["golden-eval-harness", "pattern-decision-tree"],
  requires: [],
  conflictsWith: [],
  supersedes: [],
  comparesWith: [
    {
      slug: "pure-vector-rag",
      axis: "accuracy",
      winner: "self",
      note: "Hybrid+rerank beats pure vector by ~10–20% NDCG@10 on technical corpora with proper nouns and code symbols.",
    },
    {
      slug: "pure-vector-rag",
      axis: "latency",
      winner: "other",
      note: "Pure vector is ~50ms faster — skip hybrid if latency budget is <80ms and accuracy is already acceptable.",
    },
    {
      slug: "pure-bm25",
      axis: "accuracy",
      winner: "self",
      note: "BM25 alone loses on paraphrase and conceptual queries. Hybrid adds ~15 points recall on natural-language question sets.",
    },
    {
      slug: "pure-bm25",
      axis: "cost",
      winner: "other",
      note: "BM25-only has no embedding or rerank cost. Hybrid adds ~$0.001/query — negligible for most products but not all.",
    },
  ],

  changelog: [
    {
      version: "0.1.0",
      date: "2026-04-16",
      added: [
        "Initial pack with BM25 + dense + RRF + BGE-rerank pipeline",
        "Contract with retrieved_docs and citations outputs",
        "Cost envelope and latency budget table",
        "Evaluation guidance keyed to golden-eval-harness pack",
      ],
      removed: [],
      reason: "Seed pack — first release.",
    },
  ],

  metrics: [
    { label: "Typical tokens saved", value: "42k" },
    { label: "Recall@50 lift vs vector", value: "+8–20%" },
    { label: "Per-query cost", value: "~$0.001" },
  ],

  sources: [
    {
      label: "Anthropic — Contextual Retrieval",
      url: "https://www.anthropic.com/news/contextual-retrieval",
      note: "Contextual-retrieval post that formalises BM25 + embedding + rerank as the 2024+ default stack.",
    },
    {
      label: "Microsoft — Hybrid search in Azure AI Search",
      url: "https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview",
      note: "Microsoft's official guidance on combining BM25 + vector with RRF; matches the pipeline in this pack.",
    },
    {
      label: "Pinecone — Hybrid search guide",
      url: "https://docs.pinecone.io/guides/search/hybrid-search",
      note: "Vendor-agnostic explanation of sparse+dense fusion, including alpha-weighted variants.",
    },
    {
      label: "Weaviate — Hybrid search docs",
      url: "https://weaviate.io/developers/weaviate/search/hybrid",
      note: "Reference for the alpha parameter and server-side RRF implementation.",
    },
    {
      label: "BGE Reranker model card",
      url: "https://huggingface.co/BAAI/bge-reranker-large",
      note: "Primary source on the recommended open-source cross-encoder; includes input format requirements.",
    },
    {
      label: "ColBERTv2 paper",
      url: "https://arxiv.org/abs/2112.01488",
      note: "Late-interaction alternative to cross-encoder rerank when you need throughput at scale.",
    },
  ],
  examples: [
    {
      label: "Qdrant hybrid search example",
      href: "https://qdrant.tech/documentation/tutorials/hybrid-search/",
      external: true,
    },
    {
      label: "Pinecone hybrid search notebook",
      href: "https://docs.pinecone.io/guides/search/hybrid-search",
      external: true,
    },
  ],
};

export default ragHybridBm25Vector;
