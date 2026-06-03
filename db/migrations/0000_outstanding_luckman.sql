CREATE SCHEMA "fawredd_home_expenses";
--> statement-breakpoint
CREATE TABLE "fawredd_home_expenses"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"parent_id" uuid,
	"color" varchar(7),
	"icon" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "fawredd_home_expenses"."documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(50) NOT NULL,
	"file_path" text NOT NULL,
	"upload_status" varchar(50) DEFAULT 'uploaded' NOT NULL,
	"processing_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"error_message" text,
	"user_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fawredd_home_expenses"."extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"raw_ocr_text" text,
	"extracted_date" date,
	"extracted_amount" numeric(15, 2),
	"extracted_currency" varchar(3),
	"extracted_vendor" varchar(255),
	"extracted_document_type" varchar(50),
	"extracted_description" text,
	"confidence_scores" jsonb DEFAULT '{}' NOT NULL,
	"overall_confidence" numeric(3, 2) NOT NULL,
	"extraction_errors" jsonb,
	"extraction_method" varchar(50) DEFAULT 'ocr' NOT NULL,
	"extracted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fawredd_home_expenses"."movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"extraction_id" uuid NOT NULL,
	"category_id" uuid,
	"transaction_date" date NOT NULL,
	"vendor_name" varchar(255),
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'ARS' NOT NULL,
	"movement_type" varchar(50) NOT NULL,
	"description" text,
	"confidence_score" numeric(3, 2),
	"categorization_method" varchar(50),
	"is_reviewed" boolean DEFAULT false NOT NULL,
	"is_manual_correction" boolean DEFAULT false NOT NULL,
	"corrected_at" timestamp,
	"corrected_category_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fawredd_home_expenses"."processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid,
	"movement_id" uuid,
	"job_type" varchar(50) NOT NULL,
	"job_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0,
	"retry_count" integer DEFAULT 0,
	"error_details" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fawredd_home_expenses"."rag_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_id" uuid NOT NULL,
	"vendor_name" varchar(255) NOT NULL,
	"category_id" uuid NOT NULL,
	"embedding" vector(384) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fawredd_home_expenses"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "fawredd_home_expenses"."user_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_id" uuid NOT NULL,
	"old_category_id" uuid,
	"new_category_id" uuid NOT NULL,
	"reason" text,
	"corrected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "fawredd_home_expenses"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."extractions" ADD CONSTRAINT "extractions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "fawredd_home_expenses"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."movements" ADD CONSTRAINT "movements_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "fawredd_home_expenses"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."movements" ADD CONSTRAINT "movements_extraction_id_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "fawredd_home_expenses"."extractions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."movements" ADD CONSTRAINT "movements_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "fawredd_home_expenses"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."movements" ADD CONSTRAINT "movements_corrected_category_id_categories_id_fk" FOREIGN KEY ("corrected_category_id") REFERENCES "fawredd_home_expenses"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."processing_jobs" ADD CONSTRAINT "processing_jobs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "fawredd_home_expenses"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."processing_jobs" ADD CONSTRAINT "processing_jobs_movement_id_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "fawredd_home_expenses"."movements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."rag_embeddings" ADD CONSTRAINT "rag_embeddings_movement_id_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "fawredd_home_expenses"."movements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."rag_embeddings" ADD CONSTRAINT "rag_embeddings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "fawredd_home_expenses"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."user_corrections" ADD CONSTRAINT "user_corrections_movement_id_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "fawredd_home_expenses"."movements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."user_corrections" ADD CONSTRAINT "user_corrections_old_category_id_categories_id_fk" FOREIGN KEY ("old_category_id") REFERENCES "fawredd_home_expenses"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fawredd_home_expenses"."user_corrections" ADD CONSTRAINT "user_corrections_new_category_id_categories_id_fk" FOREIGN KEY ("new_category_id") REFERENCES "fawredd_home_expenses"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_categories_parent_id" ON "fawredd_home_expenses"."categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_categories_is_active" ON "fawredd_home_expenses"."categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_documents_uploaded_at" ON "fawredd_home_expenses"."documents" USING btree ("uploaded_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_documents_upload_status" ON "fawredd_home_expenses"."documents" USING btree ("upload_status");--> statement-breakpoint
CREATE INDEX "idx_documents_user_id" ON "fawredd_home_expenses"."documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_extractions_document_id" ON "fawredd_home_expenses"."extractions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_extractions_overall_confidence" ON "fawredd_home_expenses"."extractions" USING btree ("overall_confidence" DESC);--> statement-breakpoint
CREATE INDEX "idx_movements_transaction_date" ON "fawredd_home_expenses"."movements" USING btree ("transaction_date" DESC);--> statement-breakpoint
CREATE INDEX "idx_movements_category_id" ON "fawredd_home_expenses"."movements" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_movements_vendor_name" ON "fawredd_home_expenses"."movements" USING btree ("vendor_name");--> statement-breakpoint
CREATE INDEX "idx_movements_movement_type" ON "fawredd_home_expenses"."movements" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "idx_movements_is_reviewed" ON "fawredd_home_expenses"."movements" USING btree ("is_reviewed");--> statement-breakpoint
CREATE INDEX "idx_movements_date_category" ON "fawredd_home_expenses"."movements" USING btree (DATE_TRUNC('month', "transaction_date"), "category_id");--> statement-breakpoint
CREATE INDEX "idx_processing_jobs_status" ON "fawredd_home_expenses"."processing_jobs" USING btree ("job_status");--> statement-breakpoint
CREATE INDEX "idx_processing_jobs_document_id" ON "fawredd_home_expenses"."processing_jobs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_processing_jobs_created_at" ON "fawredd_home_expenses"."processing_jobs" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_rag_embeddings_vendor" ON "fawredd_home_expenses"."rag_embeddings" USING btree ("vendor_name");--> statement-breakpoint
CREATE INDEX "idx_user_corrections_movement_id" ON "fawredd_home_expenses"."user_corrections" USING btree ("movement_id");--> statement-breakpoint
CREATE INDEX "idx_user_corrections_corrected_at" ON "fawredd_home_expenses"."user_corrections" USING btree ("corrected_at");