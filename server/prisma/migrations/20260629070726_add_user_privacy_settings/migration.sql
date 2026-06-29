-- AlterTable
ALTER TABLE "User" ADD COLUMN     "showLastSeen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showOnlineStatus" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showReadReceipts" BOOLEAN NOT NULL DEFAULT true;
