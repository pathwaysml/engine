import { Elysia } from 'elysia'
import { autoroutes } from 'elysia-autoroutes'
import { IORedis } from './lib/globals';

await IORedis;

const app = new Elysia()
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