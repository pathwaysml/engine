export enum SupportedCalls {
    TraditionalInference = "traditionalInference",
    StreamingInference = "streamingInference",
    TextGeneration = "textGeneration",
    ImageGeneration = "imageGeneration",
    Integrations = "integrations",
}

export type APIVersion = {
    identifier: string,
    name: string,
    supports: SupportedCalls[],
}

export type APIMetadataResponse = {
    status: number,
    response: APIVersion | string,
}