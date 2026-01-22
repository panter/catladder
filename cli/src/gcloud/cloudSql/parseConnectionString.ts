import {
  ConnectionStringParser,
  type IConnectionStringParameters,
} from "connection-string-parser";

/**
 * Parses a PostgreSQL connection string.
 * Accepts both postgres:// and postgresql:// schemes and normalizes to postgresql://
 *
 * @param connectionString - The connection string to parse (e.g., "postgresql://user:pass@localhost:5432/dbname")
 * @returns Parsed connection string parameters
 */
export function parseConnectionString(
  connectionString: string,
): IConnectionStringParameters {
  const parser = new ConnectionStringParser({
    scheme: "postgresql",
    hosts: [],
  });

  // Normalize postgres:// to postgresql:// (the official IANA scheme)
  const normalizedConnectionString = connectionString.replace(
    /^postgres:\/\//,
    "postgresql://",
  );

  return parser.parse(normalizedConnectionString);
}
