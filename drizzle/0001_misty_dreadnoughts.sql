CREATE TABLE "usage_daily_agg" (
	"day_start" timestamp with time zone NOT NULL,
	"route" text NOT NULL,
	"model" text NOT NULL,
	"total_tokens" bigint DEFAULT 0 NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"cached_tokens" bigint DEFAULT 0 NOT NULL,
	"total_requests" bigint DEFAULT 0 NOT NULL,
	"success_count" bigint DEFAULT 0 NOT NULL,
	"failure_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_daily_agg_day_start_route_model_pk" PRIMARY KEY("day_start","route","model")
);
--> statement-breakpoint
CREATE TABLE "usage_hourly_agg" (
	"bucket_start" timestamp with time zone NOT NULL,
	"route" text NOT NULL,
	"model" text NOT NULL,
	"total_tokens" bigint DEFAULT 0 NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"cached_tokens" bigint DEFAULT 0 NOT NULL,
	"total_requests" bigint DEFAULT 0 NOT NULL,
	"success_count" bigint DEFAULT 0 NOT NULL,
	"failure_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_hourly_agg_bucket_start_route_model_pk" PRIMARY KEY("bucket_start","route","model")
);
