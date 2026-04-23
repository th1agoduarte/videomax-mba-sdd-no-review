import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("next/headers", () => import("../../../../../../tests/setup/next-headers-mock"));

import { prisma } from "@/app/_lib/db";
import { createSession } from "@/app/_lib/auth/session-store";
import { resetJar } from "../../../../../../tests/setup/cookie-jar";
import { stopListener } from "@/app/_lib/pipeline/events";

async function makeUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: "U",
      passwordHash:
        "$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  });
}

async function makeVideo(userId: string) {
  return prisma.video.create({
    data: {
      userId,
      title: "T",
      originalFilename: "x.mp4",
      sizeBytes: BigInt(1),
      containerFormat: "mp4",
      storagePath: `${userId}/v/source.mp4`,
      status: "validating",
    },
  });
}

async function signInAs(userId: string): Promise<string> {
  const session = await createSession(userId);
  resetJar({ videomax_session: session.id });
  return session.id;
}

async function importGet() {
  const mod = await import("@/app/api/videos/[id]/events/route");
  return mod.GET;
}

beforeEach(async () => {
  resetJar();
  await prisma.videoEvent.deleteMany({});
  await prisma.video.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
});

afterEach(async () => {
  await stopListener();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/videos/:id/events", () => {
  it("sse_404_when_unauthenticated", async () => {
    const user = await makeUser("a@example.com");
    const video = await makeVideo(user.id);
    const GET = await importGet();
    const req = new Request(`http://localhost:3000/api/videos/${video.id}/events`);
    const res = await GET(req, { params: Promise.resolve({ id: video.id }) });
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("EVENTS_NOT_FOUND");
  });

  it("sse_404_for_non_owner", async () => {
    const a = await makeUser("owner@example.com");
    const b = await makeUser("other@example.com");
    const video = await makeVideo(a.id);
    await signInAs(b.id);
    const GET = await importGet();
    const req = new Request(`http://localhost:3000/api/videos/${video.id}/events`);
    const res = await GET(req, { params: Promise.resolve({ id: video.id }) });
    expect(res.status).toBe(404);
  });

  it("sse_streams_status_transition", async () => {
    const user = await makeUser("sse@example.com");
    const video = await makeVideo(user.id);
    await signInAs(user.id);
    const GET = await importGet();

    const controller = new AbortController();
    const req = new Request(
      `http://localhost:3000/api/videos/${video.id}/events`,
      { signal: controller.signal },
    );
    const res = await GET(req, { params: Promise.resolve({ id: video.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    // Let the listener settle, then publish an event.
    setTimeout(async () => {
      await prisma.videoEvent.create({
        data: {
          videoId: video.id,
          userId: user.id,
          fromStatus: "validating",
          toStatus: "transcribing",
          stage: "transcribe",
          attempt: 1,
        },
      });
    }, 200);

    const deadline = Date.now() + 5000;
    let accumulated = "";
    let gotEvent = false;
    while (Date.now() < deadline && !gotEvent) {
      const { value, done } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      if (accumulated.includes("event: status")) {
        gotEvent = true;
        break;
      }
    }
    expect(gotEvent).toBe(true);
    expect(accumulated).toContain(video.id);
    controller.abort();
    await reader.cancel().catch(() => undefined);
  });
});
