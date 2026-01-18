import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PORT = Number(process.env.ORCHESTRATOR_PORT || 8787);

const experiments = new Map();
const OPENCODE_SERVER_URL =
    process.env.OPENCODE_SERVER_URL || "http://127.0.0.1:4321";

const opencodeUrl = new URL(OPENCODE_SERVER_URL);
const OPENCODE_HOST = opencodeUrl.hostname;
const OPENCODE_PORT = Number(opencodeUrl.port || 4321);

let opencodeProcess = null;

const startOpenCodeServer = () => {
    const args = [
        "serve",
        "--hostname",
        OPENCODE_HOST,
        "--port",
        String(OPENCODE_PORT),
    ];
    const child = spawn("opencode", args, {
        cwd: ROOT_DIR,
        stdio: ["ignore", "pipe", "pipe"],
    });

    opencodeProcess = child;

    child.stdout.on("data", (chunk) => {
        process.stdout.write(`[opencode serve] ${chunk.toString()}`);
    });

    child.stderr.on("data", (chunk) => {
        process.stderr.write(`[opencode serve] ${chunk.toString()}`);
    });

    child.on("error", (error) => {
        console.error("[opencode serve] failed to start", error);
    });

    child.on("close", (code) => {
        console.error(`[opencode serve] exited with code ${code ?? "unknown"}`);
    });
};

const stopOpenCodeServer = () => {
    if (!opencodeProcess) return;
    try {
        opencodeProcess.kill("SIGTERM");
        setTimeout(() => {
            if (!opencodeProcess?.killed) {
                opencodeProcess.kill("SIGKILL");
            }
        }, 500);
    } catch (error) {
        console.error("[opencode serve] failed to stop", error);
    }
};

const runOpenCode = async (prompt) => {
    const startTime = Date.now();

    const sessionResponse = await fetch(`${OPENCODE_SERVER_URL}/session`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "fluxor-experiment" }),
    });

    if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        throw new Error(`opencode session error: ${errorText}`);
    }

    const session = await sessionResponse.json();
    const sessionId = session.id || session.sessionID || session.sessionId;

    if (!sessionId) {
        throw new Error("opencode session id missing");
    }

    const messageResponse = await fetch(
        `${OPENCODE_SERVER_URL}/session/${sessionId}/message`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                parts: [
                    {
                        type: "text",
                        text: `${prompt}\n\nOnly edit app/page.tsx.`,
                    },
                ],
            }),
        },
    );

    const endTime = Date.now();
    console.log(`[opencode timing] total ${endTime - startTime}ms`);

    if (!messageResponse.ok) {
        const errorText = await messageResponse.text();
        throw new Error(`opencode message error: ${errorText}`);
    }

    const message = await messageResponse.json();
    return JSON.stringify(message);
};

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
    const fullPrompt = `${prompt}
    
    IMPORTANT: Do not modify the debug panel at all, and do not run terminal commands unless necessary to check for linting errors or type errors.`;
    const output = await runOpenCode(fullPrompt);
    const timestamp = new Date().toISOString();
    return { output, timestamp, experimentID };
};

const revertExperiment = async (experimentID) => {
    if (!experimentID) {
        throw new Error("experimentID is required.");
    }
    const prompt = experiments.get(experimentID);
    if (!prompt) {
        throw new Error("Unknown experimentID.");
    }

    const revertPrompt = `Revert the following: ${prompt}
    
    IMPORTANT: Do not modify the debug panel at all, and do not run terminal commands unless necessary to check for linting errors or type errors.`;
    return runOpenCode(revertPrompt);
};

const server = createServer(async (req, res) => {
    let body = {};
    try {
        if (req.method !== "POST") {
            sendJson(res, 405, { error: "Method Not Allowed" });
            return;
        }

        const url = new URL(req.url || "", `http://${HOST}:${PORT}`);
        body = await parseJsonBody(req);

        if (url.pathname === "/begin_experiment") {
            const result = await beginExperiment(
                body.experimentID,
                body.prompt,
            );
            sendJson(res, 200, {
                ok: true,
                output: result.output,
                timestamp: result.timestamp,
                experimentID: result.experimentID,
            });
            return;
        }

        if (url.pathname === "/revert_experiment") {
            const output = await revertExperiment(body.experimentID);
            sendJson(res, 200, { ok: true, output });
            return;
        }

        if (url.pathname === "/shutdown") {
            sendJson(res, 200, {
                ok: true,
                message: "Server shutting down...",
            });
            stopOpenCodeServer();
            setTimeout(() => process.exit(0), 100);
            return;
        }

        sendJson(res, 404, { error: "Not Found" });
    } catch (error) {
        const url = new URL(req.url || "", `http://${HOST}:${PORT}`);
        console.error("[orchestrator] request failed", {
            method: req.method,
            path: url.pathname,
            body,
            error: error?.message || String(error),
        });
        sendJson(res, 400, { error: error?.message || "Request failed." });
    }
});

startOpenCodeServer();

server.listen(PORT, HOST, () => {
    console.log(`Orchestrator listening on http://${HOST}:${PORT}`);
});
