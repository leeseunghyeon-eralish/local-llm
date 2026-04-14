const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const server = new McpServer({
  name: "decode-server",
  version: "1.0.0",
});

server.tool(
  "base64_decode",
  "Base64 문자열을 디코딩합니다. 여러 줄도 지원합니다.",
  { input: z.string().describe("Base64 encoded string") },
  async ({ input }) => {
    try {
      const decoded = Buffer.from(input, "base64").toString("utf-8");
      return { content: [{ type: "text", text: decoded }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Decode error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "base64_encode",
  "문자열을 Base64로 인코딩합니다.",
  { input: z.string().describe("Plain text string") },
  async ({ input }) => {
    const encoded = Buffer.from(input, "utf-8").toString("base64");
    return { content: [{ type: "text", text: encoded }] };
  }
);

server.tool(
  "url_decode",
  "URL 인코딩된 문자열을 디코딩합니다 (percent-decoding).",
  { input: z.string().describe("URL encoded string") },
  async ({ input }) => {
    try {
      const decoded = decodeURIComponent(input);
      return { content: [{ type: "text", text: decoded }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Decode error: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "url_encode",
  "문자열을 URL 인코딩합니다.",
  { input: z.string().describe("Plain text string") },
  async ({ input }) => {
    const encoded = encodeURIComponent(input);
    return { content: [{ type: "text", text: encoded }] };
  }
);

server.tool(
  "full_decode",
  "Base64 디코딩 후 URL 디코딩을 순차적으로 수행합니다. 공격 페이로드 분석에 유용합니다.",
  { input: z.string().describe("Base64 + URL encoded string") },
  async ({ input }) => {
    try {
      let result = input;
      // Step 1: Base64 decode
      const b64decoded = Buffer.from(result, "base64").toString("utf-8");
      // Step 2: URL decode (repeated to handle double-encoding)
      let urlDecoded = b64decoded;
      try {
        urlDecoded = decodeURIComponent(urlDecoded);
        try { urlDecoded = decodeURIComponent(urlDecoded); } catch {}
      } catch {}
      return {
        content: [{
          type: "text",
          text: `[Base64 Decoded]\n${b64decoded}\n\n[URL Decoded]\n${urlDecoded}`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Decode error: ${e.message}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
