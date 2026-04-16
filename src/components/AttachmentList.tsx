type Attachment = {
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url?: string | null;
};

function formatSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

export function AttachmentList({
  attachments,
  compact = false,
}: {
  attachments: Attachment[];
  compact?: boolean;
}) {
  if (!attachments.length) {
    return null;
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {attachments.map((attachment) => (
        <a
          key={attachment.fileId}
          href={attachment.url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-3 rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/40"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{attachment.filename}</p>
            <p className="truncate text-xs text-slate-500">
              {(attachment.mimeType || "application/octet-stream").replace("/", " / ")} /{" "}
              {formatSize(attachment.sizeBytes)}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
            {attachment.fileId}
          </span>
        </a>
      ))}
    </div>
  );
}
