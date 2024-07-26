import { t } from "elysia";

const event = {
    shared: t.Object({
        type: t.Literal("event"),
        procedure: t.Union([
            t.Literal("subscribe"),
            t.Literal("unsubscribe"),
            t.Literal("metadata"),
        ]),
        data: t.Object({
            id: t.String(),
        })
    })
}

const system = {
    helloWorld: t.Object({
        type: t.Literal("system"),
        procedure: t.Literal("helloWorld"),
        data: t.Object({
            foo: t.String(),
        })
    })
}

const chat = {
    message: t.Object({
        type: t.Literal("chat"),
        procedure: t.Literal("message"),
        data: t.Object({
            id: t.String(),
            user: t.Object({
                id: t.String(),
                name: t.String(),
                pronouns: t.String(),
            }),
            content: t.String(),
        })
    })
}


export default [
    ...Object.values(event),
    ...Object.values(system),
    ...Object.values(chat),
]