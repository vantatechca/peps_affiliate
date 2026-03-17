// ============================================
// ADD AFFILIATES & DISCOUNT CODES
// ============================================
// Edit the array below, then run:
//   cd server && npx tsx src/add-affiliates.ts
// ============================================

import prisma from './lib/prisma';
import bcrypt from 'bcryptjs';

const AFFILIATES = [
  // ---- COPY THIS BLOCK FOR EACH AFFILIATE ----
  {
    name: 'Jake Fitness',
    email: 'jake@fitness.com',
    password: 'jake2026',
    commissionRate: 0.20,       // 20%
    codes: [
      { code: 'JAKE10', discountPercent: 0.10, label: 'TikTok main', expiresAt: '2026-12-31' },
      { code: 'JAKEGYM', discountPercent: 0.15, label: 'YouTube', expiresAt: '2026-09-01' },
    ],
  },
  // ---- ADD MORE AFFILIATES BELOW ----
  // {
  //   name: 'Sarah Wellness',
  //   email: 'sarah@wellness.co',
  //   password: 'sarah2026',
  //   commissionRate: 0.20,
  //   codes: [
  //     { code: 'SARAH10', discountPercent: 0.10, label: 'Instagram bio', expiresAt: null },
  //   ],
  // },
];

async function main() {
  console.log(`\nAdding ${AFFILIATES.length} affiliate(s)...\n`);

  for (const aff of AFFILIATES) {
    const email = aff.email.toLowerCase();

    // Check if already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`⚠️  ${aff.name} (${email}) already exists — skipping user creation`);

      // Still add any new codes
      for (const c of aff.codes) {
        const codeStr = c.code.toUpperCase();
        const existingCode = await prisma.discountCode.findUnique({ where: { code: codeStr } });
        if (existingCode) {
          console.log(`   ⚠️  Code ${codeStr} already exists — skipping`);
        } else {
          await prisma.discountCode.create({
            data: {
              code: codeStr,
              affiliateId: existing.id,
              discountPercent: c.discountPercent ?? 0.10,
              label: c.label || null,
              expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
            },
          });
          console.log(`   ✅ Code ${codeStr} added`);
        }
      }
      continue;
    }

    // Create affiliate
    const passwordHash = await bcrypt.hash(aff.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: aff.name,
        passwordHash,
        passwordPlain: aff.password,
        role: 'AFFILIATE',
        defaultCommissionRate: aff.commissionRate ?? 0.20,
      },
    });
    console.log(`✅ ${aff.name} created (${email} / ${aff.password})`);

    // Create discount codes
    for (const c of aff.codes) {
      const codeStr = c.code.toUpperCase();
      const existingCode = await prisma.discountCode.findUnique({ where: { code: codeStr } });
      if (existingCode) {
        console.log(`   ⚠️  Code ${codeStr} already exists — skipping`);
        continue;
      }

      await prisma.discountCode.create({
        data: {
          code: codeStr,
          affiliateId: user.id,
          discountPercent: c.discountPercent ?? 0.10,
          commissionRateOverride: null,
          label: c.label || null,
          expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
        },
      });
      console.log(`   ✅ Code ${codeStr} added (${(c.discountPercent ?? 0.10) * 100}% discount)`);
    }
  }

  console.log('\n--- Done! ---\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
