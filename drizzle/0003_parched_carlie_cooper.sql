CREATE INDEX "idx_daily_agg_day" ON "usage_daily_agg" USING btree ("day_start");--> statement-breakpoint
CREATE INDEX "idx_hourly_agg_bucket" ON "usage_hourly_agg" USING btree ("bucket_start");