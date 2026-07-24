// thx copilot
export const boxWithAsci = (str: string) => {
  const length = str.length;
  const box = "╔" + "═".repeat(length + 3) + "╗";
  const empty = "║ " + " ".repeat(length + 1) + " ║";
  const text = "║ " + str + " ║";
  const bottom = "╚" + "═".repeat(length + 3) + "╝";
  return [box, empty, text, empty, bottom].join("\n");
};
