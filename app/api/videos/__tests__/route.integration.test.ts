import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => import("../../../../tests/setup/next-headers-mock"));

import { prisma } from "@/app/_lib/db";
import { createSession } from "@/app/_lib/auth/session-store";
import { resetJar } from "../../../../tests/setup/cookie-jar";
import * as probe from "@/app/_lib/videos/probe";

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

async function signInAs(userId: string): Promise<string> {
  const session = await createSession(userId);
  resetJar({ videomax_session: session.id });
  return session.id;
}

function buildRequest(opts: {
  name?: string | null;
  size?: string | null;
  contentLength?: number | null;
  body: Buffer | null;
  contentType?: string;
}): NextRequest {
  const params = new URLSearchParams();
  if (opts.name != null) params.set("name", opts.name);
  if (opts.size != null) params.set("size", opts.size);
  const url = `http://localhost:3000/api/videos${params.toString() ? `?${params}` : ""}`;
  const headers = new Headers();
  headers.set("content-type", opts.contentType ?? "application/octet-stream");
  if (opts.contentLength != null) {
    headers.set("content-length", String(opts.contentLength));
  }
  const init: RequestInit = {
    method: "POST",
    headers,
    body: opts.body ? new Uint8Array(opts.body) : null,
  };
  // @ts-expect-error - duplex required for Node fetch when body is present
  if (opts.body) init.duplex = "half";
  return new NextRequest(new Request(url, init));
}

beforeAll(() => {
  storageRoot = mkdtempSync(path.join(tmpdir(), "videomax-route-"));
  process.env.VIDEO_STORAGE_ROOT = storageRoot;
  process.env.VIDEO_MAX_BYTES = String(10 * 1024 * 1024);
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
  vi.restoreAllMocks();
  vi.spyOn(probe, "probeDuration").mockResolvedValue(null);
  vi.spyOn(probe, "extractThumbnail").mockResolvedValue(false);
});

async function importPost() {
  const mod = await import("@/app/api/videos/route");
  return mod.POST;
}

describe("POST /api/videos", () => {
  it("post_returns_401_when_unauthenticated", async () => {
    const POST = await importPost();
    const body = Buffer.from("x");
    const res = await POST(buildRequest({ name: "a.mp4", size: String(body.length), contentLength: body.length, body }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("UPL_UNAUTHORIZED");
    expect(await prisma.video.count()).toBe(0);
  });

  it("post_returns_201_with_video_dto_on_happy_path", async () => {
    const user = await makeUser("a@example.com");
    await signInAs(user.id);
    const POST = await importPost();
    const body = Buffer.from("hello world");
    const res = await POST(
      buildRequest({ name: "clip.mp4", size: String(body.length), contentLength: body.length, body }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBeTruthy();
    expect(json.status).toBe("validating");
    expect(json.sizeBytes).toBe(body.length);
    expect(json.thumbnailUrl).toBe(`/api/videos/${json.id}/thumbnail`);
  });

  it("post_returns_400_UPL_MISSING_NAME_when_name_query_absent", async () => {
    const user = await makeUser("b@example.com");
    await signInAs(user.id);
    const POST = await importPost();
    const body = Buffer.from("x");
    const res = await POST(buildRequest({ name: null, size: String(body.length), contentLength: body.length, body }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("UPL_MISSING_NAME");
  });

  it("post_returns_400_UPL_BAD_EXTENSION_for_mpg", async () => {
    const user = await makeUser("c@example.com");
    await signInAs(user.id);
    const POST = await importPost();
    const body = Buffer.from("x");
    const res = await POST(
      buildRequest({ name: "video.mpg", size: String(body.length), contentLength: body.length, body }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("UPL_BAD_EXTENSION");
  });

  it("post_returns_413_UPL_TOO_LARGE_when_declared_size_exceeds_limit", async () => {
    const user = await makeUser("d@example.com");
    await signInAs(user.id);
    const POST = await importPost();
    const body = Buffer.from("x");
    const oversized = 11 * 1024 * 1024;
    const res = await POST(
      buildRequest({ name: "big.mp4", size: String(oversized), contentLength: body.length, body }),
    );
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("UPL_TOO_LARGE");
  });

  it("post_returns_400_UPL_SIZE_MISMATCH_when_declared_and_content_length_differ", async () => {
    const user = await makeUser("e@example.com");
    await signInAs(user.id);
    const POST = await importPost();
    const body = Buffer.from("abcdef");
    const res = await POST(
      buildRequest({ name: "a.mp4", size: "99", contentLength: body.length, body }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("UPL_SIZE_MISMATCH");
  });

  it("post_appears_in_library_query_immediately", async () => {
    const user = await makeUser("f@example.com");
    await signInAs(user.id);
    const POST = await importPost();
    const body = Buffer.from("hello");
    const res = await POST(
      buildRequest({ name: "clip.mp4", size: String(body.length), contentLength: body.length, body }),
    );
    expect(res.status).toBe(201);
    const rows = await prisma.video.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("validating");
  });
});
