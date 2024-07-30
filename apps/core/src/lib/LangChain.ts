import type { ChatOpenAI } from "@langchain/openai";
import { config, IORedis, providers } from "./globals.ts";
import type { ChatOllama } from "@langchain/ollama";
import { RedisByteStore } from "@langchain/community/storage/ioredis";
import type { Redis } from "ioredis";
import { HumanMessage, AIMessage, FunctionMessage, RemoveMessage, SystemMessage, ToolMessage, AIMessageChunk } from "@langchain/core/messages";
import { nanoid } from "nanoid";
import { IntegrationsRunner } from "./Integrations.ts";
import type { IntegrationRequest } from "./Integrations";

export interface ChatOptions {
    provider: string;
    model: string;
    callerProvider: string;
    callerModel: string;
    conversationId: string;
}

export enum ChatRole {
    User = "user",
    Assistant = "assistant",
    System = "system",
    Tool = "tool",
}

export interface HistoryMessage {
    role: ChatRole;
    id: string;
    timestamp: string;
    content: string;
    user?: {
        id: string;
        name: string;
        displayName: string | null | undefined;
        pronouns: string;
    },
    tools?: IntegrationRequest[];
    toolCalled?: {
        id: string;
        name: string;
        args?: Record<string, any>;
    }
}

export type ChatMessage = SystemMessage | HumanMessage | AIMessage | ToolMessage | FunctionMessage | RemoveMessage;

export interface SendChatMessageOptions {
    messages: HistoryMessage | HistoryMessage[];
    attachments?: any[];
}

export class History {
    protected _redis: Redis;
    protected _store: RedisByteStore;
    protected _encoder: TextEncoder;
    protected _decoder: TextDecoder;
    conversationId: string;

    constructor(redis: Redis, conversationId: string) {
        this._redis = redis;
        this.conversationId = conversationId;
        this._encoder = new TextEncoder();
        this._decoder = new TextDecoder();
        this._store = new RedisByteStore({
            client: this._redis
        });
    }

    async get(k: string | string[]): Promise<HistoryMessage[]> {
        const toQuery = [k].flat().map((v) => `${this.conversationId}:${v}`);
        if (toQuery.length === 0) return [];

        const query = await this._store.mget(toQuery || []);

        return query.map((v) => {
            const _d: HistoryMessage = JSON.parse(this._decoder.decode(v)) || {};

            const enumMappings = {
                "user": ChatRole.User,
                "assistant": ChatRole.Assistant,
                "system": ChatRole.System,
                "tool": ChatRole.Tool,
            }

            const role: ChatRole = enumMappings[_d.role] ?? ChatRole.User;

            return {
                role,
                id: _d.id || "0",
                timestamp: _d.timestamp || new Date().toISOString(),
                content: _d.content || "[empty]",
                user: {
                    id: _d.user?.id ?? "0",
                    name: _d.user?.name ?? "unknown",
                    displayName: _d.user?.displayName ?? _d.user?.name,
                    pronouns: _d.user?.pronouns ?? "unknown",
                }
            }
        }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    async getAll(): Promise<HistoryMessage[]> {
        const keyGenerator = this._store.yieldKeys(`${this.conversationId}:`);

        const keys: string[] = [];
        for await (const key of keyGenerator) {
            keys.push(key.replace(`${this.conversationId}:`, ""));
        }

        return await this.get(keys || []);
    }

    async allKeys(): Promise<string[]> {
        const keyGenerator = this._store.yieldKeys(`${this.conversationId}:`);

        const keys: string[] = [];
        for await (const key of keyGenerator) {
            keys.push(key.replace(`${this.conversationId}:`, ""));
        }

        return keys;
    }

    async add(data: HistoryMessage | HistoryMessage[]) {
        if (Array.isArray(data)) {
            const query = await this._store.mset(data.map((v) => [
                `${this.conversationId}:${v.id}`,
                this._encoder.encode(JSON.stringify(v))
            ]))

            return query;
        } else {
            const query = await this._store.mset([
                [
                    `${this.conversationId}:${data.id}`,
                    this._encoder.encode(JSON.stringify(data))
                ]
            ])

            return query;
        }
    }

    transform(data: HistoryMessage[]) {
        return data.map((v) => {
            if (v.role === "user") {
                return new HumanMessage(v.content);
            } else if (v.role === "system") {
                return new SystemMessage(v.content);
            } else if (v.role === "tool") {
                return new ToolMessage({
                    tool_call_id: v.id,
                    content: v.content,
                    name: v.toolCalled?.name,
                    additional_kwargs: v.toolCalled?.args
                });
            } else {
                return new AIMessage({
                    content: v.content,
                    tool_calls: v.tools as any
                });
            }
        });
    };
}

export class Chat {
    protected _provider: string;
    protected _model: string;
    protected _callerProvider: string;
    protected _callerModel: string;
    conversationId: string;
    langChainAccessor: ChatOpenAI | ChatOllama;
    history: History;
    integrations: IntegrationsRunner;

    constructor({ provider, model, callerProvider, callerModel, conversationId }: ChatOptions) {
        this._provider = provider ?? process.env.LANGCHAIN_PROVIDER ?? "openai";
        this._model = model ?? process.env.LANGCHAIN_MODEL ?? "gpt-4o-mini";
        this._callerProvider = callerProvider ?? process.env.LANGCHAIN_CALLER_PROVIDER ?? "openai";
        this._callerModel = callerModel ?? process.env.LANGCHAIN_CALLER_MODEL ?? "gpt-4o-mini";
        this.conversationId = conversationId;
        this.langChainAccessor = providers[this._provider].generator(this._model);
        this.history = new History(IORedis, conversationId);
        this.integrations = new IntegrationsRunner(IORedis, this, this._callerProvider, this._callerModel);
    }

    private async _invoke(messages: HistoryMessage[]): Promise<AIMessageChunk> {
        const ctx: ChatMessage[] = this.history.transform(messages);
        const lastMsg: HistoryMessage = messages[messages.length - 1];

        const chatCompletion: AIMessageChunk = await this.langChainAccessor.bind({
            tools: config.integrations as any
        }).invoke(ctx);

        await this.history.add([
            {
                id: (messages?.[messages.length - 1]?.id ? messages[messages.length - 1].id + "ASSISTANT" : `UNKNOWN:${nanoid()}`),
                timestamp: new Date().toISOString(),
                role: ChatRole.Assistant,
                content: chatCompletion.content as string,
                user: {
                    id: lastMsg?.user?.id ?? `UNKNOWN:${nanoid()}`,
                    name: lastMsg?.user?.name ?? "Unknown",
                    displayName: lastMsg?.user?.displayName ?? lastMsg?.user?.name,
                    pronouns: lastMsg?.user?.pronouns ?? "Unknown",
                }
            }
        ]);

        return chatCompletion;
    }

    async send({ messages, attachments }: SendChatMessageOptions) {
        const history = await this.history.getAll();

        const untransformedCtx: HistoryMessage[] = [
            ...history,
            ...(Array.isArray(messages) ? messages : [messages]),
        ];

        await this.history.add(messages);

        const { tasks: toCall, chatCompletion } = await this.integrations.invoke(untransformedCtx);
        if (toCall?.length) {
            const tasks = await this.integrations.run(toCall);
            const taskMessages = tasks.map((v) => {
                return {
                    role: ChatRole.Tool,
                    id: v.integration.id,
                    timestamp: v.timestamp,
                    content: v.content,
                    toolCalled: {
                        id: v.integration.id,
                        name: v.integration.name,
                        args: v.integration.passedArguments
                    }
                };
            });

            const completedCtx = await this._invoke([
                ...untransformedCtx,
                {
                    role: ChatRole.Assistant,
                    id: nanoid(),
                    timestamp: new Date().toISOString(),
                    content: chatCompletion.content as string,
                    tools: tasks.map((v) => ({
                        id: v.integration.id,
                        type: "tool_call",
                        name: v.integration.name,
                        args: v.integration.passedArguments,
                    }))
                },
                ...taskMessages
            ]);

            return {
                ...completedCtx,
                taskResults: tasks
            };
        } else {
            return chatCompletion;
        }
    }
}