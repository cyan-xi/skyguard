import "reflect-metadata";
import { MCPServer } from "@leanmcp/core";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AviationSafetyService } from "./server.js";
async function bootstrap() {
    const server = new MCPServer({
        name: "aviation-safety-mcp",
        version: "1.0.0",
        autoDiscover: false
    });
    server.registerService(new AviationSafetyService());
    const mcpServer = server.getServer();
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    // Don't log to console in stdio mode as it corrupts the stream
    // console.error("Aviation Safety MCP running on stdio");
}
bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});
