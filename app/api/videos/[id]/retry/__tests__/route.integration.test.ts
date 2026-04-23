import {
  afterAll,
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

async function makeUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      name: "Ada",
      passwordHash:
        "$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  });
}

async function makeVideo(userId: string, status: string) {
  return prisma.video.create({
    data: {
      userId,
      title: "T",
      originalFilename: "x.mp4",
      sizeBytes: BigInt(1),
      containerFormat: "mp4",
      storagePath: `${userId}/v/source.mp4`,
      status,
    },
  });
}

async function signInAs(userId: string): Promise<string> {
  const session = await createSession(userId);
  resetJar({ videomax_session: session.id });
  return session.id;
}

async function importPost() {
  const mod = await import("@/app/api/videos/[id]/retry/route");
  return mod.POST;
}

function buildRequest(id: string): Request {
  return new Request(`http://localhost:3000/api/videos/${id}/retry`, {
    method: "POST",
  });
}

beforeEach(async () => {
  resetJar();
  await prisma.videoEvent.deleteMany({});
  await prisma.videoJob.deleteMany({});
  await prisma.video.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/videos/:id/retry", () => {
  it("retry_401_when_unauthenticated", async () => {
    const user = await makeUser("u@example.com");
    const video = await makeVideo(user.id, "failed");
    const POST = await importPost();
    const res = await POST(buildRequest(video.id), {
      params: Promise.resolve({ id: video.id }),
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("RETRY_UNAUTHORIZED");
  });

  it("retry_404_when_video_not_owned", async () => {
    const a = await makeUser("a@example.com");
    const b = await makeUser("b@example.com");
    const video = await makeVideo(b.id, "failed");
    await signInAs(a.id);
    const POST = await importPost();
    const res = await POST(buildRequest(video.id), {
      params: Promise.resolve({ id: video.id }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("RETRY_NOT_FOUND");
  });

  it("retry_409_when_video_not_failed", async () => {
    const user = await makeUser("c@example.com");
    const video = await makeVideo(user.id, "transcribing");
    await signInAs(user.id);
    const POST = await importPost();
    const res = await POST(buildRequest(video.id), {
      params: Promise.resolve({ id: video.id }),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("RETRY_INVALID_STATE");
  });

  it("retry_200_on_failed_video_re_enters_original_failed_stage", async () => {
    const user = await makeUser("d@example.com");
    const video = await makeVideo(user.id, "failed");
    await prisma.videoJob.create({
      data: {
        videoId: video.id,
        stage: "transcribe",
        attempt: 3,
        failedAt: new Date(),
        lastErrorCode: "PIPE_TRANSCRIBE_API",
      },
    });
    await signInAs(user.id);
    const POST = await importPost();
    const res = await POST(buildRequest(video.id), {
      params: Promise.resolve({ id: video.id }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("transcribing");
    expect(json.stage).toBe("transcribe");
    expect(json.attempt).toBe(0);

    const job = await prisma.videoJob.findUniqueOrThrow({
      where: { videoId: video.id },
    });
    expect(job.attempt).toBe(0);
    expect(job.failedAt).toBeNull();
    expect(job.lastErrorCode).toBeNull();
    const after = await prisma.video.findUniqueOrThrow({ where: { id: video.id } });
    expect(after.status).toBe("transcribing");
    const events = await prisma.videoEvent.findMany({ where: { videoId: video.id } });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].fromStatus).toBe("failed");
    expect(events[0].toStatus).toBe("transcribing");
  });
});
