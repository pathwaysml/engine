import { ChatOllama } from "@langchain/ollama"
import { ChatOpenAI } from "@langchain/openai"
import { Redis } from "ioredis";
import { nanoid } from "nanoid";
import chalk from "chalk";
import path from "node:path";
import dedent from "dedent";
import type { DynamicStructuredTool } from "@langchain/core/tools";

export interface Configuration {
    integrations: DynamicStructuredTool[];
    plugins?: any[];
}

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
        console.log(chalk.bold(`${chalk.green("✔ ")} Connected to IORedis (History client)`))
    });

    IORedis.on("error", (err) => {
        console.error(chalk.bold(`${chalk.red("✖ ")} An error occurred while connecting to Redis`));
        throw err;
    });

    await IORedis.connect().catch(() => { });

    return IORedis;
}

export const generateGlobalConfig = async () => {
    // get import dir of this file
    const currentDir = path.resolve(import.meta.dirname);

    // config dir is three four levels up
    const configDir = path.join(currentDir, "..", "..", "..", "..");

    // load pwse.config.ts first; if not found, load pwse.config.js
    const configFile = path.join(configDir, "pwse.config.ts");

    // attempt import of .ts first
    try {
        const configModule = await import(configFile);
        console.log(chalk.bold(`${chalk.green("✔ ")} Loaded ${chalk.blue("pwse.config.ts")}`));
        return configModule.default as Configuration;
    } catch (err) {
        // if import fails, attempt import of .js
        try {
            const configModule = await import(configFile.replace(".ts", ".js"));
            console.log(chalk.bold(`${chalk.green("✔ ")} Loaded ${chalk.yellow("pwse.config.js")}`));
            return configModule.default as Configuration;
        } catch (err) {
            // if import fails, throw error
            const details = dedent`
            ${chalk.blue("? ")} No configuration file was found in the apex directory, ${chalk.blue(configDir)}.
            ${chalk.green("✔ ")} Please create one of the following files in this directory:
            ${chalk.bold.blue("   T")} ${chalk.blue("pwse.config.ts")}
            ${chalk.bold.yellow("   J")} ${chalk.yellow("pwse.config.js")}
            `;

            console.log("=====")
            console.error(dedent`${chalk.yellow("✖ ")} ${chalk.bold("An error occurred during the configuration load: No configuration file found")}
            ${chalk.reset(details)}`);

            process.exit(1);
        }
    }
}

export const configurationChecks = () => {
    if (!process.env.OLLAMA_BASE_URL && process.env.DANGEROUS_DISABLE_LLAMA_GUARD !== "true") {
        const details = dedent`
        ${chalk.blue("? ")} Pathways Engine uses Ollama in order to moderate inputs and outputs within Chat and Text Completion.
        ${chalk.green("✔ ")} ${chalk.bold("FIX")}: Set OLLAMA_BASE_URL to the URL of your Ollama instance in your environment.
        ${chalk.yellow("‼ ")} ${chalk.bold("UNRECOMMENDED")}: Alternatively, you can disable this check by setting DANGEROUS_DISABLE_LLAMA_GUARD=true. This is not recommended.
        `;

        console.log("=====")
        console.error(dedent`${chalk.yellow("✖ ")} ${chalk.bold("An error occurred during the configuration load: OLLAMA_BASE_URL is not set")}
        ${chalk.reset(details)}`);

        process.exit(1);
    }

    return true;
}

export const configValid = configurationChecks();
export const IORedis = await generateRedisClient();
export const config = await generateGlobalConfig();