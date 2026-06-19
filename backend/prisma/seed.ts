import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Seed bloqueado en producción');
    return;
  }

  const passwordHash = await bcrypt.hash('Admin1234!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'admin@financial.dev' },
    update: {},
    create: { email: 'admin@financial.dev', passwordHash },
  });

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: 'Alimentación' } },
      update: {},
      create: { name: 'Alimentación', userId: user.id },
    }),
    prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: 'Transporte' } },
      update: {},
      create: { name: 'Transporte', userId: user.id },
    }),
    prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: 'Salario' } },
      update: {},
      create: { name: 'Salario', userId: user.id },
    }),
  ]);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  await prisma.budget.upsert({
    where: { categoryId_month_year: { categoryId: categories[0].id, month, year } },
    update: {},
    create: { categoryId: categories[0].id, userId: user.id, amount: 500000, month, year },
  });

  await prisma.budget.upsert({
    where: { categoryId_month_year: { categoryId: categories[1].id, month, year } },
    update: {},
    create: { categoryId: categories[1].id, userId: user.id, amount: 200000, month, year },
  });

  console.log('Seed completado. Usuario:', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
