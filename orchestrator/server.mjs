import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PORT = Number(process.env.ORCHESTRATOR_PORT || 8787);

const experiments = new Map();

const runOpenCode = (prompt) =>
    new Promise((resolvePromise, rejectPromise) => {
        const child = spawn("opencode", ["run", prompt], {
            cwd: ROOT_DIR,
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        child.on("error", (error) => {
            rejectPromise(error);
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolvePromise(stdout.trim());
                return;
            }
            rejectPromise(
                new Error(
                    stderr.trim() ||
                        `opencode exited with code ${code ?? "unknown"}`,
                ),
            );
        });
    });

const parseJsonBody = (req) =>
    new Promise((resolvePromise, rejectPromise) => {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk.toString();
        });
        req.on("end", () => {
            if (!body) {
                resolvePromise({});
                return;
            }
            try {
                resolvePromise(JSON.parse(body));
            } catch (error) {
                rejectPromise(error);
            }
        });
        req.on("error", (error) => rejectPromise(error));
    });

const sendJson = (res, statusCode, payload) => {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
};

const beginExperiment = async (experimentID, prompt) => {
    if (!experimentID || !prompt) {
        throw new Error("experimentID and prompt are required.");
    }
    experiments.set(experimentID, prompt);
    return runOpenCode(prompt);
};

const revertExperiment = async (experimentID) => {
    if (!experimentID) {
        throw new Error("experimentID is required.");
    }
    const prompt = experiments.get(experimentID);
    if (!prompt) {
        throw new Error("Unknown experimentID.");
    }
    const revertPrompt = `Revert the following: ${prompt}`;
    return runOpenCode(revertPrompt);
};

const server = createServer(async (req, res) => {
    try {
        if (req.method !== "POST") {
            sendJson(res, 405, { error: "Method Not Allowed" });
            return;
        }

        const url = new URL(req.url || "", `http://${HOST}:${PORT}`);
        const body = await parseJsonBody(req);

        if (url.pathname === "/begin_experiment") {
            const output = await beginExperiment(
                body.experimentID,
                body.prompt,
            );
            sendJson(res, 200, { ok: true, output });
            return;
        }

        if (url.pathname === "/revert_experiment") {
            const output = await revertExperiment(body.experimentID);
            sendJson(res, 200, { ok: true, output });
            return;
        }

        sendJson(res, 404, { error: "Not Found" });
    } catch (error) {
        sendJson(res, 400, { error: error?.message || "Request failed." });
    }
});

server.listen(PORT, HOST, () => {
    console.log(`Orchestrator listening on http://${HOST}:${PORT}`);
});
