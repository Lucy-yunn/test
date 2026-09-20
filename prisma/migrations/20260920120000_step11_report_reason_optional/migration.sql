-- A report's reason is optional (docs/messaging-model.md section 8).
ALTER TABLE "Report" ALTER COLUMN "reason" DROP NOT NULL;
