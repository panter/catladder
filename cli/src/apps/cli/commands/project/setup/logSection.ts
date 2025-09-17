import type { CommandInstance } from "vorpal";

export const logSection = async (
  instance: CommandInstance,
  title: string,
  work: () => Promise<void>,
) => {
  instance.log("");
  instance.log(
    "==================================================================================",
  );
  instance.log("🐱 🔧 " + title + "...");
  instance.log("");
  await work();
  instance.log("");
  instance.log("✅    " + title + " done!");
  instance.log("");
  instance.log(
    "==================================================================================",
  );
  instance.log("");
};
