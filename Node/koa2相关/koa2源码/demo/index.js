const Koa = require("koa");
const path = require("path");

const app = new Koa();
app.use(async (ctx, next) => {
  ctx.body = "Hello World";
});

app.listen(3000);
console.log("[demo] start-quick is starting at port 3000");