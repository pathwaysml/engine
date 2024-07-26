import { ChatOllama } from "@langchain/ollama"
import { ChatOpenAI } from "@langchain/openai"
import { Redis } from "ioredis";
import { nanoid } from "nanoid";
import chalk from "chalk";
import type { Chat } from "./LangChain";

interface Provider {
    generator: (model: string) => ChatOpenAI | ChatOllama;
}

export const providers: { [key: string]: Provider } = {
    "openai": {
        generator: (model: string) => {
            const _m = new ChatOpenAI({
                model,
                apiKey: process.env.OPENAI_API_KEY,
                configuration: {
                    baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
                }
            })

            return _m
        }
    },
    "openrouter": {
        generator: (model: string) => {
            const _m = new ChatOpenAI({
                model,
                apiKey: process.env.OPENROUTER_API_KEY,
                configuration: {
                    baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
                }
            })

            return _m
        }
    },
    "ollama": {
        generator: (model: string) => {
            const _m = new ChatOllama({
                model,
                baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
            })

            return _m
        }
    },
}

// redis://192.168.5.2:6379
const decodeRedisURI = (uri: string) => {
    const url = new URL(uri);
    return {
        host: url.hostname,
        port: parseInt(url.port),
        password: url.password,
    };
};

const generateRedisClient = async () => {
    const decodedURI = decodeRedisURI(process.env.KV_URI ?? "redis://localhost:6379");

    const IORedis = new Redis({
        host: decodedURI.host,
        port: decodedURI.port,
        password: decodedURI.password,
        db: parseInt(process.env.KV_CHANNEL ?? "0"),
        connectionName: `pwse.core: ${nanoid()}`
    });

    IORedis.on("connect", () => {
        console.log(chalk.green("Redis connected!"))
    });

    IORedis.on("error", (err) => {
        console.error(chalk.red("Redis error!"));
        console.error(err);
    });

    await IORedis.connect().catch(() => { });

    return IORedis;
}

export const IORedis = generateRedisClient();