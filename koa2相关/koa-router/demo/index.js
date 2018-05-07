const Koa = require("koa");
const path = require("path");
const Router = require('koa-router');
const app = new Koa();

var router = new Router();

router.get("/", (ctx, next) => {
  console.log(ctx.req.url);
  ctx.body = "hello";
  next();
})

router.get("/a", (ctx, next) => {
  ctx.body = ctx.req.url;
  next();
});

app.use(router.routes());

app.listen(3000);
console.log("[demo] start-quick is starting at port 3000");