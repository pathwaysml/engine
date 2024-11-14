import type { ElysiaApp } from "../../../index.ts";
import { SupportedCalls, type APIMetadataResponse, type APIVersion } from "../../../types/global.ts";

export const Metadata: APIVersion = {
    identifier: "v1",
    name: "OpenAI-Compatible API",
    supports: [
        SupportedCalls.TraditionalInference,
        SupportedCalls.StreamingInference,
        SupportedCalls.TextGeneration,
        SupportedCalls.ImageGeneration,
        SupportedCalls.Integrations,
    ]
}

const Route = (app: ElysiaApp) => app.get("/", (): APIMetadataResponse => {
    return {
        status: 200,
        response: Metadata
    }
});


export default Route;