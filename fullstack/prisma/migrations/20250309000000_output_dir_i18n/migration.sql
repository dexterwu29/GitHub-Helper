-- AlterTable: change default and migrate existing translate -> _i18n
ALTER TABLE "translation_configs" ALTER COLUMN "output_dir" SET DEFAULT '_i18n';
UPDATE "translation_configs" SET "output_dir" = '_i18n' WHERE "output_dir" = 'translate';
