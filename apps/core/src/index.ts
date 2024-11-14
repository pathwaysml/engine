import { Elysia } from 'elysia'
import { autoroutes } from 'elysia-autoroutes'
import { IORedis } from './lib/globals';
import { logger } from "@bogeychan/elysia-logger";

await IORedis.connect().catch(() => { });

const app = new Elysia()
    .use(
        logger({
            level: "error",
        })
    )
    .use(
        autoroutes({
            routesDir: "./routes", // -> optional, defaults to './routes'
            generateTags: false, // -> optional, defaults to true
        })
    )
    .onRequest(({ set }) => {
        // change Powered-By header
        set.headers['x-powered-by'] = "@pathwaysml/core: Pathways Engine";
    })
    .listen(Bun.env.PWSE_CORE_PORT ?? 3001);

type BaseElysiaApp = typeof app;

export interface ElysiaApp extends BaseElysiaApp { };