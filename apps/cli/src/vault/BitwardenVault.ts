import { getSecretVarName } from "@catladder/pipeline";
import type { Config } from "@catladder/pipeline";
import { parse, stringify } from "yaml";
import type { IO } from "../core/types";
import { getBwSession, runBw, runBwJson } from "./bw";
import type { SecretsVault } from "./types";

const DEFAULT_COLLECTION = "catladder";

const SECURE_NOTE_TYPE = 2;

type BwCollection = { id: string; name: string; organizationId?: string };
type BwItem = {
  id: string;
  name: string;
  notes?: string | null;
  organizationId?: string | null;
  collectionIds?: string[];
};

/**
 * one yaml note per env and component:
 * `<customerName>/<appName>/<env>/<componentName>/secrets.yml`
 */
const itemName = (config: Config, env: string, componentName: string): string =>
  `${config.customerName}/${config.appName}/${env}/${componentName}/secrets.yml`;

const itemPrefix = (config: Config) =>
  `${config.customerName}/${config.appName}/`;

/**
 * parses env and componentName back out of an item name
 */
const parseItemName = (config: Config, name: string) => {
  const match = name
    .slice(itemPrefix(config).length)
    .match(/^([^/]+)\/([^/]+)\/secrets\.yml$/);
  return match ? { env: match[1], componentName: match[2] } : null;
};

const findCollection = async (
  session: string,
  collectionName: string,
): Promise<BwCollection> => {
  const collections = await runBwJson<BwCollection[]>(session, [
    "list",
    "collections",
    "--search",
    collectionName,
  ]);
  const collection = collections.find((c) => c.name === collectionName);
  if (!collection) {
    throw new Error(
      `bitwarden collection '${collectionName}' not found — create it and make sure you have access`,
    );
  }
  return collection;
};

const encodePayload = (payload: unknown) =>
  Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");

export class BitwardenVault implements SecretsVault {
  readonly id: string;

  private readonly collectionName: string;

  constructor(
    private readonly config: Config,
    options: { collection?: string },
    /**
     * whether a locked bitwarden may be unlocked interactively
     * (false with catenv --vault-mode no-prompt)
     */
    private readonly allowPrompt: boolean,
  ) {
    this.collectionName = options.collection ?? DEFAULT_COLLECTION;
    this.id = `bitwarden:${this.collectionName}`;
  }

  private session(io: IO | null) {
    return getBwSession(io, { allowPrompt: this.allowPrompt });
  }

  async readAllSecrets(io: IO | null): Promise<Record<string, string>> {
    const { config, collectionName } = this;
    const bwSession = await this.session(io);
    const collection = await findCollection(bwSession, collectionName);
    const items = await runBwJson<BwItem[]>(bwSession, [
      "list",
      "items",
      "--collectionid",
      collection.id,
    ]);

    const secrets: Record<string, string> = {};
    for (const item of items) {
      const parsed = parseItemName(config, item.name);
      if (!parsed || !item.notes) {
        continue;
      }
      const values = parse(item.notes) as Record<string, unknown> | null;
      Object.entries(values ?? {}).forEach(([key, value]) => {
        secrets[getSecretVarName(parsed.env, parsed.componentName, key)] =
          typeof value === "string" ? value : JSON.stringify(value);
      });
    }
    return secrets;
  }

  async writeSecrets(
    io: IO,
    env: string,
    componentName: string,
    secrets: Record<string, unknown>,
  ): Promise<void> {
    const { config, collectionName } = this;
    const bwSession = await this.session(io);
    const collection = await findCollection(bwSession, collectionName);
    const name = itemName(config, env, componentName);

    const existing = (
      await runBwJson<BwItem[]>(bwSession, [
        "list",
        "items",
        "--collectionid",
        collection.id,
        "--search",
        name,
      ])
    ).find((item) => item.name === name);

    const notes = stringify(secrets);

    if (existing) {
      await runBw(bwSession, [
        "edit",
        "item",
        existing.id,
        encodePayload({ ...existing, notes }),
      ]);
    } else {
      await runBw(bwSession, [
        "create",
        "item",
        encodePayload({
          type: SECURE_NOTE_TYPE,
          secureNote: { type: 0 },
          name,
          notes,
          ...(collection.organizationId
            ? {
                organizationId: collection.organizationId,
                collectionIds: [collection.id],
              }
            : {}),
        }),
      ]);
    }
  }
}
