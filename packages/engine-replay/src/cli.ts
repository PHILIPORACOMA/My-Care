import { replay, type ReplayRequest } from "./replay.js";

/**
 * stdin: one ReplayRequest as JSON. stdout: { results: ReplayResult[] }.
 * Exit code 1 with a message on stderr if the input is not valid JSON.
 *
 * Invoked by App\Domain\Triage\EngineReplayer. Reads everything, then answers
 * once: the server sends bounded chunks, so streaming would add nothing.
 */
const chunks: Buffer[] = [];

process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
process.stdin.on("end", () => {
  let request: ReplayRequest;

  try {
    request = JSON.parse(Buffer.concat(chunks).toString("utf8")) as ReplayRequest;
  } catch (error) {
    process.stderr.write(`replay: input is not valid JSON: ${(error as Error).message}\n`);
    process.exit(1);
  }

  process.stdout.write(JSON.stringify({ results: replay(request) }));
});
