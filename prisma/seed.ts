import { PrismaClient, AccountType, CategoryType, CommitmentStatus, RecurrenceFrequency } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial system categories and demo data...');

  // 1. System Default Categories
  const systemCategories = [
    // Expense categories
    { name: 'Groceries / بقالة ومستلزمات', type: CategoryType.EXPENSE, icon: 'cart-outline' },
    { name: 'Rent / إيجار', type: CategoryType.EXPENSE, icon: 'home-outline' },
    { name: 'Utilities / كهرباء وغاز ومياه', type: CategoryType.EXPENSE, icon: 'flash-outline' },
    { name: 'Internet & Mobile / إنترنت وموبايل', type: CategoryType.EXPENSE, icon: 'wifi-outline' },
    { name: 'Installments / أقساط وقروض', type: CategoryType.EXPENSE, icon: 'card-outline' },
    { name: 'Dining & Cafes / مطاعم وكافيهات', type: CategoryType.EXPENSE, icon: 'restaurant-outline' },
    { name: 'Transportation / مواصلات وبنزين', type: CategoryType.EXPENSE, icon: 'car-outline' },
    { name: 'Healthcare / صحة وصيدلية', type: CategoryType.EXPENSE, icon: 'medkit-outline' },
    { name: 'Entertainment / ترفيه وخروجات', type: CategoryType.EXPENSE, icon: 'film-outline' },
    { name: 'Other Expenses / مصاريف أخرى', type: CategoryType.EXPENSE, icon: 'ellipsis-horizontal-outline' },

    // Income categories
    { name: 'Salary / مرتب شهري', type: CategoryType.INCOME, icon: 'cash-outline' },
    { name: 'Freelance & Extra / عمل حر ودخل إضافي', type: CategoryType.INCOME, icon: 'briefcase-outline' },
    { name: 'Investments / أرباح استثمار', type: CategoryType.INCOME, icon: 'trending-up-outline' },
    { name: 'Gifts & Transfers / تحويل وهدية', type: CategoryType.INCOME, icon: 'gift-outline' },
    { name: 'Other Income / دخل آخر', type: CategoryType.INCOME, icon: 'wallet-outline' },
  ];

  for (const cat of systemCategories) {
    const existing = await prisma.category.findFirst({
      where: { name: cat.name, userId: null },
    });
    if (!existing) {
      await prisma.category.create({
        data: {
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          userId: null, // System category
        },
      });
    }
  }

  // 2. Demo User for Development
  const demoEmail = 'demo@flowsy.app';
  let demoUser = await prisma.user.findUnique({ where: { email: demoEmail } });

  if (!demoUser) {
    const passwordHash = await argon2.hash('Password123!');
    demoUser = await prisma.user.create({
      data: {
        email: demoEmail,
        passwordHash,
        displayName: 'زياد أيمن',
        currency: 'EGP',
        timezone: 'Africa/Cairo',
      },
    });

    console.log(`Created demo user: ${demoEmail}`);

    // Create default accounts for demo user
    const cashAccount = await prisma.financialAccount.create({
      data: {
        userId: demoUser.id,
        name: 'كاش / Cash',
        type: AccountType.CASH,
        currency: 'EGP',
        initialBalance: 2500.00,
        currentBalance: 2500.00,
      },
    });

    const bankAccount = await prisma.financialAccount.create({
      data: {
        userId: demoUser.id,
        name: 'البنك الأهلي المصري / NBE',
        type: AccountType.BANK,
        currency: 'EGP',
        initialBalance: 18500.00,
        currentBalance: 18500.00,
      },
    });

    const walletAccount = await prisma.financialAccount.create({
      data: {
        userId: demoUser.id,
        name: 'فودافون كاش / Vodafone Cash',
        type: AccountType.MOBILE_WALLET,
        currency: 'EGP',
        initialBalance: 1200.00,
        currentBalance: 1200.00,
      },
    });

    // Create upcoming commitments for demo user
    const rentCategory = await prisma.category.findFirst({
      where: { name: { contains: 'Rent' } },
    });

    const internetCategory = await prisma.category.findFirst({
      where: { name: { contains: 'Internet' } },
    });

    const endOfMonth = new Date();
    endOfMonth.setDate(28);

    await prisma.commitment.create({
      data: {
        userId: demoUser.id,
        name: 'إيجار الشقة',
        amount: 6000.00,
        currency: 'EGP',
        dueDate: endOfMonth,
        status: CommitmentStatus.PENDING,
        recurrence: RecurrenceFrequency.MONTHLY,
        accountId: bankAccount.id,
        categoryId: rentCategory?.id,
      },
    });

    const midMonth = new Date();
    midMonth.setDate(20);

    await prisma.commitment.create({
      data: {
        userId: demoUser.id,
        name: 'فاتورة الإنترنت المنزلي (WE)',
        amount: 450.00,
        currency: 'EGP',
        dueDate: midMonth,
        status: CommitmentStatus.PENDING,
        recurrence: RecurrenceFrequency.MONTHLY,
        accountId: walletAccount.id,
        categoryId: internetCategory?.id,
      },
    });

    console.log('Demo user financial accounts and commitments seeded successfully.');
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
