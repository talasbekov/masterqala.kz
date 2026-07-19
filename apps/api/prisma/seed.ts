import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.category.upsert({
    where: { slug: 'plumbing' },
    create: { slug: 'plumbing', name: 'Сантехника' },
    update: {},
  });
  await prisma.category.upsert({
    where: { slug: 'electrics' },
    create: { slug: 'electrics', name: 'Электрика' },
    update: {},
  });
  await prisma.category.upsert({
    where: { slug: 'appliances' },
    create: { slug: 'appliances', name: 'Бытовая техника' },
    update: {},
  });
  await prisma.category.upsert({
    where: { slug: 'locksmith' },
    create: { slug: 'locksmith', name: 'Замки и двери' },
    update: {},
  });
  await prisma.category.upsert({
    where: { slug: 'handyman' },
    create: { slug: 'handyman', name: 'Мелкий ремонт' },
    update: {},
  });
  await prisma.category.upsert({
    where: { slug: 'other' },
    create: { slug: 'other', name: 'Другие услуги' },
    update: {},
  });
  const operatorPhone = process.env.OPERATOR_PHONE;
  if (operatorPhone) {
    await prisma.user.upsert({
      where: { phone: operatorPhone },
      create: { phone: operatorPhone, role: 'OPERATOR', name: 'Оператор' },
      update: { role: 'OPERATOR' },
    });
  }
  console.log('Seed done');
}

main().finally(() => prisma.$disconnect());
