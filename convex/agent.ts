import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

const DEFAULT_MODEL = process.env.AGENT_MODEL ?? "gemini-2.5-flash";

type Workspace = {
  workspaceId: string;
  label: string;
  description: string;
  primaryPersona: string;
  samplePrompts: string[];
};

function chunkText(text: string, size = 220) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

function buildPlan(query: string, fileCount: number) {
  const plan = [
    {
      id: "s1",
      stepIndex: 0,
      toolName: "get_workspace_context",
      purpose: "Load workspace framing, operator scope, and starter prompts.",
    },
  ];

  if (fileCount > 0) {
    plan.push({
      id: "s2",
      stepIndex: 1,
      toolName: "review_uploaded_files",
      purpose: "Consider the uploaded evidence before answering.",
    });
  }

  plan.push({
    id: fileCount > 0 ? "s3" : "s2",
    stepIndex: fileCount > 0 ? 2 : 1,
    toolName: "synthesize_answer",
    purpose: "Generate a concise operator-ready answer with trace metadata.",
  });

  return {
    summary: `Plan the response for: "${query.slice(0, 80)}${query.length > 80 ? "..." : ""}"`,
    model: DEFAULT_MODEL,
    plan,
  };
}

async function callGemini({
  query,
  workspace,
  fileSummaries,
}: {
  query: string;
  workspace?: Workspace | null;
  fileSummaries: string[];
}) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return null;
  }

  const systemPrompt = [
    "You are a generic agent workspace assistant.",
    "Use only the provided workspace context and file summaries.",
    "Be concise, operational, and explicit about what is known versus missing.",
  ].join(" ");

  const userPrompt = [
    workspace
      ? `Workspace: ${workspace.label}. Persona: ${workspace.primaryPersona}. Description: ${workspace.description}`
      : "Workspace: shared channel.",
    fileSummaries.length
      ? `Uploaded evidence summaries:\n- ${fileSummaries.join("\n- ")}`
      : "No uploaded files were provided.",
    `User query: ${query}`,
  ].join("\n\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part: any) => part?.text)
    .filter(Boolean)
    .join("");

  return text || null;
}

function buildFallbackAnswer({
  query,
  workspace,
  fileSummaries,
}: {
  query: string;
  workspace?: Workspace | null;
  fileSummaries: string[];
}) {
  const workspaceLine = workspace
    ? `You are in ${workspace.label}, which currently represents the "${workspace.primaryPersona}" role.`
    : "You are in the shared channel.";

  const evidenceLine = fileSummaries.length
    ? `Uploaded evidence in this run: ${fileSummaries.join("; ")}.`
    : "No uploaded evidence was attached.";

  return [
    `${workspaceLine} This template fallback is working because no model response was available.`,
    evidenceLine,
    `Query received: "${query}".`,
    "Next steps:",
    "1. Replace the generic workspace schema with domain entities.",
    "2. Rewrite the brief and tool contract in convex/agent.ts.",
    "3. Add domain goldens before treating responses as production quality.",
  ].join("\n\n");
}

function buildQuality({
  usedModel,
  hasWorkspace,
  hasFiles,
}: {
  usedModel: boolean;
  hasWorkspace: boolean;
  hasFiles: boolean;
}) {
  const checks = [
    {
      key: "workspace_scope",
      label: "Workspace scope",
      passed: hasWorkspace,
      severity: "warning" as const,
      message: hasWorkspace
        ? "The answer was bound to a specific workspace."
        : "This answer came from the shared channel without a workspace scope.",
    },
    {
      key: "trace_recorded",
      label: "Trace recorded",
      passed: true,
      severity: "warning" as const,
      message: "The run persisted plan and execution metadata.",
    },
    {
      key: "model_or_fallback",
      label: "Model path",
      passed: usedModel,
      severity: "warning" as const,
      message: usedModel
        ? "Gemini produced the answer text."
        : "Fallback synthesis was used because GOOGLE_API_KEY was not available or the model call failed.",
    },
    {
      key: "file_awareness",
      label: "Evidence awareness",
      passed: hasFiles,
      severity: "warning" as const,
      message: hasFiles
        ? "The run included uploaded files in the context packet."
        : "No files were attached to this run.",
    },
  ];

  const failures = checks.filter((check) => !check.passed && check.severity === "warning").length;
  return {
    status: failures > 1 ? "warning" : "pass",
    summary: usedModel
      ? "The template completed with a model-backed answer and persisted quality metadata."
      : "The template completed with the deterministic fallback path and persisted quality metadata.",
    checks,
  };
}

export const chat = action({
  args: {
    operatorId: v.string(),
    query: v.string(),
    workspaceId: v.optional(v.string()),
    sessionId: v.string(),
    senderName: v.optional(v.string()),
    fileIds: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ answerPacketId: string; answer: string; qualityStatus: string }> => {
    const startedAt = Date.now();
    const references = args.workspaceId ? [args.workspaceId] : [];
    const workspace: Workspace | null = args.workspaceId
      ? await ctx.runQuery(api.workspaces.getByIdForOperator, {
          operatorId: args.operatorId,
          workspaceId: args.workspaceId,
        })
      : null;

    await ctx.runMutation(api.messages.send, {
      role: "user",
      content: args.query,
      senderName: args.senderName,
      status: "completed",
      workspaceId: args.workspaceId,
      sessionId: args.sessionId,
      createdAt: startedAt,
      updatedAt: startedAt,
      fileIds: args.fileIds,
    });

    const draftId = await ctx.runMutation(api.messages.createDraftAssistant, {
      sessionId: args.sessionId,
      workspaceId: args.workspaceId,
      createdAt: Date.now(),
    });

    let sequence = 0;
    const emit = async (eventType: string, summary: string, payload?: unknown) => {
      sequence += 1;
      await ctx.runMutation(api.messages.appendEvent, {
        messageId: draftId,
        sessionId: args.sessionId,
        workspaceId: args.workspaceId,
        eventType,
        sequence,
        summary,
        payloadJson: payload ? JSON.stringify(payload) : undefined,
        createdAt: Date.now(),
      });
    };

    await emit("run.started", "Run started.");

    const uploadedFiles: Array<{
      fileId: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      url?: string | null;
    }> = args.fileIds?.length
      ? await ctx.runQuery(api.files.getByIds, {
          operatorId: args.operatorId,
          fileIds: args.fileIds,
          workspaceId: args.workspaceId,
        })
      : [];

    const fileSummaries: string[] = uploadedFiles.map(
      (file) => `${file.filename} (${file.mimeType})`
    );
    const planner = buildPlan(args.query, uploadedFiles.length);
    await emit("plan.created", "Plan created.", planner);

    const executionSteps: Array<{
      id: string;
      stepIndex: number;
      tool: string;
      summary: string;
      durationMs?: number;
      success?: boolean;
    }> = [];

    const contextStepStart = Date.now();
    const contextSummary = workspace
      ? `Loaded ${workspace.label} for ${workspace.primaryPersona}.`
      : "No workspace scope; using shared channel mode.";
    executionSteps.push({
      id: "s1",
      stepIndex: 0,
      tool: "get_workspace_context",
      summary: contextSummary,
      durationMs: Date.now() - contextStepStart,
      success: true,
    });
    await emit("step.done", contextSummary, executionSteps[0]);

    if (uploadedFiles.length) {
      const fileStepStart = Date.now();
      const fileSummary = `Reviewed ${uploadedFiles.length} uploaded file${uploadedFiles.length === 1 ? "" : "s"}.`;
      executionSteps.push({
        id: "s2",
        stepIndex: 1,
        tool: "review_uploaded_files",
        summary: fileSummary,
        durationMs: Date.now() - fileStepStart,
        success: true,
      });
      await emit("step.done", fileSummary, executionSteps[executionSteps.length - 1]);
    }

    const synthesisStart = Date.now();
    const modelText = await callGemini({
      query: args.query,
      workspace,
      fileSummaries,
    });
    const answer: string =
      modelText ??
      buildFallbackAnswer({
        query: args.query,
        workspace,
        fileSummaries,
      });
    const usedModel = !!modelText;

    executionSteps.push({
      id: uploadedFiles.length ? "s3" : "s2",
      stepIndex: uploadedFiles.length ? 2 : 1,
      tool: "synthesize_answer",
      summary: usedModel
        ? `Generated a model-backed answer with ${DEFAULT_MODEL}.`
        : "Generated the fallback template answer.",
      durationMs: Date.now() - synthesisStart,
      success: true,
    });
    await emit("step.done", executionSteps[executionSteps.length - 1].summary, executionSteps[executionSteps.length - 1]);

    for (const chunk of chunkText(answer)) {
      await ctx.runMutation(api.messages.updateAssistantDraft, {
        messageId: draftId,
        appendText: chunk,
        updatedAt: Date.now(),
      });
      await emit("text.delta", "Streaming answer text.");
    }

    const quality = buildQuality({
      usedModel,
      hasWorkspace: !!workspace,
      hasFiles: uploadedFiles.length > 0,
    });
    const answerPacketId = `PKT-${Date.now()}`;
    const trace = {
      planner,
      execution: {
        steps: executionSteps,
        totalDurationMs: Date.now() - startedAt,
        fallbackUsed: !usedModel,
      },
      sources: [] as Array<{
        url: string;
        domain: string;
        title?: string;
        snippet?: string;
      }>,
    };

    const metadataJson = JSON.stringify({
      answerPacketId,
      quality,
      trace,
    });

    await ctx.runMutation(api.messages.updateAssistantDraft, {
      messageId: draftId,
      status: "completed",
      updatedAt: Date.now(),
      references,
      sourceUrls: [],
      fileIds: args.fileIds,
      metadataJson,
    });

    await ctx.runMutation(internal.answerPackets.create, {
      answerPacketId,
      messageId: draftId,
      sessionId: args.sessionId,
      operatorId: args.operatorId,
      workspaceId: args.workspaceId,
      query: args.query,
      answer,
      references,
      sourceUrls: [],
      qualityStatus: quality.status,
      qualitySummary: quality.summary,
      qualityChecksJson: JSON.stringify(quality.checks),
      briefJson: JSON.stringify({
        workspace,
        fileSummaries,
      }),
      traceJson: JSON.stringify(trace),
      model: usedModel ? DEFAULT_MODEL : "fallback",
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.record, {
      actorId: args.operatorId,
      eventType: "agent.chat.completed",
      status: "success",
      workspaceId: args.workspaceId,
      entityId: answerPacketId,
      summary: `Completed assistant response${workspace ? ` for ${workspace.label}` : ""}.`,
      detailsJson: JSON.stringify({
        model: usedModel ? DEFAULT_MODEL : "fallback",
        sessionId: args.sessionId,
      }),
    });

    await emit("run.completed", "Run completed.", {
      answerPacketId,
      qualityStatus: quality.status,
    });

    return {
      answerPacketId,
      answer,
      qualityStatus: quality.status,
    };
  },
});
