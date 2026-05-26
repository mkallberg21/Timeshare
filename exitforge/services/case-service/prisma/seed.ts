import { PrismaClient, CaseStatus, ExitTrack } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed resort data
  const resorts = [
    {
      id: 'resort_wyndham_bonnet_creek',
      name: 'Wyndham Bonnet Creek',
      developerId: 'wyndham',
      state: 'FL',
      country: 'US',
      deedBackAvailable: true,
      resistanceScore: 0.6,
      receptivityScore: 0.5,
    },
    {
      id: 'resort_marriott_grande_vista',
      name: "Marriott's Grande Vista",
      developerId: 'marriott',
      state: 'FL',
      country: 'US',
      deedBackAvailable: false,
      resistanceScore: 0.75,
      receptivityScore: 0.3,
    },
    {
      id: 'resort_diamond_polo_towers',
      name: 'Diamond Resorts Polo Towers',
      developerId: 'diamond',
      state: 'NV',
      country: 'US',
      deedBackAvailable: true,
      resistanceScore: 0.55,
      receptivityScore: 0.55,
    },
  ];

  for (const resort of resorts) {
    await prisma.resort.upsert({
      where: { id: resort.id },
      update: resort,
      create: resort,
    });
  }

  // Seed a test attorney
  await prisma.attorney.upsert({
    where: { barNumber: 'FL123456' },
    update: {},
    create: {
      name: 'Jane Doe, Esq.',
      barNumber: 'FL123456',
      statesLicensed: ['FL', 'GA', 'SC'],
      specialization: 'Timeshare Law',
      firmName: 'Doe & Associates',
      contactEmail: 'jane.doe@doelaw.example.com',
      active: true,
    },
  });

  console.info('Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
