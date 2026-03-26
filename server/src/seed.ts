import prisma from './lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Seeding database...');

  // Create super admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@affiliates.com' },
    update: {},
    create: {
      email: 'admin@affiliates.com',
      name: 'Admin',
      passwordHash: adminPassword,
      passwordPlain: 'admin123',
      role: 'SUPER_ADMIN',
    },
  });
  console.log(`Super Admin created: ${admin.email}`);

  // Create test affiliate 1
  const affPassword = await bcrypt.hash('test123', 10);
  const affiliate1 = await prisma.user.upsert({
    where: { email: 'influencer@test.com' },
    update: {},
    create: {
      email: 'influencer@test.com',
      name: 'Test Influencer',
      passwordHash: affPassword,
      role: 'AFFILIATE',
      defaultCommissionRate: 0.20,
    },
  });
  console.log(`Affiliate created: ${affiliate1.email}`);

  // Create test affiliate 2
  const affiliate2 = await prisma.user.upsert({
    where: { email: 'jake@fitness.com' },
    update: {},
    create: {
      email: 'jake@fitness.com',
      name: 'Jake Fitness',
      passwordHash: affPassword,
      role: 'AFFILIATE',
      defaultCommissionRate: 0.25,
    },
  });
  console.log(`Affiliate created: ${affiliate2.email}`);

  // Create test affiliate 3
  const affiliate3 = await prisma.user.upsert({
    where: { email: 'sarah@wellness.co' },
    update: {},
    create: {
      email: 'sarah@wellness.co',
      name: 'Sarah Wellness',
      passwordHash: affPassword,
      role: 'AFFILIATE',
      defaultCommissionRate: 0.20,
    },
  });
  console.log(`Affiliate created: ${affiliate3.email}`);

  // Create test affiliate 4
  const affiliate4 = await prisma.user.upsert({
    where: { email: 'mike@biohack.io' },
    update: {},
    create: {
      email: 'mike@biohack.io',
      name: 'BioHack Mike',
      passwordHash: affPassword,
      role: 'AFFILIATE',
      defaultCommissionRate: 0.15,
    },
  });
  console.log(`Affiliate created: ${affiliate4.email}`);

  // ---- DISCOUNT CODES ----

  // Affiliate 1 codes
  const code1 = await prisma.discountCode.upsert({
    where: { code: 'TESTINFLUENCER10' },
    update: {},
    create: {
      code: 'TESTINFLUENCER10',
      affiliateId: affiliate1.id,
      discountPercent: 0.10,
      label: 'Main promo code',
      expiresAt: new Date('2026-12-31'),
    },
  });

  const code2 = await prisma.discountCode.upsert({
    where: { code: 'TESTSUMMER10' },
    update: {},
    create: {
      code: 'TESTSUMMER10',
      affiliateId: affiliate1.id,
      discountPercent: 0.10,
      label: 'Summer campaign',
      expiresAt: new Date('2026-06-30'),
    },
  });

  // Affiliate 2 codes
  const code3 = await prisma.discountCode.upsert({
    where: { code: 'JAKE20' },
    update: {},
    create: {
      code: 'JAKE20',
      affiliateId: affiliate2.id,
      discountPercent: 0.10,
      commissionRateOverride: 0.25,
      label: 'TikTok main',
      expiresAt: new Date('2026-12-31'),
    },
  });

  const code4 = await prisma.discountCode.upsert({
    where: { code: 'JAKEGYM' },
    update: {},
    create: {
      code: 'JAKEGYM',
      affiliateId: affiliate2.id,
      discountPercent: 0.15,
      label: 'YouTube gym content',
      expiresAt: new Date('2026-09-01'),
    },
  });

  // Affiliate 3 codes
  const code5 = await prisma.discountCode.upsert({
    where: { code: 'SARAHWELL' },
    update: {},
    create: {
      code: 'SARAHWELL',
      affiliateId: affiliate3.id,
      discountPercent: 0.10,
      label: 'Instagram bio',
      expiresAt: null,
    },
  });

  // Affiliate 4 codes
  const code6 = await prisma.discountCode.upsert({
    where: { code: 'BIOHACK10' },
    update: {},
    create: {
      code: 'BIOHACK10',
      affiliateId: affiliate4.id,
      discountPercent: 0.10,
      label: 'Podcast link',
      expiresAt: new Date('2026-08-15'),
    },
  });

  // ---- ORDERS ----

  // Affiliate 1 orders
  const orders1 = [
    { customerFirstName: 'John', customerLastName: 'Smith', itemsSummary: 'BPC-157 x2, TB-500 x1', orderTotal: 189.00, daysAgo: 0 },
    { customerFirstName: 'Sarah', customerLastName: 'Johnson', itemsSummary: 'BPC-157 x1', orderTotal: 79.00, daysAgo: 0 },
    { customerFirstName: 'Mike', customerLastName: 'Williams', itemsSummary: 'GHK-Cu x1, BPC-157 x1', orderTotal: 145.00, daysAgo: 1 },
    { customerFirstName: 'Emily', customerLastName: 'Brown', itemsSummary: 'TB-500 x3', orderTotal: 267.00, daysAgo: 2 },
    { customerFirstName: 'David', customerLastName: 'Jones', itemsSummary: 'BPC-157 x1', orderTotal: 79.00, daysAgo: 5 },
    { customerFirstName: 'Lisa', customerLastName: 'Davis', itemsSummary: 'Semax x2, Selank x1', orderTotal: 198.00, daysAgo: 7 },
    { customerFirstName: 'James', customerLastName: 'Miller', itemsSummary: 'BPC-157 x1, GHK-Cu x1', orderTotal: 158.00, daysAgo: 12 },
    { customerFirstName: 'Anna', customerLastName: 'Wilson', itemsSummary: 'TB-500 x1', orderTotal: 89.00, daysAgo: 20 },
  ];

  for (const o of orders1) {
    const date = new Date();
    date.setDate(date.getDate() - o.daysAgo);
    const commission = parseFloat((o.orderTotal * 0.20).toFixed(2));
    await prisma.order.create({
      data: {
        discountCodeId: o.daysAgo % 2 === 0 ? code1.id : code2.id,
        customerFirstName: o.customerFirstName,
        customerLastName: (o as any).customerLastName || null,
        itemsSummary: o.itemsSummary,
        orderTotal: o.orderTotal,
        commissionEarned: commission,
        attributed: true,
        source: o.daysAgo % 3 === 0 ? 'wordpress' : 'shopify',
        storeName: o.daysAgo % 3 === 0 ? 'WP Health Hub' : (o.daysAgo % 2 === 0 ? 'Peptide Pro Shop' : 'Bio Wellness Store'),
        createdAt: date,
      },
    });
  }

  // Affiliate 2 orders (Jake - high performer)
  const orders2 = [
    { customerFirstName: 'Tyler', customerLastName: 'Anderson', itemsSummary: 'BPC-157 x3, TB-500 x2', orderTotal: 345.00, daysAgo: 0 },
    { customerFirstName: 'Brandon', customerLastName: 'Taylor', itemsSummary: 'GHK-Cu x2, Semax x1', orderTotal: 220.00, daysAgo: 0 },
    { customerFirstName: 'Chris', customerLastName: 'Thomas', itemsSummary: 'TB-500 x2', orderTotal: 178.00, daysAgo: 1 },
    { customerFirstName: 'Jordan', customerLastName: 'Jackson', itemsSummary: 'BPC-157 x4', orderTotal: 316.00, daysAgo: 1 },
    { customerFirstName: 'Alex', customerLastName: 'White', itemsSummary: 'BPC-157 x1, Selank x2', orderTotal: 237.00, daysAgo: 2 },
    { customerFirstName: 'Ryan', customerLastName: 'Harris', itemsSummary: 'TB-500 x1, GHK-Cu x1', orderTotal: 178.00, daysAgo: 3 },
    { customerFirstName: 'Matt', customerLastName: 'Martin', itemsSummary: 'BPC-157 x2', orderTotal: 158.00, daysAgo: 4 },
    { customerFirstName: 'Derek', customerLastName: 'Garcia', itemsSummary: 'Semax x3, Selank x2', orderTotal: 295.00, daysAgo: 5 },
    { customerFirstName: 'Nick', customerLastName: 'Martinez', itemsSummary: 'BPC-157 x1', orderTotal: 79.00, daysAgo: 6 },
    { customerFirstName: 'Kevin', customerLastName: 'Robinson', itemsSummary: 'TB-500 x2, BPC-157 x1', orderTotal: 257.00, daysAgo: 8 },
    { customerFirstName: 'Brian', customerLastName: 'Clark', itemsSummary: 'GHK-Cu x3', orderTotal: 267.00, daysAgo: 14 },
    { customerFirstName: 'Steve', customerLastName: 'Lewis', itemsSummary: 'BPC-157 x1, TB-500 x1', orderTotal: 168.00, daysAgo: 25 },
  ];

  for (const o of orders2) {
    const date = new Date();
    date.setDate(date.getDate() - o.daysAgo);
    const commission = parseFloat((o.orderTotal * 0.25).toFixed(2));
    await prisma.order.create({
      data: {
        discountCodeId: o.daysAgo % 2 === 0 ? code3.id : code4.id,
        customerFirstName: o.customerFirstName,
        customerLastName: (o as any).customerLastName || null,
        itemsSummary: o.itemsSummary,
        orderTotal: o.orderTotal,
        commissionEarned: commission,
        attributed: true,
        source: o.daysAgo % 2 === 0 ? 'shopify' : 'wordpress',
        storeName: o.daysAgo % 2 === 0 ? 'Peptide Pro Shop' : 'WP Health Hub',
        createdAt: date,
      },
    });
  }

  // Affiliate 3 orders (Sarah - medium performer)
  const orders3 = [
    { customerFirstName: 'Rachel', customerLastName: 'Lee', itemsSummary: 'Semax x1, Selank x1', orderTotal: 158.00, daysAgo: 0 },
    { customerFirstName: 'Olivia', customerLastName: 'Walker', itemsSummary: 'BPC-157 x1', orderTotal: 79.00, daysAgo: 1 },
    { customerFirstName: 'Emma', customerLastName: 'Hall', itemsSummary: 'GHK-Cu x2', orderTotal: 178.00, daysAgo: 3 },
    { customerFirstName: 'Sophia', customerLastName: 'Allen', itemsSummary: 'TB-500 x1, BPC-157 x1', orderTotal: 168.00, daysAgo: 5 },
    { customerFirstName: 'Mia', customerLastName: 'Young', itemsSummary: 'Semax x2', orderTotal: 138.00, daysAgo: 9 },
    { customerFirstName: 'Ava', customerLastName: 'King', itemsSummary: 'BPC-157 x2, GHK-Cu x1', orderTotal: 247.00, daysAgo: 15 },
  ];

  for (const o of orders3) {
    const date = new Date();
    date.setDate(date.getDate() - o.daysAgo);
    const commission = parseFloat((o.orderTotal * 0.20).toFixed(2));
    await prisma.order.create({
      data: {
        discountCodeId: code5.id,
        customerFirstName: o.customerFirstName,
        customerLastName: (o as any).customerLastName || null,
        itemsSummary: o.itemsSummary,
        orderTotal: o.orderTotal,
        commissionEarned: commission,
        attributed: true,
        source: 'shopify',
        storeName: 'Bio Wellness Store',
        createdAt: date,
      },
    });
  }

  // Affiliate 4 orders (Mike - smaller)
  const orders4 = [
    { customerFirstName: 'Dan', customerLastName: 'Wright', itemsSummary: 'BPC-157 x1, Semax x1', orderTotal: 148.00, daysAgo: 1 },
    { customerFirstName: 'Tom', customerLastName: 'Lopez', itemsSummary: 'TB-500 x1', orderTotal: 89.00, daysAgo: 4 },
    { customerFirstName: 'Ben', customerLastName: 'Hill', itemsSummary: 'GHK-Cu x1, Selank x1', orderTotal: 167.00, daysAgo: 10 },
  ];

  for (const o of orders4) {
    const date = new Date();
    date.setDate(date.getDate() - o.daysAgo);
    const commission = parseFloat((o.orderTotal * 0.15).toFixed(2));
    await prisma.order.create({
      data: {
        discountCodeId: code6.id,
        customerFirstName: o.customerFirstName,
        customerLastName: (o as any).customerLastName || null,
        itemsSummary: o.itemsSummary,
        orderTotal: o.orderTotal,
        commissionEarned: commission,
        attributed: true,
        source: 'wordpress',
        storeName: 'WP Health Hub',
        createdAt: date,
      },
    });
  }

  const totalOrders = orders1.length + orders2.length + orders3.length + orders4.length;
  console.log(`${totalOrders} test orders created`);

  console.log('\n--- Login Credentials ---');
  console.log('Admin:       admin@affiliates.com / admin123');
  console.log('Affiliate 1: influencer@test.com / test123');
  console.log('Affiliate 2: jake@fitness.com / test123');
  console.log('Affiliate 3: sarah@wellness.co / test123');
  console.log('Affiliate 4: mike@biohack.io / test123');
  console.log('-------------------------\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
