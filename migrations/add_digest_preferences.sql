-- Add digest-related columns to alumni table
ALTER TABLE "alumni" ADD COLUMN IF NOT EXISTS "weekly_digest_enabled" boolean DEFAULT true;
ALTER TABLE "alumni" ADD COLUMN IF NOT EXISTS "last_digest_sent_at" timestamp;
ALTER TABLE "alumni" ADD COLUMN IF NOT EXISTS "job_alerts_enabled" boolean DEFAULT true;
ALTER TABLE "alumni" ADD COLUMN IF NOT EXISTS "job_alert_preferences" text DEFAULT '{}';

-- Create job_alerts_sent table to track sent job alerts
CREATE TABLE IF NOT EXISTS "job_alerts_sent" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "job_id" varchar NOT NULL,
    "alumni_id" varchar NOT NULL,
    "match_score" integer NOT NULL,
    "sent_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "job_alerts_sent_job_id_alumni_id_unique" UNIQUE("job_id", "alumni_id")
);

-- Add foreign key constraints
DO $$ BEGIN
    ALTER TABLE "job_alerts_sent" ADD CONSTRAINT "job_alerts_sent_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "job_alerts_sent" ADD CONSTRAINT "job_alerts_sent_alumni_id_alumni_id_fk" FOREIGN KEY ("alumni_id") REFERENCES "public"."alumni"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
