CREATE TABLE "PendingUpload" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PendingUpload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingUpload_path_key" ON "PendingUpload"("path");
CREATE INDEX "PendingUpload_userId_consumedAt_expiresAt_idx"
  ON "PendingUpload"("userId", "consumedAt", "expiresAt");
CREATE INDEX "PendingUpload_expiresAt_consumedAt_idx"
  ON "PendingUpload"("expiresAt", "consumedAt");

ALTER TABLE "PendingUpload"
  ADD CONSTRAINT "PendingUpload_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
