/*
  Warnings:

  - You are about to drop the column `basePrice` on the `Class` table. All the data in the column will be lost.
  - Added the required column `pricingPlanId` to the `Reservation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Class" DROP COLUMN "basePrice";

-- AlterTable
ALTER TABLE "public"."Reservation" ADD COLUMN     "pricingPlanId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."Student" ADD COLUMN     "pricingPlanId" INTEGER;

-- CreateTable
CREATE TABLE "public"."PricingPlan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reservationCount" INTEGER NOT NULL,

    CONSTRAINT "PricingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reservation_pricingPlanId_idx" ON "public"."Reservation"("pricingPlanId");

-- AddForeignKey
ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_pricingPlanId_fkey" FOREIGN KEY ("pricingPlanId") REFERENCES "public"."PricingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_pricingPlanId_fkey" FOREIGN KEY ("pricingPlanId") REFERENCES "public"."PricingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
