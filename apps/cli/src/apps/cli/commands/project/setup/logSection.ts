import type { IO } from "../../../../../core/types";

export const logSection = async (
  instance: IO,
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
