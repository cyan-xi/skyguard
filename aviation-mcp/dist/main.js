import "reflect-metadata";
import { createHTTPServer } from "@leanmcp/core";
const PORT = 3001;
async function bootstrap() {
    await createHTTPServer({
        name: "aviation-safety-mcp",
        version: "1.0.0",
        port: PORT,
        cors: true,
        logging: true,
    });
    console.log(`Server running on port ${PORT}`);
}
bootstrap().catch(console.error);
