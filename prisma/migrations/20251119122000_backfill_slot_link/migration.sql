-- Backfill NULL `link` values on Slot and make column NOT NULL
-- This migration attempts to use PG functions if available (pgcrypto or uuid-ossp),
-- and falls back to a deterministic md5-based UUID-like value if neither is present.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid') THEN
    UPDATE "public"."Slot" SET "link" = gen_random_uuid()::text WHERE "link" IS NULL;
  ELSIF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'uuid_generate_v4') THEN
    UPDATE "public"."Slot" SET "link" = uuid_generate_v4()::text WHERE "link" IS NULL;
  ELSE
    -- Fallback: use md5(random||clock_timestamp) to generate a 32-hex string and format as UUID
    UPDATE "public"."Slot"
    SET "link" = regexp_replace(md5(random()::text || clock_timestamp()::text),
      '([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})',
      '\1-\2-\3-\4-\5')
    WHERE "link" IS NULL;
  END IF;
END$$;

-- Ensure a unique index exists on link
CREATE UNIQUE INDEX IF NOT EXISTS "Slot_link_key" ON "public"."Slot"("link");

-- Finally, enforce NOT NULL on the column
ALTER TABLE "public"."Slot" ALTER COLUMN "link" SET NOT NULL;
