const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const http = require("http");

const OLLAMA_BASE = process.env.OLLAMA_HOST || "http://localhost:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "mixtral:8x22b";

function ollamaRequest(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, OLLAMA_BASE);
    const postData = JSON.stringify(body);
    const req = http.request(
      url,
      { method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ response: data });
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(600000); // 10 min timeout for large models
    req.write(postData);
    req.end();
  });
}

const server = new McpServer({
  name: "ollama-server",
  version: "1.0.0",
});

server.tool(
  "ollama_generate",
  "로컬 Mixtral 8x22B 모델에 프롬프트를 보내고 응답을 받습니다. 대량 텍스트 분석, SQL Injection/Webshell 패턴 분류 등에 활용하세요.",
  {
    prompt: z.string().describe("모델에 보낼 프롬프트"),
    model: z.string().optional().describe("모델명 (기본: mixtral:8x22b)"),
    system: z.string().optional().describe("시스템 프롬프트"),
    temperature: z.number().optional().describe("Temperature (0.0-2.0, 기본: 0.7)"),
  },
  async ({ prompt, model, system, temperature }) => {
    try {
      const body = {
        model: model || DEFAULT_MODEL,
        prompt,
        stream: false,
        options: {},
      };
      if (system) body.system = system;
      if (temperature !== undefined) body.options.temperature = temperature;

      const result = await ollamaRequest("/api/generate", body);
      const response = result.response || JSON.stringify(result);
      const meta = result.total_duration
        ? `\n\n---\n[${result.model || DEFAULT_MODEL}] eval: ${(result.eval_duration / 1e9).toFixed(1)}s, tokens: ${result.eval_count || "?"}, speed: ${result.eval_count && result.eval_duration ? (result.eval_count / (result.eval_duration / 1e9)).toFixed(1) : "?"}tok/s`
        : "";
      return { content: [{ type: "text", text: response + meta }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Ollama error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "ollama_chat",
  "로컬 Mixtral 8x22B와 채팅 형식으로 대화합니다. 멀티턴 대화에 적합합니다.",
  {
    messages: z
      .array(
        z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string(),
        })
      )
      .describe('채팅 메시지 배열 [{"role":"user","content":"..."}]'),
    model: z.string().optional().describe("모델명 (기본: mixtral:8x22b)"),
    temperature: z.number().optional().describe("Temperature (0.0-2.0)"),
  },
  async ({ messages, model, temperature }) => {
    try {
      const body = {
        model: model || DEFAULT_MODEL,
        messages,
        stream: false,
        options: {},
      };
      if (temperature !== undefined) body.options.temperature = temperature;

      const result = await ollamaRequest("/api/chat", body);
      const response =
        result.message?.content || result.response || JSON.stringify(result);
      const meta = result.total_duration
        ? `\n\n---\n[${result.model || DEFAULT_MODEL}] eval: ${(result.eval_duration / 1e9).toFixed(1)}s, tokens: ${result.eval_count || "?"}, speed: ${result.eval_count && result.eval_duration ? (result.eval_count / (result.eval_duration / 1e9)).toFixed(1) : "?"}tok/s`
        : "";
      return { content: [{ type: "text", text: response + meta }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Ollama error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "ollama_models",
  "Ollama에 설치된 모델 목록을 조회합니다.",
  {},
  async () => {
    try {
      const result = await new Promise((resolve, reject) => {
        http
          .get(`${OLLAMA_BASE}/api/tags`, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(JSON.parse(data)));
          })
          .on("error", reject);
      });
      const models = (result.models || [])
        .map(
          (m) =>
            `- ${m.name} (${m.details?.parameter_size || "?"}, ${m.details?.quantization_level || "?"})`
        )
        .join("\n");
      return { content: [{ type: "text", text: models || "설치된 모델 없음" }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Ollama error: ${e.message}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
