const Koa = require("koa");
const path = require("path");
const Router = require('koa-router');
const app = new Koa();

var router = new Router();

router
  .param('user', function (id, ctx, next) {
    console.log(id);
    ctx.body = id || 'no id';
    // next();
  })
  .get('/users/:user', function (ctx, next) {
    ctx.body = ctx.user;
  });

app.use(router.routes());

app.listen(3000);
console.log("[demo] start-quick is starting at port 3000");