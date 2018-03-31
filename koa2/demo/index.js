const Koa = require("koa");
const static = require("koa-static");
const path = require("path");
const Router = require('koa-router');
const logger = require('./logger.js');
const app = new Koa();
const staticPath = path.join(__dirname, ".");
app.use(static(staticPath));

var router = new Router();

router.get("/user/:id", (ctx, next) => {
  console.log(ctx.params);
  ctx.body = "word";
  next();
});


app.use(router.routes());

app.listen(3000);
console.log("[demo] start-quick is starting at port 3000");