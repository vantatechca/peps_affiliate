import prisma from './lib/prisma';
import bcrypt from 'bcryptjs';

const AFFILIATES = [
  {
    name: 'Jesse Esau',
    email: 'jesse@affiliate.com',
    password: 'jesse_peps',
    commissionRate: 0.20,
    codes: [{ code: 'JES', discountPercent: 0.10, label: 'TikTok' }],
  },
  {
    name: 'Diego Stevenson',
    email: 'diego@affiliate.com',
    password: 'diego_peps',
    commissionRate: 0.20,
    codes: [{ code: 'DGO', discountPercent: 0.10, label: 'TikTok' }],
  },
  {
    name: 'Ethan Busse',
    email: 'ethan@affiliate.com',
    password: 'ethan_peps',
    commissionRate: 0.20,
    codes: [{ code: 'BUS', discountPercent: 0.10, label: 'TikTok' }],
  },
  {
    name: 'Hassan Idri',
    email: 'hassan@affiliate.com',
    password: 'hassan_peps',
    commissionRate: 0.20,
    codes: [{ code: 'HAS', discountPercent: 0.10, label: 'TikTok' }],
  },
  {
    name: 'Luis Flores',
    email: 'luis@affiliate.com',
    password: 'luis_peps',
    commissionRate: 0.20,
    codes: [{ code: 'FLO', discountPercent: 0.10, label: 'TikTok' }],
  },
  {
    name: 'Maxime Poline',
    email: 'maxime@affiliate.com',
    password: 'maxime_peps',
    commissionRate: 0.20,
    codes: [{ code: 'MAX', discountPercent: 0.10, label: 'TikTok' }],
  },
  {
    name: 'Tyler Motoyama',
    email: 'tylerm@affiliate.com',
    password: 'tylerm_peps',
    commissionRate: 0.20,
    codes: [{ code: 'MOT', discountPercent: 0.10, label: 'TikTok' }],
  },
  {
    name: 'Taline (Jesse GF)',
    email: 'taline@affiliate.com',
    password: 'taline_peps',
    commissionRate: 0.20,
    codes: [{ code: 'TAL', discountPercent: 0.10, label: 'TikTok' }],
  },
  {
    name: 'Angel Alas',
    email: 'angel@affiliate.com',
    password: 'angel_peps',
    commissionRate: 0.20,
    codes: [{ code: 'AGA', discountPercent: 0.10, label: 'TikTok' }],
  },
  {
    name: 'Vincent Salvo',
    email: 'vincent@affiliate.com',
    password: 'vincent_peps',
    commissionRate: 0.20,
    codes: [{ code: 'VINCENT10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Tyler Pitman',
    email: 'tylerp@affiliate.com',
    password: 'tylerp_peps',
    commissionRate: 0.20,
    codes: [{ code: 'TYLER10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Evan Bosma',
    email: 'evan@affiliate.com',
    password: 'evan_peps',
    commissionRate: 0.20,
    codes: [{ code: 'EVAN10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Luke',
    email: 'luke@affiliate.com',
    password: 'luke_peps',
    commissionRate: 0.20,
    codes: [{ code: 'LUKE10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Vika Moore',
    email: 'vika@affiliate.com',
    password: 'vika_peps',
    commissionRate: 0.20,
    codes: [{ code: 'VIKA10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Zack Pfeiffer',
    email: 'zack@affiliate.com',
    password: 'zack_peps',
    commissionRate: 0.20,
    codes: [{ code: 'ZACK10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Derek Imsande',
    email: 'derek@affiliate.com',
    password: 'derek_peps',
    commissionRate: 0.20,
    codes: [{ code: 'DEREK10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Ryan Nelson',
    email: 'ryan@affiliate.com',
    password: 'ryan_peps',
    commissionRate: 0.20,
    codes: [{ code: 'RYAN10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Dom Dehmer',
    email: 'dom@affiliate.com',
    password: 'dom_peps',
    commissionRate: 0.20,
    codes: [{ code: 'DOM10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Elizabeth Mulkey',
    email: 'elizabeth@affiliate.com',
    password: 'elizabeth_peps',
    commissionRate: 0.20,
    codes: [{ code: 'LIZZ10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Aaron Kanner',
    email: 'aaron@affiliate.com',
    password: 'aaron_peps',
    commissionRate: 0.20,
    codes: [{ code: 'AARON10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Bryson Harris',
    email: 'bryson@affiliate.com',
    password: 'bryson_peps',
    commissionRate: 0.20,
    codes: [{ code: 'BRYSON10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Nasif Hassan',
    email: 'nasif@affiliate.com',
    password: 'nasif_peps',
    commissionRate: 0.20,
    codes: [{ code: 'NATTYNAS', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Isabella Renaldi',
    email: 'isabella@affiliate.com',
    password: 'isabella_peps',
    commissionRate: 0.20,
    codes: [{ code: 'ISA10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Yuri',
    email: 'yuri@affiliate.com',
    password: 'yuri_peps',
    commissionRate: 0.20,
    codes: [{ code: 'YURI10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Karter',
    email: 'karter@affiliate.com',
    password: 'karter_peps',
    commissionRate: 0.20,
    codes: [{ code: 'KARTER10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Spina',
    email: 'spina@affiliate.com',
    password: 'spina_peps',
    commissionRate: 0.20,
    codes: [{ code: 'SPINA10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Cole',
    email: 'cole@affiliate.com',
    password: 'cole_peps',
    commissionRate: 0.20,
    codes: [{ code: 'COLE10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'JD',
    email: 'jd@affiliate.com',
    password: 'jd_peps',
    commissionRate: 0.20,
    codes: [{ code: 'JD', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Ada Peschanskiy',
    email: 'ada@affiliate.com',
    password: 'ada_peps',
    commissionRate: 0.20,
    codes: [{ code: 'ADA10', discountPercent: 0.10, label: null }],
  },
  {
    name: 'SK',
    email: 'sk@affiliate.com',
    password: 'sk_peps',
    commissionRate: 0.20,
    codes: [{ code: 'SK', discountPercent: 0.10, label: null }],
  },
  {
    name: 'Eli',
    email: 'eli@affiliate.com',
    password: 'eli_peps',
    commissionRate: 0.20,
    codes: [{ code: 'ELI', discountPercent: 0.10, label: null }],
  },
  {
    name: 'TJ',
    email: 'tj@affiliate.com',
    password: 'tj_peps',
    commissionRate: 0.20,
    codes: [{ code: 'TJWIN', discountPercent: 0.10, label: null }],
  }
];

async function main() {
  console.log(`\nAdding ${AFFILIATES.length} affiliate(s)...\n`);

  for (const aff of AFFILIATES) {
    const email = aff.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`⚠️  ${aff.name} (${email}) already exists — skipping user creation`);
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
              expiresAt: null,
            },
          });
          console.log(`   ✅ Code ${codeStr} added`);
        }
      }
      continue;
    }

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
    console.log(`✅ ${aff.name} — ${email} / ${aff.password}`);

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
          label: c.label || null,
          expiresAt: null,
        },
      });
      console.log(`   ✅ Code ${codeStr}`);
    }
  }

  console.log('\n--- Done! ---\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());