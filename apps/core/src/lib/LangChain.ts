import type { ChatOpenAI } from "@langchain/openai";
import type { ElysiaApp } from "../index.ts";
import { providers } from "./globals.ts";
import type { ChatOllama } from "@langchain/ollama";
import { RedisByteStore } from "@langchain/community/storage/ioredis";
import type { Redis } from "ioredis";

export interface ChatOptions {
    provider: string;
    model: string;
    conversationId: string;
}

export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface HistoryMessage {
    role: "user" | "assistant" | "system" | "tool";
    id: string;
    timestamp: string;
    content: string;
    user: {
        id: string;
        name: string;
        displayName: string | null;
        pronouns: string;
    }
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
            const role: ChatRole = _d.role || "user";

            return {
                role,
                id: _d.id || "0",
                timestamp: _d.timestamp || new Date().toISOString(),
                content: _d.content || "[empty]",
                user: {
                    id: _d.user?.id || "0",
                    name: _d.user?.name || "unknown",
                    displayName: _d.user?.displayName ?? _d.user?.name,
                    pronouns: _d.user?.pronouns || "unknown",
                }
            }
        });
    }

    async getAll(): Promise<HistoryMessage[]> {
        const keyGenerator = this._store.yieldKeys(`${this.conversationId}:`);

        const keys: string[] = [];
        for await (const key of keyGenerator) {
            keys.push(key);
        }

        return await this.get(keys || []);
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
}

export class Chat {
    protected _provider: string;
    protected _model: string;
    conversationId: string;
    langChainAccessor: ChatOpenAI | ChatOllama;

    constructor({ provider, model, conversationId }: ChatOptions) {
        this._provider = process.env.LANGCHAIN_PROVIDER ?? "openai";
        this._model = process.env.LANGCHAIN_MODEL ?? "gpt-4o-mini";
        this.conversationId = conversationId;
        this.langChainAccessor = providers[this._provider].generator(this._model);
    }

    async singleCall({ message, attachments }: { message: string, attachments: any[] }) {
        const chatCompletion = await this.langChainAccessor;
    }
}