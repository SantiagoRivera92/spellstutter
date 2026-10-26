import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MongoClient } from "mongodb";

interface LocalMongo {
  uri: string;
  stop: () => Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForMongo(uri: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`mongod exited with code ${child.exitCode}`);
    }
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 750 });
    try {
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      await client.close();
      return;
    } catch (error) {
      lastError = error;
      await client.close().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Timed out waiting for mongod");
}

async function startLocalMongo(): Promise<LocalMongo | null> {
  const dir = await mkdtemp(join(tmpdir(), "spellstutter-mongo-"));
  const port = await freePort();
  const uri = `mongodb://127.0.0.1:${port}/spellstutter_test`;
  const child = spawn(
    "mongod",
    [
      "--dbpath",
      dir,
      "--port",
      String(port),
      "--bind_ip",
      "127.0.0.1",
      "--nounixsocket",
      "--quiet",
      "--logpath",
      join(dir, "mongod.log"),
      "--logappend",
    ],
    { stdio: "ignore" },
  );

  const spawnError = new Promise<Error>((resolve) => {
    child.once("error", resolve);
  });

  try {
    await Promise.race([
      waitForMongo(uri, child),
      spawnError.then((error) => {
        throw error;
      }),
    ]);
  } catch (error) {
    child.kill("SIGKILL");
    await rm(dir, { recursive: true, force: true });
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn(
        "[tests] mongod not found; MongoDB integration tests will be skipped.",
      );
      return null;
    }
    console.warn(`[tests] could not start mongod: ${String(error)}`);
    return null;
  }

  return {
    uri,
    stop: async () => {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await Promise.race([
          new Promise((resolve) => child.once("exit", resolve)),
          new Promise((resolve) => setTimeout(resolve, 5_000)),
        ]);
      }
      if (child.exitCode === null) child.kill("SIGKILL");
      await rm(dir, { recursive: true, force: true });
    },
  };
}

function runTests(extraArgs: string[]): Promise<number> {
  const args = [
    "--conditions=react-server",
    "--experimental-test-module-mocks",
    "--import",
    "tsx",
    "--test",
    "src/**/*.test.ts",
    ...extraArgs,
  ];
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });
  return new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function main() {
  let mongo: LocalMongo | null = null;
  if (!process.env.MONGODB_TEST_URI) {
    mongo = await startLocalMongo();
    if (mongo) {
      process.env.MONGODB_TEST_URI = mongo.uri;
      process.env.MONGODB_URI = mongo.uri;
    }
  }

  const code = await runTests(process.argv.slice(2));
  await mongo?.stop();
  process.exit(code);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
