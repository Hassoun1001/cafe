-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "lineTotal";

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_menuItemId_key" ON "OrderItem"("orderId", "menuItemId");
