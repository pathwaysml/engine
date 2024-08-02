import type { ElysiaApp } from "../../index.ts";
import { Chat } from "../../lib/LangChain.ts";

const Route = (app: ElysiaApp) => app.get('/', async (req) => {
    if (!req.query.conversation) {
        return {
            status: 400,
            body: {
                error: "Missing query parameter 'conversation'"
            }
        }
    }
    const chat = new Chat({
        provider: "openai",
        model: "gpt-4o-mini",
        callerProvider: "ollama",
        callerModel: "llama3.1",
        conversationId: req.query.conversation.trim() ?? "test",
    });

    const request: any = await chat.history.getAll();

    return request;
})


export default Route;