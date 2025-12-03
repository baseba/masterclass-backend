/*
  Warnings:

  - You are about to drop the column `pricingPlanId` on the `Student` table. All the data in the column will be lost.

*/
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- DropForeignKey
ALTER TABLE "public"."Student" DROP CONSTRAINT "Student_pricingPlanId_fkey";

-- AlterTable
ALTER TABLE "public"."Admin" ADD COLUMN     "resetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT;

-- AlterTable
ALTER TABLE "public"."Professor" ADD COLUMN     "resetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT;

-- AlterTable
ALTER TABLE "public"."Slot" ALTER COLUMN "link" SET DEFAULT gen_random_uuid()::text;

-- AlterTable
ALTER TABLE "public"."Student" DROP COLUMN "pricingPlanId",
ADD COLUMN     "resetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT;

-- CreateTable
CREATE TABLE "public"."_PricingPlanToStudent" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PricingPlanToStudent_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_PricingPlanToStudent_B_index" ON "public"."_PricingPlanToStudent"("B");

-- AddForeignKey
ALTER TABLE "public"."_PricingPlanToStudent" ADD CONSTRAINT "_PricingPlanToStudent_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."PricingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PricingPlanToStudent" ADD CONSTRAINT "_PricingPlanToStudent_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
