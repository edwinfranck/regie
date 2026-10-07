-- AlterTable
ALTER TABLE "Timeline" ADD COLUMN     "aspectRatio" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resolution" TEXT;

-- AlterTable
ALTER TABLE "TimelineClip" ADD COLUMN     "name" TEXT,
ADD COLUMN     "opacity" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "shotId" TEXT;

-- AlterTable
ALTER TABLE "TimelineTrack" ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "volume" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Render" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'mp4',
    "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "spec" JSONB NOT NULL,
    "assetId" TEXT,
    "error" TEXT,
    "durationSec" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Render_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Render_timelineId_createdAt_idx" ON "Render"("timelineId", "createdAt");

-- AddForeignKey
ALTER TABLE "Render" ADD CONSTRAINT "Render_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Render" ADD CONSTRAINT "Render_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
