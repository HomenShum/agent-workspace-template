type UploadContext = {
  operatorId: string;
  sessionId?: string;
  workspaceId?: string;
  uploadedBy: string;
};

type CreateFileRecord = (args: {
  operatorId: string;
  sessionId?: string;
  workspaceId?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageId: any;
  uploadedBy: string;
}) => Promise<{
  fileId: string;
  filename: string;
  mimeType: string;
  fileCategory: string;
  sizeBytes: number;
}>;

export async function uploadFilesToConvex({
  files,
  generateUploadUrl,
  createFileRecord,
  context,
}: {
  files: File[];
  generateUploadUrl: (args: { operatorId: string }) => Promise<string>;
  createFileRecord: CreateFileRecord;
  context: UploadContext;
}) {
  const uploaded = [];

  for (const file of files) {
    const uploadUrl = await generateUploadUrl({
      operatorId: context.operatorId,
    });
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Upload failed for ${file.name}.`);
    }

    const payload = (await response.json()) as { storageId?: any };
    if (!payload.storageId) {
      throw new Error(`Upload did not return a storageId for ${file.name}.`);
    }

    uploaded.push(
      await createFileRecord({
        ...context,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        storageId: payload.storageId,
      })
    );
  }

  return uploaded;
}
