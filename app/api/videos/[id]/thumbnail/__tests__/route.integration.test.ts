import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => import("../../../../../../tests/setup/next-headers-mock"));

import { prisma } from "@/app/_lib/db";
import { createSession } from "@/app/_lib/auth/session-store";
import { resetJar } from "../../../../../../tests/setup/cookie-jar";

let storageRoot: string;

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

async function signInAs(userId: string) {
  const session = await createSession(userId);
  resetJar({ videomax_session: session.id });
}

async function makeVideo(userId: string, withThumbnail: boolean) {
  const video = await prisma.video.create({
    data: {
      userId,
      title: "t",
      originalFilename: "clip.mp4",
      sizeBytes: BigInt(100),
      containerFormat: "mp4",
      storagePath: path.join(userId, "v", "source.mp4"),
      thumbnailPath: null,
      status: "validating",
    },
  });
  if (withThumbnail) {
    const rel = path.join(userId, video.id, "thumbnail.jpg");
    const abs = path.join(storageRoot, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]));
    await prisma.video.update({ where: { id: video.id }, data: { thumbnailPath: rel } });
  }
  return video;
}

beforeAll(() => {
  storageRoot = mkdtempSync(path.join(tmpdir(), "videomax-thumb-"));
  process.env.VIDEO_STORAGE_ROOT = storageRoot;
});

afterAll(async () => {
  await prisma.$disconnect();
  try {
    rmSync(storageRoot, { recursive: true, force: true });
  } catch {}
});

beforeEach(async () => {
  resetJar();
  await prisma.video.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
});

async function importGet() {
  const mod = await import("@/app/api/videos/[id]/thumbnail/route");
  return mod.GET;
}

function buildRequest(id: string): NextRequest {
  return new NextRequest(new Request(`http://localhost:3000/api/videos/${id}/thumbnail`));
}

describe("GET /api/videos/[id]/thumbnail", () => {
  it("get_streams_thumbnail_jpeg_for_owner", async () => {
    const user = await makeUser("a@example.com");
    await signInAs(user.id);
    const video = await makeVideo(user.id, true);
    const GET = await importGet();
    const res = await GET(buildRequest(video.id), { params: Promise.resolve({ id: video.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });

  it("get_sets_private_cache_control_header", async () => {
    const user = await makeUser("b@example.com");
    await signInAs(user.id);
    const video = await makeVideo(user.id, true);
    const GET = await importGet();
    const res = await GET(buildRequest(video.id), { params: Promise.resolve({ id: video.id }) });
    expect(res.headers.get("cache-control")).toBe("private, max-age=86400");
  });

  it("get_returns_307_to_placeholder_when_thumbnail_path_null", async () => {
    const user = await makeUser("c@example.com");
    await signInAs(user.id);
    const video = await makeVideo(user.id, false);
    const GET = await importGet();
    const res = await GET(buildRequest(video.id), { params: Promise.resolve({ id: video.id }) });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/placeholder-thumbnail.jpg");
  });

  it("get_returns_404_when_video_belongs_to_another_user", async () => {
    const owner = await makeUser("o@example.com");
    const intruder = await makeUser("i@example.com");
    const video = await makeVideo(owner.id, true);
    await signInAs(intruder.id);
    const GET = await importGet();
    const res = await GET(buildRequest(video.id), { params: Promise.resolve({ id: video.id }) });
    expect(res.status).toBe(404);
  });

  it("get_returns_404_when_video_does_not_exist", async () => {
    const user = await makeUser("d@example.com");
    await signInAs(user.id);
    const GET = await importGet();
    const res = await GET(buildRequest("clnonexistent"), {
      params: Promise.resolve({ id: "clnonexistent" }),
    });
    expect(res.status).toBe(404);
  });

  it("get_returns_404_when_unauthenticated", async () => {
    const user = await makeUser("e@example.com");
    const video = await makeVideo(user.id, true);
    const GET = await importGet();
    const res = await GET(buildRequest(video.id), { params: Promise.resolve({ id: video.id }) });
    expect(res.status).toBe(404);
  });
});
