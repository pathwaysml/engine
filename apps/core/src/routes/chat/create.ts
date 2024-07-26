
import type { ElysiaApp } from "../../index.ts";

const Route = (app: ElysiaApp) => app.get('/', function () {
    return {};
})


export default Route;