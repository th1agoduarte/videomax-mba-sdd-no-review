import { execSync } from "node:child_process";
import path from "node:path";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

let container: StartedPostgreSqlContainer | undefined;

export async function setup() {
  if (process.env.USE_LOCAL_POSTGRES === "1" && process.env.DATABASE_URL) {
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET ?? "test-session-secret-at-least-32-bytes-long";
    execSync("npx prisma migrate deploy", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      cwd: path.resolve(__dirname, "../.."),
    });
    return;
  }

  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("videomax_test")
    .withUsername("videomax")
    .withPassword("videomax")
    .start();

  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;
  process.env.SESSION_SECRET =
    process.env.SESSION_SECRET ?? "test-session-secret-at-least-32-bytes-long";

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
    cwd: path.resolve(__dirname, "../.."),
  });
}

export async function teardown() {
  if (container) {
    await container.stop();
    container = undefined;
  }
}
