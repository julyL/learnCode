const Koa = require("koa");
const Router = require("koa-router");

const app = new Koa();
const cors = require('koa2-cors');
app.use(cors());

const router = new Router();

router.get("/", (ctx, next) => {
    ctx.body = "启动的服务用于调试'./demo'目录下的示例js";
})

router.get("/get", (ctx, next) => {
    console.log('/get');
    ctx.body = "get";
})

router.post("/post", (ctx, next) => {
    console.log('/post');
    ctx.body = 'post';
});

router.get("/delay/:second", async (ctx, next) => {
    let time = ctx.params.second;
    var pro = new Promise(re => {
        setTimeout(() => {
            re();
        }, time * 1000);
    })
    await pro;
    ctx.body = `delay ${time}s`;
})

app.use(router.routes());
app.listen(3000, () => {
    console.log('listen 3000');
})