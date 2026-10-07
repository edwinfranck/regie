-- AlterTable
ALTER TABLE "Shot" ADD COLUMN     "frameAssetId" TEXT;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_frameAssetId_fkey" FOREIGN KEY ("frameAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
