const Koa = require("koa");
const path = require("path");
const Router = require('koa-router');
const app = new Koa();

var router = new Router();

router.get("/", (ctx, next) => {
  ctx.body = "hello";
  next();
})

router.get("/user/:id", (ctx, next) => {
  console.log(ctx.params);
  ctx.body = `user id is ${ctx.params.id}`;
  next();
});


app.use(router.routes());

app.listen(3000);
console.log("[demo] start-quick is starting at port 3000");