import { t } from "elysia";
import type { ElysiaApp } from "../index.ts";
import Types from "../types/ws.ts";

export const Metadata = {
    identifier: "v1",
    name: "OpenAI-Compatible API",
}

const Route = (app: ElysiaApp) => app.ws("/", {
    body: t.Union(Types),
    message: async (ws, { procedure, data }): Promise<void> => {
        if (procedure === "helloWorld") {
            ws.send({
                status: 200,
                response: "Hello World!"
            })
        }
    }
});


export default Route;