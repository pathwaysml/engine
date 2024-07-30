import type { Redis } from "ioredis"
import type { Chat, ChatMessage, HistoryMessage } from "./LangChain"
import { config, IORedis, providers } from "./globals"
import z from "zod";
import { AIMessageChunk } from "@langchain/core/messages";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import { nanoid } from "nanoid";
import zodToJsonSchema from "zod-to-json-schema";
import type { ChatOllama } from "@langchain/ollama";
import type { ChatOpenAI } from "@langchain/openai";

export interface IntegrationRequest {
    name: string;
    id: string;
    type: "tool_call" | "function";
    args?: Record<string, string>;
    responseMetadata?: Record<any, any>;
}

export interface IntegrationTask {
    name: string;
    description: string;
    args: Record<string, string>;
}

export enum IntegrationStatus {
    Submitted = "submitted",
    Queued = "queued",
    Pending = "pending",
    Completed = "completed",
    Failed = "failed",
    FatalError = "fatal",
}

export interface IntegrationResponse {
    status: IntegrationStatus;
    content: string;
    attachments?: any[];
    metadata?: Record<string, any>;
    timestamp: string;
    integration: {
        id: string;
        name: string;
        description: string;
        arguments: Record<string, any>;
        passedArguments?: Record<string, any>;
    }
}

export const IntegrationArgument = z.object({
    name: z.string(),
    description: z.string(),
    required: z.boolean(),
})

export const Integration = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    arguments: z.record(IntegrationArgument),
    execute: z.any(),
})


export class IntegrationsRunner {
    protected _redis: Redis
    protected _chat: Chat
    protected _langChainAccessor: ChatOpenAI | ChatOllama;

    constructor(redis: Redis, chat: Chat, callerProvider: string, callerModel: string) {
        this._redis = redis || IORedis;
        this._chat = chat;
        this._langChainAccessor = providers[callerProvider].generator(callerModel);
    };

    async run(integrations: IntegrationRequest[]) {
        const responses: IntegrationResponse[] = [];
        for await (const integration of integrations) {
            const task: IntegrationResponse = await this.invokeCall(integration);
            responses.push(task);
        }

        return responses;
    }

    async invokeCall(integrationRequest: IntegrationRequest) {
        const { name, args } = integrationRequest;

        // get all integrations from config
        const allIntegrations = config.integrations;

        // find the relevant integration
        const integration = allIntegrations.find((i) => i.name === name);

        // if the integration exists, execute it
        if (integration?.func) {
            const task: IntegrationResponse = await integration.func(args);
            return {
                ...task,
                integration: {
                    id: integrationRequest.id,
                    name: integration.name,
                    description: integration.description,
                    arguments: zodToJsonSchema(integration.schema),
                    passedArguments: args
                }
            };
        } else {
            return {
                status: IntegrationStatus.FatalError,
                content: "Integration not found",
                metadata: {
                    name,
                    args,
                },
                timestamp: new Date().toISOString(),
                integration: {
                    id: integrationRequest.id,
                    name: integration?.name ?? "unknown",
                    description: integration?.description ?? "unknown",
                    arguments: integration !== undefined ? zodToJsonSchema(integration.schema) : {},
                    passedArguments: args
                }
            }
        };
    }

    async invoke(messages: HistoryMessage[]): Promise<{ chatCompletion: AIMessageChunk, tasks: IntegrationRequest[] }> {
        const ctx: ChatMessage[] = this._chat.history.transform(messages);
        const ifm = this._langChainAccessor.bind({
            tools: config.integrations.map(convertToOpenAITool),
            parallel_tool_calls: false
        });

        const out = await ifm.invoke(ctx).catch((err) => {
            console.error(err);
            return new AIMessageChunk({
                content: "An error occurred while processing your request. Please try again later.",
            })
        });

        // remove duplicates
        const uniqueIntegrations = out.tool_calls?.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i) || [];

        const integrationsCalled = uniqueIntegrations.map((v) => {
            const integration = config.integrations.find((i) => i.name === v.name);
            if (!integration) return null;

            return {
                name: integration.name,
                id: v.id ?? nanoid(),
                type: v.type ?? "tool_call",
                args: v.args,
                responseMetadata: {}
            }
        }).filter((v) => v !== null);

        return {
            tasks: integrationsCalled,
            chatCompletion: out
        }
    }
}