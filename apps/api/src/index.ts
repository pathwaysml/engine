import { Elysia, t } from 'elysia'
import { autoroutes } from 'elysia-autoroutes'

const app = new Elysia()
    .use(
        autoroutes({
            routesDir: "./routes", // -> optional, defaults to './routes'
            generateTags: false, // -> optional, defaults to true
        })
    )
    .onRequest(({ set }) => {
        // change Powered-By header
        set.headers['x-powered-by'] = "@pathwaysml/api: API compatibility layers for Pathways Engine";
    })
    .guard({
        response: t.Object({
            status: t.Integer(),
            response: t.Any()
        })
    })
    .listen(Bun.env.PWSE_API_PORT ?? 3000)

export type ElysiaApp = typeof app