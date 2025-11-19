/*
  Migration: create PricingPlan, backfill existing reservations and students
  with a default plan, then make Reservation.pricingPlanId NOT NULL.

  Steps:
  1) Create the `PricingPlan` table.
  2) Insert a default/fallback plan.
  3) Add nullable `pricingPlanId` to `Reservation` and `Student`.
  4) Backfill existing `Reservation` rows to point to the default plan.
  5) Make `Reservation.pricingPlanId` NOT NULL and add FKs/indexes.
  6) Drop `Class.basePrice` (as original migration intended).
*/

-- 1) Create PricingPlan table
CREATE TABLE IF NOT EXISTS "public"."PricingPlan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reservationCount" INTEGER NOT NULL,
    CONSTRAINT "PricingPlan_pkey" PRIMARY KEY ("id")
);

-- 2) Insert a default fallback plan (if none exists)
INSERT INTO "public"."PricingPlan" ("name","description","price","isActive","reservationCount")
SELECT 'default','Fallback plan created during migration',0,true,0
WHERE NOT EXISTS (SELECT 1 FROM "public"."PricingPlan");

-- 3) Add nullable pricingPlanId to Reservation and Student
ALTER TABLE "public"."Reservation" ADD COLUMN IF NOT EXISTS "pricingPlanId" INTEGER;
ALTER TABLE "public"."Student" ADD COLUMN IF NOT EXISTS "pricingPlanId" INTEGER;

-- 4) Backfill existing reservations to point to the default plan
UPDATE "public"."Reservation"
SET "pricingPlanId" = (
  SELECT id FROM "public"."PricingPlan" ORDER BY id LIMIT 1
)
WHERE "pricingPlanId" IS NULL;

-- 5) Make Reservation.pricingPlanId NOT NULL now that we've backfilled
ALTER TABLE "public"."Reservation" ALTER COLUMN "pricingPlanId" SET NOT NULL;

-- Create index for Reservation.pricingPlanId
CREATE INDEX IF NOT EXISTS "Reservation_pricingPlanId_idx" ON "public"."Reservation"("pricingPlanId");

-- Add foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'Reservation'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'pricingPlanId'
  ) THEN
    ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_pricingPlanId_fkey" FOREIGN KEY ("pricingPlanId") REFERENCES "public"."PricingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'Student'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'pricingPlanId'
  ) THEN
    ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_pricingPlanId_fkey" FOREIGN KEY ("pricingPlanId") REFERENCES "public"."PricingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- 6) Drop Class.basePrice (data loss warning: this removes the column)
ALTER TABLE "public"."Class" DROP COLUMN IF EXISTS "basePrice";
