
import { nanoid } from "nanoid";
import type { ElysiaApp } from "../../index.ts";
import { Chat, ChatRole } from "../../lib/LangChain.ts";

const Route = (app: ElysiaApp) => app.get('/', async (req) => {
    if (!req.query.q) {
        return {
            status: 400,
            body: {
                error: "Missing query parameter 'q'"
            }
        }
    } else if (!req.query.conversation) {
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
        conversationId: req.query.conversation.trim() ?? "test"
    });

    const request: any = await chat.send({
        messages: [
            {
                id: nanoid(),
                timestamp: new Date().toISOString(),
                role: ChatRole.User,
                content: req.query.q?.trim() ?? "Create an error message and tell the user to try using a proper query parameter",
                user: {
                    id: nanoid(),
                    name: "User",
                    displayName: "User",
                    pronouns: "he/him"
                }
            }
        ]
    });

    return {
        content: request.content,
        metadata: request.response_metadata,
        tasks: request.taskResults,
        usage: {
            input: request.usage_metadata?.input_tokens,
            output: request.usage_metadata?.output_tokens,
            total: request.usage_metadata?.total_tokens
        }
    }
})


export default Route;