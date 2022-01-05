import { exec, spawn } from "child-process-promise";
import commandExists from "command-exists-promise";
import dayjs from "dayjs";

import { readFile, writeFile } from "fs-extra";
import yaml from "js-yaml";
import { withFile } from "tmp-promise";
import formatEnvVars from "../formatEnvVars";
import getEditor from "../getEditor";
import { getPreference, hasPreference, setPreference } from "../preferences";

const DEBUG = false;

const unlockBitwarden = async () => {
  console.error("");
  console.error("# Bitwarden is locked, please unlock:");
  console.error("");
  const promise = spawn("bw", ["unlock", "--raw"], {
    stdio: ["inherit", "pipe", "inherit"],
  });
  let session = null;
  promise.childProcess.stdout.on(
    "data",
    (d: any) => (session = d.toString("utf-8"))
  );
  await promise;
  await setPreference("bwsession", session);
};
const loginBitwarden = async () => {
  console.error("");
  console.error("# Please login to Bitwarden:");
  console.error("");
  const promise = spawn("bw", ["login", "--raw"], {
    stdio: ["inherit", "pipe", "inherit"],
  });
  let session = null;
  promise.childProcess.stdout.on(
    "data",
    (d: any) => (session = d.toString("utf-8"))
  );
  await promise;
  await setPreference("bwsession", session);
  await syncBitwarden(true); // needs syncing to work properly afterwards
};

const execBitwardenCommand = async (command: string): Promise<any> => {
  if (!(await hasPreference("bwsession"))) {
    await loginBitwarden();
  }
  const session = await getPreference("bwsession");
  const fullCommand = `BW_SESSION='${session}' bw ${command} --raw --nointeraction`;
  if (DEBUG) {
    console.log(fullCommand);
    console.time(fullCommand);
  }
  try {
    const { stdout } = await exec(fullCommand);
    if (DEBUG) {
      console.timeEnd(fullCommand);
    }

    if (!stdout) {
      return null;
    }
    try {
      return JSON.parse(stdout);
    } catch (e) {
      // no json
      return stdout;
    }
  } catch (e) {
    const isLocked = e.toString().includes("Vault is locked");
    const notLoggedIn = e.toString().includes("You are not logged in");
    if (isLocked) {
      await unlockBitwarden();
      return execBitwardenCommand(command);
    } else if (notLoggedIn) {
      await loginBitwarden();
      return execBitwardenCommand(command);
    } else {
      console.error(e);

      console.log("wooops", e.message);
    }
  }
};

export const getCollection = async (collectionName: string) => {
  return execBitwardenCommand(`get collection ${collectionName}`);
};

export const getOrganization = async (organizationName: string) => {
  return execBitwardenCommand(`get organization ${organizationName}`);
};

let catladderCollectionId: string;

const getCatladderCollectionId = async () => {
  if (!catladderCollectionId) {
    catladderCollectionId = (await getCollection("catladder")).id;
  }
  return catladderCollectionId;
};

let panterOrganizationId: string;
const getPanterOrganizationId = async () => {
  if (!panterOrganizationId) {
    panterOrganizationId = (await getOrganization("Panter AG")).id;
  }
  return panterOrganizationId;
};

const encode = (data: any) =>
  Buffer.from(JSON.stringify(data)).toString("base64");

export const hasBitwarden = () => commandExists("bw");

const getItem = async (path: string) => {
  return execBitwardenCommand(`get item ${path}`);
};

export const readPass = async (path: string) => {
  const result = await getItem(path);

  return result.notes || result.login?.password;
};

const update = async (type: string, itemId: string, value: any) => {
  const result = await execBitwardenCommand(
    `edit ${type} ${itemId} ${encode(value)}`
  );

  return result;
};

const MAX_SYNC_AGE_IN_MINUTES = 30;
export const syncBitwarden = async (force = true) => {
  const lastSync = (await hasPreference("bwLastSync"))
    ? await getPreference("bwLastSync")
    : null;
  if (
    force ||
    !lastSync ||
    dayjs().diff(lastSync, "minutes") >= MAX_SYNC_AGE_IN_MINUTES
  ) {
    await execBitwardenCommand("sync");
    await setPreference("bwLastSync", new Date().toISOString());
  } else {
    // skip
  }
};
export const insertPass = async (path: string, content: string) => {
  const value = {
    type: 2,
    secureNote: { type: 0 },
    name: path,

    notes: content,
    collectionIds: [await getCatladderCollectionId()],
  };
  const result = await execBitwardenCommand(`create item ${encode(value)}`);
  await share(result.id);
};

const share = async (itemId: string) =>
  execBitwardenCommand(
    `share ${itemId} ${await getPanterOrganizationId()} ${encode([
      await getCatladderCollectionId(),
    ])}`
  );

export const editPass = async (path: string) => {
  const item = await getItem(path);

  await withFile(async ({ path: tmpFilePath }) => {
    await writeFile(tmpFilePath, item.notes);
    await (await getEditor()).open(tmpFilePath);
    const newContent = (await readFile(tmpFilePath)).toString("utf-8");

    await update("item", item.id, {
      ...item,
      notes: newContent,
    });
  }, { postfix: ".yml" });
};

export const readPassEnvVars = async (path: string) => {
  // make sure that you have pulled pass beforehand
  const yamlstring = await readPass(path);
  // if a value is an object, we convert it to strings
  return formatEnvVars(yaml.load(yamlstring));
};
