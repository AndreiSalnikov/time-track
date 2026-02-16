import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  BillingType,
  FixedAllocation,
  PaymentStatus,
  PrismaClient,
} from "@prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  await prisma.favoriteTag.deleteMany();
  await prisma.timeEntryTag.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.timeEntry.deleteMany();

  await prisma.settings.upsert({
    where: { id: "app-settings" },
    update: {
      baseCurrency: "RUB",
      displayCurrency: "RUB",
      moneyPrecision: 2,
    },
    create: {
      id: "app-settings",
      baseCurrency: "RUB",
      displayCurrency: "RUB",
      moneyPrecision: 2,
    },
  });

  const maxClient = await prisma.client.upsert({
    where: { name: "Max" },
    update: { defaultCurrency: "RUB" },
    create: { name: "Max", defaultCurrency: "RUB" },
  });

  const olegClient = await prisma.client.upsert({
    where: { name: "Oleg nc" },
    update: { defaultCurrency: "RUB" },
    create: { name: "Oleg nc", defaultCurrency: "RUB" },
  });

  const maxHourly = await prisma.project.upsert({
    where: {
      clientId_name: {
        clientId: maxClient.id,
        name: "Max / hourly",
      },
    },
    update: {
      billingType: BillingType.HOURLY,
      currency: "RUB",
      hourlyRate: 2000,
      fixedAmount: null,
      fixedAllocation: FixedAllocation.NONE,
    },
    create: {
      clientId: maxClient.id,
      name: "Max / hourly",
      billingType: BillingType.HOURLY,
      currency: "RUB",
      hourlyRate: 2000,
      fixedAllocation: FixedAllocation.NONE,
    },
  });

  const maxFixed = await prisma.project.upsert({
    where: {
      clientId_name: {
        clientId: maxClient.id,
        name: "Max / fixed",
      },
    },
    update: {
      billingType: BillingType.FIXED,
      currency: "RUB",
      fixedAmount: 100000,
      fixedAllocation: FixedAllocation.NONE,
      hourlyRate: null,
    },
    create: {
      clientId: maxClient.id,
      name: "Max / fixed",
      billingType: BillingType.FIXED,
      currency: "RUB",
      fixedAmount: 100000,
      fixedAllocation: FixedAllocation.NONE,
    },
  });

  const olegCrm = await prisma.project.upsert({
    where: {
      clientId_name: {
        clientId: olegClient.id,
        name: "Oleg / crm",
      },
    },
    update: {
      billingType: BillingType.HOURLY,
      currency: "RUB",
      hourlyRate: 1800,
      fixedAmount: null,
      fixedAllocation: FixedAllocation.NONE,
    },
    create: {
      clientId: olegClient.id,
      name: "Oleg / crm",
      billingType: BillingType.HOURLY,
      currency: "RUB",
      hourlyRate: 1800,
      fixedAllocation: FixedAllocation.NONE,
    },
  });

  const olegInfra = await prisma.project.upsert({
    where: {
      clientId_name: {
        clientId: olegClient.id,
        name: "Oleg / infra",
      },
    },
    update: {
      billingType: BillingType.HOURLY,
      currency: "RUB",
      hourlyRate: 2200,
      fixedAmount: null,
      fixedAllocation: FixedAllocation.NONE,
    },
    create: {
      clientId: olegClient.id,
      name: "Oleg / infra",
      billingType: BillingType.HOURLY,
      currency: "RUB",
      hourlyRate: 2200,
      fixedAllocation: FixedAllocation.NONE,
    },
  });

  const tags = Object.fromEntries(
    await Promise.all(
      ["crm", "infra", "bug", "meeting", "support"].map(async (name) => {
        const tag = await prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        return [name, tag] as const;
      }),
    ),
  );

  const projects = [maxHourly, maxFixed, olegCrm, olegInfra];
  const descriptions = [
    "Fix bug #12",
    "CRM sync",
    "Meeting",
    "Infra maintenance",
    "Support follow-up",
    "Feature review",
    "Client update call",
    "Deploy patch",
  ];
  const tagSets = [
    ["bug"],
    ["crm"],
    ["meeting"],
    ["infra"],
    ["support"],
    ["crm", "bug"],
    ["meeting", "support"],
    ["infra", "bug"],
    [],
  ];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0, 0, 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 20, 0, 0, 0);
  const monthDays = monthEnd.getDate();

  for (let i = 0; i < 20; i += 1) {
    const project = projects[i % projects.length];
    const day = ((i * 2) % monthDays) + 1;
    const startHour = 9 + (i % 8);
    const startMinute = [0, 10, 15, 20, 30, 40, 45, 50][i % 8];

    const startAt = new Date(
      now.getFullYear(),
      now.getMonth(),
      day,
      startHour,
      startMinute,
      0,
      0,
    );

    if (startAt < monthStart || startAt > monthEnd) {
      continue;
    }

    const durationMin = randomInt(15, 180);
    const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);
    const paymentStatus = i % 3 === 0 ? PaymentStatus.PAID : PaymentStatus.UNPAID;

    const timeEntry = await prisma.timeEntry.create({
      data: {
        projectId: project.id,
        description: descriptions[i % descriptions.length],
        startAt,
        endAt,
        durationSec: Math.floor((endAt.getTime() - startAt.getTime()) / 1000),
        isRunning: false,
        paymentStatus,
        paidAt: paymentStatus === PaymentStatus.PAID ? endAt : null,
      },
    });

    const selectedTags = tagSets[i % tagSets.length];

    if (selectedTags.length > 0) {
      for (const tagName of selectedTags) {
        await prisma.timeEntryTag.create({
          data: {
            timeEntryId: timeEntry.id,
            tagId: tags[tagName].id,
          },
        });
      }
    }
  }

  const favorites = [
    {
      projectId: maxHourly.id,
      name: "Bugfix quickstart",
      descriptionTemplate: "Fix bug #{{id}}",
      tagNames: ["bug", "crm"],
    },
    {
      projectId: olegCrm.id,
      name: "CRM daily sync",
      descriptionTemplate: "CRM sync and checks",
      tagNames: ["crm", "support"],
    },
    {
      projectId: olegInfra.id,
      name: "Infra maintenance window",
      descriptionTemplate: "Infra maintenance",
      tagNames: ["infra"],
    },
  ];

  for (const favoriteData of favorites) {
    const favorite = await prisma.favorite.upsert({
      where: {
        projectId_name: {
          projectId: favoriteData.projectId,
          name: favoriteData.name,
        },
      },
      update: {
        descriptionTemplate: favoriteData.descriptionTemplate,
        defaultBillable: true,
      },
      create: {
        projectId: favoriteData.projectId,
        name: favoriteData.name,
        descriptionTemplate: favoriteData.descriptionTemplate,
        defaultBillable: true,
      },
    });

    for (const tagName of favoriteData.tagNames) {
      await prisma.favoriteTag.create({
        data: {
          favoriteId: favorite.id,
          tagId: tags[tagName].id,
        },
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
