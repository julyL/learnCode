const Koa = require("koa");
const static = require("koa-static");
const path = require("path");
const logger = require('./logger.js');
const app = new Koa();
const staticPath = path.join(__dirname, "./static");
// app.use(static(staticPath));

app.use(async(ctx, next) => {
  console.log('before');
  ctx.body = "hello koa2";
  next();
  console.log('after');
});

// app.use(logger);

app.listen(3000);
console.log("[demo] start-quick is starting at port 3000");