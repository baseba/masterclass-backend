-- Add confirmed column to Student and Professor
ALTER TABLE "public"."Student"
ADD COLUMN IF NOT EXISTS "confirmed" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."Professor"
ADD COLUMN IF NOT EXISTS "confirmed" boolean NOT NULL DEFAULT false;

-- Optionally, if you need to backfill existing users as confirmed, run:
-- UPDATE "public"."Student" SET "confirmed" = true WHERE /* condition */;
-- UPDATE "public"."Professor" SET "confirmed" = true WHERE /* condition */;

-- Backfill existing users as confirmed
UPDATE "public"."Student" SET "confirmed" = true WHERE "confirmed" IS DISTINCT FROM true;
UPDATE "public"."Professor" SET "confirmed" = true WHERE "confirmed" IS DISTINCT FROM true;
