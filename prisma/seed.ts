import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  defaultChannels,
  defaultIntake,
  defaultWeeklyHours,
} from "../src/lib/domain";

const prisma = new PrismaClient();

async function main() {
  await prisma.practiceSettings.upsert({
    where: { id: "default" },
    update: {
      timezone: "Asia/Kolkata",
      locales: ["en"],
      defaultLocale: "en",
      authPassword: false,
      authOtp: true,
      contentionPolicy: "hide_on_request",
      cancelPolicy: "cutoff_24h",
      reminderOffsets: ["24h", "1h"],
      channels: defaultChannels(),
      hoursMode: "both",
      weeklyHours: defaultWeeklyHours(),
      intake: defaultIntake(),
      completeMode: "optional",
    },
    create: {
      id: "default",
      timezone: "Asia/Kolkata",
      locales: ["en"],
      defaultLocale: "en",
      authPassword: false,
      authOtp: true,
      contentionPolicy: "hide_on_request",
      cancelPolicy: "cutoff_24h",
      reminderOffsets: ["24h", "1h"],
      channels: defaultChannels(),
      hoursMode: "both",
      weeklyHours: defaultWeeklyHours(),
      intake: defaultIntake(),
      completeMode: "optional",
    },
  });

  const types = [
    { name: "Check-up", durationMinutes: 30 },
    { name: "Consultation", durationMinutes: 45 },
  ];
  for (const t of types) {
    const existing = await prisma.appointmentType.findFirst({
      where: { name: t.name },
    });
    if (existing) {
      await prisma.appointmentType.update({
        where: { id: existing.id },
        data: { durationMinutes: t.durationMinutes, active: true },
      });
    } else {
      await prisma.appointmentType.create({ data: t });
    }
  }

  const passwordHash = await bcrypt.hash("practice-dev", 10);
  await prisma.user.upsert({
    where: { email: "dentist@practice.local" },
    update: {
      displayName: "Practice Dentist",
      roles: ["doctor", "admin"],
      disabled: false,
      passwordHash,
    },
    create: {
      email: "dentist@practice.local",
      displayName: "Practice Dentist",
      roles: ["doctor", "admin"],
      passwordHash,
    },
  });

  console.log("Seed complete.");
  console.log("Staff: dentist@practice.local (roles: doctor+admin)");
  console.log("Auth: OTP (devCode returned in development). Password if enabled: practice-dev");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
