import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    operatorId: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.string(),
    workspaceIds: v.array(v.string()),
  })
    .index("by_operatorId", ["operatorId"])
    .index("by_role", ["role"]),

  workspaces: defineTable({
    workspaceId: v.string(),
    slug: v.string(),
    label: v.string(),
    eyebrow: v.string(),
    headline: v.string(),
    description: v.string(),
    primaryPersona: v.string(),
    samplePrompts: v.array(v.string()),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_slug", ["slug"]),

  packArtwork: defineTable({
    packSlug: v.string(),
    prompt: v.string(),
    model: v.string(),
    status: v.string(),
    generatedBy: v.string(),
    mimeType: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
    generatedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_packSlug", ["packSlug"])
    .index("by_generatedAt", ["generatedAt"]),

  packSubmissions: defineTable({
    submissionId: v.string(),
    operatorId: v.string(),
    submitterName: v.string(),
    submitterEmail: v.string(),
    packName: v.string(),
    slug: v.string(),
    tagline: v.string(),
    summary: v.string(),
    category: v.string(),
    compatibility: v.array(v.string()),
    repoUrl: v.optional(v.string()),
    docsUrl: v.optional(v.string()),
    whyItMatters: v.string(),
    sourceNotes: v.string(),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_submissionId", ["submissionId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_operatorId", ["operatorId"]),

  messages: defineTable({
    role: v.string(),
    content: v.string(),
    senderName: v.optional(v.string()),
    status: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    sessionId: v.string(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    references: v.optional(v.array(v.string())),
    sourceUrls: v.optional(v.array(v.string())),
    fileIds: v.optional(v.array(v.string())),
    metadataJson: v.optional(v.string()),
  }).index("by_session", ["sessionId"]),

  messageEvents: defineTable({
    messageId: v.id("messages"),
    sessionId: v.string(),
    workspaceId: v.optional(v.string()),
    eventType: v.string(),
    sequence: v.number(),
    summary: v.string(),
    payloadJson: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_session", ["sessionId"])
    .index("by_session_and_sequence", ["sessionId", "sequence"]),

  files: defineTable({
    fileId: v.string(),
    sessionId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    filename: v.string(),
    mimeType: v.string(),
    fileCategory: v.string(),
    sizeBytes: v.number(),
    storageId: v.optional(v.id("_storage")),
    uploadedBy: v.string(),
    uploadedAt: v.string(),
    analysisStatus: v.optional(v.string()),
    summary: v.optional(v.string()),
  })
    .index("by_fileId", ["fileId"])
    .index("by_session", ["sessionId"])
    .index("by_workspaceId", ["workspaceId"]),

  answerPackets: defineTable({
    answerPacketId: v.string(),
    messageId: v.optional(v.id("messages")),
    sessionId: v.string(),
    operatorId: v.string(),
    workspaceId: v.optional(v.string()),
    query: v.string(),
    answer: v.string(),
    references: v.array(v.string()),
    sourceUrls: v.array(v.string()),
    qualityStatus: v.string(),
    qualitySummary: v.optional(v.string()),
    qualityChecksJson: v.string(),
    briefJson: v.optional(v.string()),
    traceJson: v.optional(v.string()),
    model: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_answerPacketId", ["answerPacketId"])
    .index("by_message", ["messageId"])
    .index("by_session", ["sessionId"])
    .index("by_session_and_createdAt", ["sessionId", "createdAt"])
    .index("by_workspaceId", ["workspaceId"]),

  evalRuns: defineTable({
    evalRunId: v.string(),
    dataset: v.string(),
    model: v.string(),
    limit: v.number(),
    status: v.string(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    summaryJson: v.optional(v.string()),
  })
    .index("by_evalRunId", ["evalRunId"])
    .index("by_status", ["status"])
    .index("by_startedAt", ["startedAt"]),

  evalCases: defineTable({
    evalRunId: v.string(),
    caseId: v.string(),
    scenario: v.string(),
    query: v.string(),
    responsePreview: v.string(),
    refScore: v.number(),
    foundRefs: v.array(v.string()),
    missingRefs: v.array(v.string()),
    criteriaResultsJson: v.string(),
    judgeScoresJson: v.string(),
    sessionId: v.optional(v.string()),
    messageId: v.optional(v.id("messages")),
    answerPacketId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_evalRunId", ["evalRunId"])
    .index("by_evalRunId_and_caseId", ["evalRunId", "caseId"]),

  eventLogs: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    status: v.string(),
    actorId: v.string(),
    actorName: v.string(),
    actorRole: v.string(),
    workspaceId: v.optional(v.string()),
    entityId: v.optional(v.string()),
    summary: v.string(),
    detailsJson: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_actorId", ["actorId"]),
});
