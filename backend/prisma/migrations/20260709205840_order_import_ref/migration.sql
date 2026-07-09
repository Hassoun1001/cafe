-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "importRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_importRef_key" ON "Order"("importRef");

