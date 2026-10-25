import pg from "pg";
import type { PoolClient } from "pg";
export type { Pool as DatabasePool } from "pg";
let database: pg.Pool | undefined;
export function getDatabase(): pg.Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!database) {
    database = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 30000,
    });
    database.on("error", () =>
      console.error(
        JSON.stringify({ event: "database.idle_connection_failed" }),
      ),
    );
  }
  return database;
}
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getDatabase().connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
export async function closeDatabase() {
  if (database) {
    await database.end();
    database = undefined;
  }
}
