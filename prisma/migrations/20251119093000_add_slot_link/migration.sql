-- Add nullable link column to Slot table. Backfill will be handled by a Node script
-- to avoid requiring the pgcrypto extension on the target DB.
ALTER TABLE "public"."Slot"
ADD COLUMN IF NOT EXISTS "link" TEXT;

-- Create unique index on link (NULLs are allowed; backfill script will replace NULLs
-- and then the script will set the column to NOT NULL).
CREATE UNIQUE INDEX IF NOT EXISTS "Slot_link_key" ON "public"."Slot"("link");

-- NOTE: After this migration is applied, run `scripts/backfill_slot_links.js` to
-- populate `link` for existing rows and make the column NOT NULL.
