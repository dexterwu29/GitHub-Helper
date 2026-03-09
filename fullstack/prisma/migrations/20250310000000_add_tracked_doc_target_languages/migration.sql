-- AlterTable
ALTER TABLE "tracked_documents" ADD COLUMN "target_languages" JSONB NOT NULL DEFAULT '[]';
