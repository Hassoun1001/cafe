import { PrismaClient, StockAdjustReason } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const NUM_TABLES = 30;

const CATEGORIES = ['Hot Drinks', 'Cold Drinks', 'Signature', 'Desserts', 'Hookah'] as const;

const MENU: { name: string; sub: string; cat: (typeof CATEGORIES)[number] }[] = [
  // Hot Drinks
  { name: 'Nescafe 3-in-1', sub: '', cat: 'Hot Drinks' },
  { name: 'Nescafe Black', sub: '', cat: 'Hot Drinks' },
  { name: 'Nescafe Gold', sub: '', cat: 'Hot Drinks' },
  { name: 'Herbal Teas', sub: 'Assorted', cat: 'Hot Drinks' },
  { name: 'Espresso', sub: 'Single/Lungo/Nestle/Double', cat: 'Hot Drinks' },
  { name: 'Tea', sub: 'Red/Green/Flavored', cat: 'Hot Drinks' },
  { name: 'Turkish Coffee', sub: 'Regular/Double', cat: 'Hot Drinks' },
  { name: 'Cappuccino', sub: 'Classic/Vanilla/Mocha/Hazelnut/Caramel', cat: 'Hot Drinks' },
  { name: 'Hot Chocolate', sub: '', cat: 'Hot Drinks' },
  { name: 'Cumin & Lemon', sub: '', cat: 'Hot Drinks' },
  { name: 'Milo', sub: '', cat: 'Hot Drinks' },
  { name: 'Americano', sub: '', cat: 'Hot Drinks' },
  { name: 'Cortado', sub: '', cat: 'Hot Drinks' },
  { name: 'Macchiato', sub: 'Caramel', cat: 'Hot Drinks' },
  { name: 'Sahlab', sub: '', cat: 'Hot Drinks' },
  { name: 'Swiss Miss', sub: '', cat: 'Hot Drinks' },
  // Cold Drinks
  { name: 'Ice Tea', sub: 'Peach/Strawberry/Berry/Kiwi', cat: 'Cold Drinks' },
  { name: 'Mojito', sub: 'Berries/Strawberry/Pineapple/Orange/Polo/Fruits/Watermelon/Kiwi/Mixed', cat: 'Cold Drinks' },
  { name: 'Soft Drink', sub: 'Pepsi/7Up/Orange/Apple', cat: 'Cold Drinks' },
  { name: 'Fresh Juices', sub: 'Berries/Strawberry/Pineapple/Orange/Lemon/Peach/Watermelon/Kiwi', cat: 'Cold Drinks' },
  { name: 'Cocktails', sub: 'Pina Colada/Banana Milk/Fruit Mix/Avocado', cat: 'Cold Drinks' },
  { name: 'Energy Mix', sub: 'Mixed Berries/Green Energy/Tropical/Jamaica', cat: 'Cold Drinks' },
  {
    name: 'Milkshake',
    sub: 'Oreo/Brownies/Twix/Snickers/Bounty/Lotus/Choc/Vanilla/Strawberry/Caramel',
    cat: 'Cold Drinks',
  },
  { name: 'Barbican', sub: '', cat: 'Cold Drinks' },
  { name: 'Iced Americano', sub: '', cat: 'Cold Drinks' },
  { name: 'Iced Cappuccino', sub: '', cat: 'Cold Drinks' },
  { name: 'Iced Coffee', sub: 'Caramel/Mocha/Vanilla/Classic/Hazelnut', cat: 'Cold Drinks' },
  { name: 'Iced Latte', sub: 'Vanilla/Caramel/Hazelnut/Tiramisu/Blue Coconut', cat: 'Cold Drinks' },
  { name: 'Frappuccino', sub: 'Caramel/Hazelnut/Mocha/Vanilla/Classic', cat: 'Cold Drinks' },
  { name: 'Spanish Latte', sub: '', cat: 'Cold Drinks' },
  { name: 'Mineral Water', sub: '', cat: 'Cold Drinks' },
  { name: 'Redbull', sub: '', cat: 'Cold Drinks' },
  { name: 'Diet Redbull', sub: '', cat: 'Cold Drinks' },
  // Signature
  { name: 'Iced Tea Tropical Boom', sub: 'Signature', cat: 'Signature' },
  { name: 'Iced Tea Pink Beach', sub: 'Signature', cat: 'Signature' },
  { name: 'Studio Iced Tea', sub: 'Signature', cat: 'Signature' },
  // Desserts
  { name: 'Pan Cake', sub: 'White Choc/Choc/Lotus/Fruits', cat: 'Desserts' },
  { name: 'Crepe', sub: 'White Choc/Choc/Lotus/Fruits/Kinder', cat: 'Desserts' },
  { name: 'Ice Cream', sub: '', cat: 'Desserts' },
  { name: 'Brownies', sub: '', cat: 'Desserts' },
  { name: 'Fondant', sub: '', cat: 'Desserts' },
  { name: 'Crepe Fettuccini', sub: 'Kinder/Choc/White Choc/Lotus', cat: 'Desserts' },
  { name: 'Waffle', sub: '', cat: 'Desserts' },
  { name: 'Cookies', sub: 'Double Choc/Lotus/Original', cat: 'Desserts' },
  { name: 'Cake', sub: 'Apple/Orange/Choc', cat: 'Desserts' },
  { name: 'Cheese Cake', sub: 'Mango/Blueberry/Choc/Lotus', cat: 'Desserts' },
  // Hookah
  { name: 'Two Apples', sub: 'Nakhleh/Fakher/Mazaya', cat: 'Hookah' },
  { name: 'Grape', sub: '', cat: 'Hookah' },
  { name: 'Polo', sub: '', cat: 'Hookah' },
  { name: 'Grape & Mint', sub: '', cat: 'Hookah' },
  { name: 'BlueBerry', sub: '', cat: 'Hookah' },
  { name: 'Love', sub: '', cat: 'Hookah' },
  { name: 'Gum', sub: '', cat: 'Hookah' },
  { name: 'Gum + Mint', sub: '', cat: 'Hookah' },
];

const STOCK = [
  { name: 'Coffee beans', qty: 5, unit: 'kg', min: 2, cost: 500000, cat: 'Coffee & drinks' },
  { name: 'Milk', qty: 10, unit: 'L', min: 5, cost: 15000, cat: 'Dairy' },
  { name: 'Sugar', qty: 5, unit: 'kg', min: 2, cost: 12000, cat: 'Dry goods' },
  { name: 'Paper cups', qty: 200, unit: 'pcs', min: 50, cost: 500, cat: 'Packaging' },
  { name: 'Cream', qty: 3, unit: 'L', min: 2, cost: 40000, cat: 'Dairy' },
  { name: 'Chocolate sauce', qty: 4, unit: 'pack', min: 2, cost: 80000, cat: 'Dry goods' },
  { name: 'Caramel sauce', qty: 3, unit: 'pack', min: 2, cost: 80000, cat: 'Dry goods' },
  { name: 'Vanilla syrup', qty: 2, unit: 'L', min: 1, cost: 120000, cat: 'Coffee & drinks' },
  { name: 'Hazelnut syrup', qty: 2, unit: 'L', min: 1, cost: 120000, cat: 'Coffee & drinks' },
  { name: 'Lotus spread', qty: 2, unit: 'kg', min: 1, cost: 150000, cat: 'Sweets & desserts' },
  { name: 'Kinder / Ferrero', qty: 10, unit: 'pcs', min: 5, cost: 8000, cat: 'Sweets & desserts' },
  { name: 'Ice', qty: 20, unit: 'kg', min: 5, cost: 5000, cat: 'Other' },
];

const EMPLOYEES = [
  { name: 'Jad Akbik', nameAr: 'جاد اقبيق' },
  { name: 'Abd Diab', nameAr: 'عبد دياب' },
  { name: 'Othman Diab', nameAr: 'عثمان دياب' },
  { name: 'Amer Al Kellawi', nameAr: 'عامر الكلاوي' },
];

const NUM_STUDY_TABLES = 9;
const NUM_STUDY_ROOMS = 2;
// Deliberately NOT the old shared password (01090703) — that one is already
// public (README history, chat logs) and must never be reused for a real
// credential. This is a one-time bootstrap value; change it immediately.
const DEFAULT_ADMIN_PASSWORD = 'StudioCafe#2026Setup';

async function main() {
  // AppConfig singleton — only create if missing so re-running seed never resets settings.
  const existingConfig = await prisma.appConfig.findFirst();
  if (!existingConfig) {
    await prisma.appConfig.create({
      data: {
        receiptName: 'Studio Cafe',
        receiptFooter: 'Thank you! Focus. Connect. Inspire.',
        currency: 'SYP',
      },
    });
    console.log('Seeded AppConfig');
  }

  // Roles were introduced after accounts already existed on deployed
  // instances — the migration defaults every existing User row to STAFF,
  // which would silently lock real admins out of Settings. If a system has
  // zero ADMIN accounts, promote every existing account for that system
  // once (matches "everyone who could log in before had full access,
  // since roles didn't exist yet"). Runs on every boot but is a no-op once
  // at least one admin exists, so it only ever fires the one time it's needed.
  for (const system of ['CAFE', 'STUDY'] as const) {
    const adminCount = await prisma.user.count({ where: { system, role: 'ADMIN' } });
    if (adminCount === 0) {
      const { count } = await prisma.user.updateMany({ where: { system }, data: { role: 'ADMIN' } });
      if (count > 0) console.log(`Promoted ${count} existing ${system} user(s) to ADMIN (roles just introduced)`);
    }
  }

  // One default admin account per system — separate logins, same bootstrap
  // password for onboarding convenience. Change both immediately after first login.
  for (const system of ['CAFE', 'STUDY'] as const) {
    const existingAdmin = await prisma.user.findFirst({ where: { system, username: 'admin' } });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
      await prisma.user.create({ data: { system, username: 'admin', passwordHash, role: 'ADMIN' } });
      console.log(`Seeded ${system} admin user (username: admin) — change the bootstrap password immediately`);
    }
  }

  const existingVat = await prisma.taxRate.findUnique({ where: { name: 'VAT' } });
  if (!existingVat) {
    await prisma.taxRate.create({
      data: { name: 'VAT', percent: 8.1, compound: false, defaultOn: false, sortOrder: 0 },
    });
    console.log('Seeded default VAT tax rate (8.1%, off by default)');
  }

  for (const [i, name] of CATEGORIES.entries()) {
    await prisma.menuCategory.upsert({
      where: { name },
      update: {},
      create: { name, sortOrder: i },
    });
  }

  for (const [i, m] of MENU.entries()) {
    const category = await prisma.menuCategory.findUniqueOrThrow({ where: { name: m.cat } });
    const existing = await prisma.menuItem.findFirst({ where: { name: m.name, categoryId: category.id } });
    if (!existing) {
      await prisma.menuItem.create({
        data: { name: m.name, sub: m.sub, price: 0, categoryId: category.id, sortOrder: i },
      });
    }
  }
  console.log(`Seeded ${MENU.length} menu items across ${CATEGORIES.length} categories`);

  for (const s of STOCK) {
    const existing = await prisma.stockItem.findUnique({ where: { name: s.name } });
    if (!existing) {
      const item = await prisma.stockItem.create({
        data: { name: s.name, category: s.cat, unit: s.unit, qty: s.qty, minQty: s.min, costPerUnit: s.cost },
      });
      await prisma.stockAdjustment.create({
        data: {
          stockItemId: item.id,
          delta: s.qty,
          resultingQty: s.qty,
          reason: StockAdjustReason.RESTOCK,
          note: 'Initial seed stock',
        },
      });
    }
  }
  console.log(`Seeded ${STOCK.length} stock items`);

  for (const e of EMPLOYEES) {
    const existing = await prisma.employee.findFirst({ where: { name: e.name } });
    if (!existing) {
      await prisma.employee.create({ data: e });
    }
  }
  console.log(`Seeded ${EMPLOYEES.length} employees`);

  for (let n = 1; n <= NUM_TABLES; n++) {
    await prisma.cafeTable.upsert({
      where: { number: n },
      update: {},
      create: { number: n },
    });
  }
  console.log(`Seeded ${NUM_TABLES} tables`);

  const existingStudyConfig = await prisma.studyConfig.findFirst();
  if (!existingStudyConfig) {
    await prisma.studyConfig.create({ data: { tableHourlyRate: 0, roomHourlyRate: 0, currency: 'SYP' } });
    console.log('Seeded StudyConfig (hourly rates: 0 — set real rates from Study Settings)');
  }

  // Study tables/rooms are plain CafeTable rows (kind STUDY_TABLE/STUDY_ROOM)
  // numbered 101+ so they never collide with the 1-30 dining table range.
  for (let n = 1; n <= NUM_STUDY_TABLES; n++) {
    const number = 100 + n;
    await prisma.cafeTable.upsert({
      where: { number },
      update: {},
      create: { number, label: `Study Table ${n}`, kind: 'STUDY_TABLE' },
    });
  }
  for (let n = 1; n <= NUM_STUDY_ROOMS; n++) {
    const number = 200 + n;
    await prisma.cafeTable.upsert({
      where: { number },
      update: {},
      create: { number, label: `Room ${n}`, kind: 'STUDY_ROOM' },
    });
  }
  console.log(`Seeded ${NUM_STUDY_TABLES} study tables + ${NUM_STUDY_ROOMS} study rooms`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
