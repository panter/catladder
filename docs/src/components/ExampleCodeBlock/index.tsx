import CodeBlock from "@theme/CodeBlock";
import { useEffect, useState } from "react";

export default function ExampleCodeBlock({
  path,
  title,
  language = "typescript",
  showLineNumbers = false,
}: {
  title?: string;
  language?: string;
  path: string;
  showLineNumbers?: boolean;
}) {
  const [code, setCode] = useState("");
  useEffect(() => {
    async function getExample() {
      const loaded = await import(`!!raw-loader!../../../../${path}`);
      const code = loaded.default
        .replaceAll(/import( | type ).+from .+\n+/g, "")
        .replaceAll(/export const information = \{\n.+\n\};\n+/g, "");
      setCode(code);
    }
    getExample();
  });

  const fileName = path.split("/").slice(-1)[0];
  return (
    <div>
      <p>
        <a href={`https://git.panter.ch/catladder/catladder/-/blob/main/${path}`}>
          {path}
        </a>
      </p>
      <CodeBlock
        language={language}
        title={title ?? fileName}
        showLineNumbers={showLineNumbers}
      >
        {code}
      </CodeBlock>
    </div>
  );
}
