import ExampleCodeBlock from "../ExampleCodeBlock";


export default function ConfigExamples({
  examplePaths = [],
}: {
  examplePaths?: string[];
}) {

  return (
    <div>
      {examplePaths.map((path) => (
        <ExampleCodeBlock path={path} key={path} />
      ))}
    </div>
  );
}
