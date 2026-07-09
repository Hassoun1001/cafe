-- CreateEnum
CREATE TYPE "AppSystem" AS ENUM ('CAFE', 'STUDY');

-- CreateEnum
CREATE TYPE "TableKind" AS ENUM ('DINING', 'STUDY_TABLE', 'STUDY_ROOM');

-- CreateEnum
CREATE TYPE "StudyBookingStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "AppConfig" DROP COLUMN "passwordHash";

-- AlterTable
ALTER TABLE "CafeTable" ADD COLUMN     "kind" "TableKind" NOT NULL DEFAULT 'DINING';

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "system" "AppSystem" NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyConfig" (
    "id" TEXT NOT NULL,
    "hourlyRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'SYP',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyBooking" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "status" "StudyBookingStatus" NOT NULL DEFAULT 'ACTIVE',
    "customerName" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(4,2) NOT NULL,
    "hourlyRate" DECIMAL(12,2) NOT NULL,
    "roomFee" DECIMAL(12,2) NOT NULL,
    "hasDrink" BOOLEAN NOT NULL DEFAULT false,
    "cafeOrderId" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" "PaymentMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_system_username_key" ON "User"("system", "username");

-- CreateIndex
CREATE UNIQUE INDEX "StudyBooking_cafeOrderId_key" ON "StudyBooking"("cafeOrderId");

-- CreateIndex
CREATE INDEX "StudyBooking_tableId_idx" ON "StudyBooking"("tableId");

-- CreateIndex
CREATE INDEX "StudyBooking_status_idx" ON "StudyBooking"("status");

-- AddForeignKey
ALTER TABLE "StudyBooking" ADD CONSTRAINT "StudyBooking_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CafeTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyBooking" ADD CONSTRAINT "StudyBooking_cafeOrderId_fkey" FOREIGN KEY ("cafeOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

