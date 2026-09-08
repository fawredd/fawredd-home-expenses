CREATE TABLE "fawredd_home_expenses"."extraction_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_name" varchar(255) NOT NULL,
	"cuit" varchar(20),
	"document_type" varchar(50) NOT NULL,
	"embedding" vector(384) NOT NULL,
	"extraction_hints" jsonb DEFAULT '{}' NOT NULL,
	"sample_raw_text" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "fawredd_home_expenses"."idx_movements_date_category";--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."documents" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."sessions" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."extractions" ADD COLUMN "extracted_cuit" varchar(20);--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."processing_jobs" ADD COLUMN "payload" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."processing_jobs" ADD COLUMN "deduplication_key" varchar(255);--> statement-breakpoint
UPDATE "fawredd_home_expenses"."processing_jobs" SET "deduplication_key" = 'legacy:' || "id"::text WHERE "deduplication_key" IS NULL;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."processing_jobs" ALTER COLUMN "deduplication_key" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_extraction_memory_vendor" ON "fawredd_home_expenses"."extraction_memory" USING btree ("vendor_name");--> statement-breakpoint
CREATE INDEX "idx_extraction_memory_cuit" ON "fawredd_home_expenses"."extraction_memory" USING btree ("cuit");--> statement-breakpoint
CREATE INDEX "idx_extraction_memory_doc_type" ON "fawredd_home_expenses"."extraction_memory" USING btree ("document_type");--> statement-breakpoint
CREATE UNIQUE INDEX "processing_jobs_deduplication_key_unique" ON "fawredd_home_expenses"."processing_jobs" USING btree ("deduplication_key");