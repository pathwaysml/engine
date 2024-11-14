import type { ElysiaApp } from "../../../../index.ts";
import { Chat } from "../../../../lib/LangChain.ts";

const GET = (app: ElysiaApp) => app.get("/", async (req) => {
    const params: { conversation: string } = req.params;

    const chat = new Chat({
        provider: "openai",
        model: "gpt-4o-mini",
        callerProvider: "ollama",
        callerModel: "llama3.2-vision:11b",
        conversationId: params.conversation.trim() ?? "test",
    });

    const request: any = await chat.history.getAll();

    return {
        status: 200,
        response: request
    }
});

const DELETE = (app: ElysiaApp) => app.delete("/", async (req) => {
    const params: { conversation: string } = req.params;

    const chat = new Chat({
        provider: "openai",
        model: "gpt-4o-mini",
        callerProvider: "ollama",
        callerModel: "llama3.2:3b",
        conversationId: params.conversation.trim() ?? "test",
    });

    await chat.history.clear();

    const request: any = await chat.history.getAll();

    return {
        status: 200,
        response: request
    }
});

const Route = (app: ElysiaApp) => DELETE(GET(app))


export default Route;