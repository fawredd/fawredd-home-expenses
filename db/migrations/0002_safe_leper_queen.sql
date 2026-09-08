ALTER TABLE "fawredd_home_expenses"."documents" ADD COLUMN "upload_fingerprint" varchar(255);--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."extractions" ADD COLUMN "source_item_key" varchar(255);--> statement-breakpoint
UPDATE "fawredd_home_expenses"."extractions" SET "source_item_key" = "document_id"::text || ':' || "id"::text WHERE "source_item_key" IS NULL;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."extractions" ALTER COLUMN "source_item_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."movements" ADD COLUMN "review_key" varchar(255);--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."user_corrections" ADD COLUMN "correction_key" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "documents_upload_fingerprint_unique" ON "fawredd_home_expenses"."documents" USING btree ("upload_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "extractions_source_item_key_unique" ON "fawredd_home_expenses"."extractions" USING btree ("source_item_key");--> statement-breakpoint
CREATE UNIQUE INDEX "movements_extraction_id_unique" ON "fawredd_home_expenses"."movements" USING btree ("extraction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "movements_review_key_unique" ON "fawredd_home_expenses"."movements" USING btree ("review_key");--> statement-breakpoint
CREATE UNIQUE INDEX "rag_embeddings_movement_category_unique" ON "fawredd_home_expenses"."rag_embeddings" USING btree ("movement_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_corrections_key_unique" ON "fawredd_home_expenses"."user_corrections" USING btree ("correction_key");