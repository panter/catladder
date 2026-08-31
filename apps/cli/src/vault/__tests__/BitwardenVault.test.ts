import type { Config } from "@catladder/pipeline";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import type { IO } from "../../core/types";
import { BitwardenVault } from "../BitwardenVault";

const { getBwSession, runBw, runBwJson } = vi.hoisted(() => ({
  getBwSession: vi.fn(),
  runBw: vi.fn(),
  runBwJson: vi.fn(),
}));
vi.mock("../bw", () => ({ getBwSession, runBw, runBwJson }));

const io = { log: vi.fn() } as unknown as IO;
const config = { customerName: "pan", appName: "app" } as Config;
const ITEM_NAME = "pan/app/dev/www/secrets.yml";

/** the item the vault would edit, or none at all */
const bwContains = (item?: Record<string, unknown>) =>
  runBwJson.mockImplementation(async (_session: string, args: string[]) =>
    args[1] === "collections"
      ? [{ id: "collection-id", name: "catladder", organizationId: "org-id" }]
      : item
        ? [item]
        : [],
  );

/** the notes of the `bw edit|create item` payload, parsed back */
const writtenNotes = () => {
  const [, args] = runBw.mock.calls[0];
  const payload = JSON.parse(
    Buffer.from(args[args.length - 1], "base64").toString("utf-8"),
  );
  return parse(payload.notes);
};

beforeEach(() => {
  vi.clearAllMocks();
  getBwSession.mockResolvedValue("session");
});

describe("BitwardenVault.writeSecrets", () => {
  it("merges into the existing note instead of replacing it", async () => {
    bwContains({
      id: "item-id",
      name: ITEM_NAME,
      notes: "API_KEY: sesame\nSMTP_PASSWORD: hunter2\n",
    });

    await new BitwardenVault(config, {}, false).writeSecrets(io, "dev", "www", {
      // the shape `project setup` writes: one provisioned credential,
      // nothing else — the other secrets must survive it
      GCLOUD_DEPLOY_credentialsKey: '{"type":"service_account"}',
    });

    expect(runBw.mock.calls[0][1].slice(0, 3)).toEqual([
      "edit",
      "item",
      "item-id",
    ]);
    expect(writtenNotes()).toEqual({
      API_KEY: "sesame",
      SMTP_PASSWORD: "hunter2",
      GCLOUD_DEPLOY_credentialsKey: '{"type":"service_account"}',
    });
  });

  it("overwrites the values it is given", async () => {
    bwContains({ id: "item-id", name: ITEM_NAME, notes: "API_KEY: old\n" });

    await new BitwardenVault(config, {}, false).writeSecrets(io, "dev", "www", {
      API_KEY: "rotated",
    });

    expect(writtenNotes()).toEqual({ API_KEY: "rotated" });
  });

  it("creates the item when the env/component has no note yet", async () => {
    bwContains();

    await new BitwardenVault(config, {}, false).writeSecrets(io, "dev", "www", {
      API_KEY: "sesame",
    });

    expect(runBw.mock.calls[0][1].slice(0, 2)).toEqual(["create", "item"]);
    expect(writtenNotes()).toEqual({ API_KEY: "sesame" });
  });
});
