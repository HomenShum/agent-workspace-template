"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useOperatorSession } from "@/components/OperatorSessionProvider";

const categoryOptions = [
  "Interface",
  "Orchestration",
  "Runtime",
  "Specification",
  "Streaming",
  "Evaluation",
];

export default function SubmitPage() {
  const users = useQuery(api.users.listAvailable, {});
  const recentSubmissions = useQuery(api.submissions.listRecent, { limit: 8 });
  const submitPack = useMutation(api.submissions.submitPack);
  const { operator, setOperator } = useOperatorSession();

  const [form, setForm] = useState({
    packName: "",
    tagline: "",
    summary: "",
    category: "Orchestration",
    compatibility: "Claude Code, Codex, Convex",
    repoUrl: "",
    docsUrl: "",
    whyItMatters: "",
    sourceNotes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);

  const selectedOperator = useMemo(() => operator, [operator]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOperator) {
      setSubmissionMessage("Choose an operator session before submitting a pack.");
      return;
    }

    setIsSubmitting(true);
    setSubmissionMessage(null);

    try {
      const compatibility = form.compatibility
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const result = await submitPack({
        operatorId: selectedOperator.operatorId,
        packName: form.packName,
        tagline: form.tagline,
        summary: form.summary,
        category: form.category,
        compatibility,
        repoUrl: form.repoUrl || undefined,
        docsUrl: form.docsUrl || undefined,
        whyItMatters: form.whyItMatters,
        sourceNotes: form.sourceNotes,
      });

      setSubmissionMessage(`Submitted ${result.submissionId} for review.`);
      setForm({
        packName: "",
        tagline: "",
        summary: "",
        category: "Orchestration",
        compatibility: "Claude Code, Codex, Convex",
        repoUrl: "",
        docsUrl: "",
        whyItMatters: "",
        sourceNotes: "",
      });
    } catch (error) {
      setSubmissionMessage(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            <section className="directory-hero">
              <div className="space-y-4">
                <p className="section-label text-[rgba(101,78,51,0.78)]">Submit a harness pack</p>
                <h1 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
                  Contribute a verified natural-language build pattern.
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                  The best submissions are narrow, source-backed, and practical. Think in terms of
                  reusable harness contracts, not giant one-off prompts.
                </p>
              </div>
            </section>

            <section className="glass-panel px-6 py-6 sm:px-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-label">Operator session</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    Select the submitting operator
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    This reuses the template's lightweight operator session model instead of adding
                    a second auth system just for submissions.
                  </p>
                </div>
                {selectedOperator ? (
                  <div className="directory-pill">
                    Active: <span className="font-semibold text-slate-950">{selectedOperator.name}</span>
                  </div>
                ) : null}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(users ?? []).map((user: any) => (
                  <button
                    key={user.operatorId}
                    type="button"
                    onClick={() =>
                      setOperator({
                        operatorId: user.operatorId,
                        role: user.role,
                        name: user.name,
                      })
                    }
                    className={`rounded-[20px] border px-4 py-4 text-left transition ${
                      selectedOperator?.operatorId === user.operatorId
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-[rgba(72,57,39,0.12)] bg-white text-slate-700"
                    }`}
                  >
                    <p className="text-sm font-semibold">{user.name}</p>
                    <p
                      className={`mt-1 text-xs ${
                        selectedOperator?.operatorId === user.operatorId
                          ? "text-slate-200"
                          : "text-slate-500"
                      }`}
                    >
                      {user.role.replaceAll("_", " ")}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="glass-panel px-6 py-6 sm:px-8">
              <p className="section-label">Submission form</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                Describe the harness pack clearly
              </h2>
              <form onSubmit={onSubmit} className="mt-5 space-y-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field
                    label="Pack name"
                    value={form.packName}
                    onChange={(value) => setForm((current) => ({ ...current, packName: value }))}
                    placeholder="Planner -> Workers -> Synthesizer"
                  />
                  <Field
                    label="Tagline"
                    value={form.tagline}
                    onChange={(value) => setForm((current) => ({ ...current, tagline: value }))}
                    placeholder="Tiered orchestration for broad questions"
                  />
                </div>

                <TextAreaField
                  label="Summary"
                  value={form.summary}
                  onChange={(value) => setForm((current) => ({ ...current, summary: value }))}
                  placeholder="What problem does this harness solve, and why is it reusable?"
                />

                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <label className="section-label" htmlFor="category">
                      Category
                    </label>
                    <select
                      id="category"
                      value={form.category}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, category: event.target.value }))
                      }
                      className="field-input mt-2"
                    >
                      {categoryOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field
                    label="Compatibility"
                    value={form.compatibility}
                    onChange={(value) => setForm((current) => ({ ...current, compatibility: value }))}
                    placeholder="Claude Code, Codex, Convex"
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Field
                    label="Repo URL"
                    value={form.repoUrl}
                    onChange={(value) => setForm((current) => ({ ...current, repoUrl: value }))}
                    placeholder="https://github.com/..."
                  />
                  <Field
                    label="Docs URL"
                    value={form.docsUrl}
                    onChange={(value) => setForm((current) => ({ ...current, docsUrl: value }))}
                    placeholder="https://docs.example.com/..."
                  />
                </div>

                <TextAreaField
                  label="Why it matters"
                  value={form.whyItMatters}
                  onChange={(value) => setForm((current) => ({ ...current, whyItMatters: value }))}
                  placeholder="Describe the key tradeoff, outcome, or gap this pack addresses."
                />

                <TextAreaField
                  label="Source notes"
                  value={form.sourceNotes}
                  onChange={(value) => setForm((current) => ({ ...current, sourceNotes: value }))}
                  placeholder="List the SDK docs, blog posts, or implementation references that support this pack."
                />

                <div className="flex flex-wrap items-center gap-3">
                  <button type="submit" disabled={isSubmitting} className="btn-primary">
                    {isSubmitting ? "Submitting..." : "Submit pack"}
                  </button>
                  {submissionMessage ? (
                    <p className="text-sm text-slate-600">{submissionMessage}</p>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Submissions enter the queue as <code>pending_review</code>.
                    </p>
                  )}
                </div>
              </form>
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <section className="glass-panel px-6 py-6">
              <p className="section-label">Review expectations</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <li className="rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-3">
                  Keep the harness narrow enough to explain clearly.
                </li>
                <li className="rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-3">
                  Prefer official SDK and framework sources over generic prompt lore.
                </li>
                <li className="rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-3">
                  Include evaluation guidance so the pack can be tested, not just copied.
                </li>
              </ul>
            </section>

            <section className="glass-panel px-6 py-6">
              <p className="section-label">Recent queue</p>
              <div className="mt-4 space-y-3">
                {(recentSubmissions ?? []).map((submission: any) => (
                  <div
                    key={submission.submissionId}
                    className="rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{submission.packName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {submission.submitterName} / {submission.category}
                        </p>
                      </div>
                      <span className="directory-pill directory-pill-small">{submission.status}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{submission.tagline}</p>
                  </div>
                ))}
                {recentSubmissions?.length === 0 ? (
                  <p className="text-sm text-slate-500">No submissions yet.</p>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const inputId = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label className="section-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field-input mt-2"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const inputId = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label className="section-label" htmlFor={inputId}>
        {label}
      </label>
      <textarea
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={5}
        className="field-input mt-2 min-h-[140px] resize-y"
      />
    </div>
  );
}
