-- CreateTable
CREATE TABLE "StockCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockCategory_name_key" ON "StockCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StockUnit_name_key" ON "StockUnit"("name");


-- Seed with the values that were previously hardcoded in the frontend, so
-- existing Warehouse "Add item" behavior doesn't regress after this migration.
INSERT INTO "StockCategory" ("id", "name", "sortOrder") VALUES
  (gen_random_uuid()::text, 'Coffee & drinks', 0),
  (gen_random_uuid()::text, 'Dairy', 1),
  (gen_random_uuid()::text, 'Dry goods', 2),
  (gen_random_uuid()::text, 'Packaging', 3),
  (gen_random_uuid()::text, 'Sweets & desserts', 4),
  (gen_random_uuid()::text, 'Hookah', 5),
  (gen_random_uuid()::text, 'Other', 6)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "StockUnit" ("id", "name", "sortOrder") VALUES
  (gen_random_uuid()::text, 'kg', 0),
  (gen_random_uuid()::text, 'L', 1),
  (gen_random_uuid()::text, 'pcs', 2),
  (gen_random_uuid()::text, 'box', 3),
  (gen_random_uuid()::text, 'pack', 4),
  (gen_random_uuid()::text, 'bag', 5)
ON CONFLICT ("name") DO NOTHING;
