import topicsJson from "./topics.json";

type Topic = {
  description: string;
  responsibles: number;
  more: string;
};

const allTopics: Topic[] = topicsJson;

const checkYes = "✅";
const checkNo = "❌";

const checkPlaceholder = `${checkYes}/${checkNo}`;
const responsiblePlaceholder = "@...";
const rows = [
  ["Responsible", checkPlaceholder, "Description", "Note", "More Information"],
].concat(
  allTopics.map((t) => [
    Array(t.responsibles).fill(responsiblePlaceholder).join(", "),
    checkPlaceholder,
    t.description,
    "",
    t.more,
  ])
);

function makeTable(rows: string[][]) {
  const colWidths = calculateColumnWidths(rows);

  return `
${makeRow(rows[0], colWidths, " ")}
${makeRow(
  rows[0].map(() => ""),
  colWidths,
  "-"
)}
${rows
  .slice(1)
  .map((row) => makeRow(row, colWidths, " "))
  .join("\n")}
`;
}

function calculateColumnWidths(rows: string[][]) {
  const columnCount = rows[0].length;
  return Array.from({ length: columnCount }, (_, i) => i).map((columnIndex) =>
    Math.max(...rows.map((row) => row[columnIndex].length))
  );
}

function makeRow(row: string[], colWidths: number[], fillString: string) {
  return `| ${row
    .map((cell, i) => cell.padEnd(colWidths[i], fillString))
    .join(" | ")} |`;
}

export function makeTemplate() {
  return `
# Security Audit Report

A security audit report document is a comprehensive assessment of an application's security posture, containing security topics that auditors can mark to indicate the state of various security aspects.

It serves as a structured guide for security team to evaluate different security factors such as authentication, authorization, data encryption, input validation, and more.

## General Information

- Project Owner is @...
- Dev team:
  - @...
  - @...
  - @...

## Project Security

${makeTable(rows)}

`;
}

export type SecurityEvaluation = {
  topics: {
    description: string;
    responsibles: string[];
    note: string;
    isUnknown: boolean;
    isAnswered: boolean;
    isSecured: boolean;
  }[];
  score: {
    rating: number;
    totalTopics: number;
    answeredTopics: number;
    securedTopics: number;
    unknownTopics: number;
  };
};

export function evaluateDocument(document: string): SecurityEvaluation {
  const rawRows =
    document.match(/^\s*\|.*?\|\s*$/gm)?.map((row) => row.trim()) ?? [];
  const matchedRows = rawRows
    .map((row) => row.split("|").map((col) => col.trim()))
    .slice(2);
  const knownTopics = new Set(allTopics.map((t) => t.description));

  const topics = matchedRows.map((col) => {
    const responsibles = col[1].split(", ");
    const answer = col[2];
    const description = col[3];
    const note = col[4];

    const isUnknown = !knownTopics.has(description);
    const isAnswered =
      !isUnknown &&
      !answer.includes(checkPlaceholder) &&
      !responsibles.some((responsible) =>
        responsible.includes(responsiblePlaceholder)
      );
    const isSecured = !isUnknown && isAnswered && answer.includes(checkYes);

    return {
      responsibles,
      answer,
      description,
      note,
      isUnknown,
      isAnswered,
      isSecured,
    };
  });

  const totalTopics = allTopics.length;
  const answeredTopics = topics.filter((t) => t.isAnswered).length;
  const securedTopics = topics.filter((t) => t.isSecured).length;
  const unknownTopics = topics.filter((t) => t.isUnknown).length;

  const rating = Math.round((securedTopics / totalTopics) * 100);

  return {
    topics,
    score: {
      rating,
      totalTopics,
      answeredTopics,
      securedTopics,
      unknownTopics,
    },
  };
}
