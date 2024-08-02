
import { nanoid } from "nanoid";
import type { ElysiaApp } from "../../index.ts";
import { Chat, ChatRole } from "../../lib/LangChain.ts";
import { t } from "elysia";

const Route = (app: ElysiaApp) => app.post('/', async (req) => {
    if (!req.body) {
        return {
            status: 400,
            body: {
                error: "Missing body"
            }
        }
    } else if (!req.body.message) {
        return {
            status: 400,
            body: {
                error: "Missing body key 'q'"
            }
        }
    } else if (!req.body.conversation) {
        return {
            status: 400,
            body: {
                error: "Missing body key 'conversation'"
            }
        }
    }

    const chat = new Chat({
        provider: "ollama",
        model: "llama3.1",
        callerProvider: "ollama",
        callerModel: "llama3.1",
        conversationId: req.body.conversation?.trim() ?? "test",
        onlineProvider: "openrouter",
        onlineModel: "perplexity/llama-3.1-sonar-small-128k-chat",
    });

    const request: any = await chat.send({
        messages: [
            {
                id: nanoid(),
                timestamp: new Date().toISOString(),
                role: ChatRole.User,
                content: req.body.message?.trim() ?? "Create an error message and tell the user to try using a proper query parameter",
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
}, {
    body: t.Object({
        message: t.String(),
        prompt: t.Optional(t.String()),
        conversation: t.String()
    })
})


export default Route;