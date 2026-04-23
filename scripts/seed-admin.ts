import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/app/_lib/password";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@videomax.local";
  const name = process.env.ADMIN_NAME ?? "Admin";
  const password = process.env.ADMIN_PASSWORD ?? "admin1234";

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, isAdmin: true, isSuspended: false, name },
    create: { email, name, passwordHash, isAdmin: true },
    select: { id: true, email: true, name: true, isAdmin: true },
  });

  console.log("Admin ready:", user);
  console.log(`Password: ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
