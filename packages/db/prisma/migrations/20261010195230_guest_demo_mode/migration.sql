-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);
