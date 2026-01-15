CREATE TABLE "web_vitals" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"metric_id" text NOT NULL,
	"value" double precision NOT NULL,
	"delta" double precision NOT NULL,
	"rating" text,
	"navigation_type" text,
	"url" text,
	"pathname" text,
	"user_agent" text,
	"client_ts" bigint,
	"app_version" text
);
--> statement-breakpoint
CREATE INDEX "idx_web_vitals_created_at" ON "web_vitals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_web_vitals_name_created_at" ON "web_vitals" USING btree ("name","created_at");