"use strict";

/**
 * Module dependencies.
 */

const isGeneratorFunction = require("is-generator-function");
const debug = require("debug")("koa:application");
const onFinished = require("on-finished");
const response = require("./response");
const compose = require("koa-compose");
const isJSON = require("koa-is-json");
const context = require("./context");
const request = require("./request");
const statuses = require("statuses");
const Cookies = require("cookies");
const accepts = require("accepts");
const Emitter = require("events");
const assert = require("assert");
const Stream = require("stream");
const http = require("http");
const only = require("only");
const convert = require("koa-convert");
const deprecate = require("depd")("koa");

/**
 * Expose `Application` class.
 * Inherits from `Emitter.prototype`.
 */

// Koa的构造函数, 继承Emitter
module.exports = class Application extends Emitter {
  /**
   * Initialize a new `Application`.
   *
   * @api public
   */

  constructor() {
    super();                                              // 继承至Emitter

    this.proxy = false;                                   // 是否设置代理
    this.middleware = [];                                 // 存储app.use注册的中间件
    this.subdomainOffset = 2;     
    this.env = process.env.NODE_ENV || "development";     // 环境变量

    this.context = Object.create(context);                // this.context对象之后会添加属性扩展成ctx对象
    this.request = Object.create(request);                
    this.response = Object.create(response);
    // context,request,response对象详细说明见context.js,request.js,response.js
  }

  /**
   * Shorthand for:
   *
   *    http.createServer(app.callback()).listen(...)
   *
   * @param {Mixed} ...
   * @return {Server}
   * @api public
   */

  listen(...args) {
    // debug("listen");
    const server = http.createServer(this.callback()); // 调用原生http.createServer启动服务
    return server.listen(...args);
  }

  /**
   * Return JSON representation.
   * We only bother showing settings.
   *
   * @return {Object}
   * @api public
   */

  toJSON() {
    return only(this, ["subdomainOffset", "proxy", "env"]);
  }

  /**
   * Inspect implementation.
   *
   * @return {Object}
   * @api public
   */

  inspect() {
    return this.toJSON();
  }

  /**
   * Use the given middleware `fn`.
   *
   * Old-style middleware will be converted.
   *
   * @param {Function} fn
   * @return {Application} self
   * @api public
   */

  use(fn) {
    if (typeof fn !== "function") throw new TypeError("middleware must be a function!");
    // 判断是否为Generator函数  function*
    if (isGeneratorFunction(fn)) {
      deprecate(
        "Support for generators will be removed in v3. " +
          "See the documentation for examples of how to convert old middleware " +
          "https://github.com/koajs/koa/blob/master/docs/migration.md"
      );
      fn = convert(fn);
    }
    // debug("use %s", fn._name || fn.name || "-");
    this.middleware.push(fn);   // 放入中间件数组
    return this;                // 通过返回this实现链式调用
  }

  /**
   * Return a request handler callback
   * for node's native http server.
   *
   * @return {Function}
   * @api public
   */
  // 调用方式: http.createServer(this.callback())
  callback() {
    // 处理中间件, 实现洋葱模型的核心方法
    const fn = compose(this.middleware);

    // 没有监听error事件则绑定默认error事件处理
    if (!this.listeners("error").length) this.on("error", this.onerror);

    // handleRequest会作为参数传入http.createServer(handleRequest)
    const handleRequest = (req, res) => {
      const ctx = this.createContext(req, res);   // 对原生的req,res进行扩展封装成ctx对象
      return this.handleRequest(ctx, fn);         // 处理请求(执行中间件并设置res对象)
    };

    return handleRequest;
  }

  /**
   * Handle request in callback.
   *
   * @api private
   */

  handleRequest(ctx, fnMiddleware) {
    const res = ctx.res;
    res.statusCode = 404;                         // 没有调用response.writeHead时的默认响应状态码
    const onerror = err => ctx.onerror(err);      // 中间件的错误处理
    const handleResponse = () => respond(ctx);    // 根据ctx对象设置原生response对象
    onFinished(res, onerror);                     // Execute a callback when a HTTP request closes, finishes, or errors.
    return fnMiddleware(ctx).then(handleResponse).catch(onerror);   // fnMiddleware为compose(this.middleware)返回的Promise
  }

  /**
   * Initialize a new context.
   *
   * @api private
   */

  // 在ctx对象扩展了一些常用对象,koa通过拦截get和set操作来实现代理
  // 例如:ctx拦截了body的get和set,实现了对ctx.response的代理。对ctx.body的取值和赋值,实际操作的是ctx.response.body,将response的逻辑处理分离到了response.js中
  createContext(req, res) {
    const context = Object.create(this.context);
    const request = (context.request = Object.create(this.request));
    const response = (context.response = Object.create(this.response));
    context.app = request.app = response.app = this;
    context.req = request.req = response.req = req;
    context.res = request.res = response.res = res;
    request.ctx = response.ctx = context;
    request.response = response;
    response.request = request;
    context.originalUrl = request.originalUrl = req.url;
    context.cookies = new Cookies(req, res, {
      keys: this.keys,
      secure: request.secure
    });
    request.ip = request.ips[0] || req.socket.remoteAddress || "";
    context.accept = request.accept = accepts(req);
    context.state = {};
    return context;
  }

  /**
   * Default error handler.
   *
   * @param {Error} err
   * @api private
   */

  onerror(err) {
    // assert(err instanceof Error, `non-error thrown: ${err}`);

    if (404 == err.status || err.expose) return;
    if (this.silent) return;

    const msg = err.stack || err.toString();
    console.error();
    console.error(msg.replace(/^/gm, "  "));
    console.error();
  }
};

/**
 * Response helper.
 */

function respond(ctx) {
  // 会在第一个中间件返回的Promise为resolved之后执行,主要用于设置response的header和body
  // allow bypassing koa
  if (false === ctx.respond) return;

  const res = ctx.res;
  if (!ctx.writable) return; // ctx.writable为false,等价于response.finished = true,说明此时响应已完成,不需要任何处理

  let body = ctx.body;
  const code = ctx.status;

  // ignore body
  if (statuses.empty[code]) {
    // 状态码为204,205,304
    // strip headers
    ctx.body = null;
    return res.end();
  }

  if ("HEAD" == ctx.method) {
    // res.headersSent为true表示响应头部已发送(res.end已经执行)
    if (!res.headersSent && isJSON(body)) {
      ctx.length = Buffer.byteLength(JSON.stringify(body));
    }
    return res.end();
  }

  // status body
  if (null == body) {
    body = ctx.message || String(code);
    if (!res.headersSent) {
      ctx.type = "text";
      ctx.length = Buffer.byteLength(body);
    }
    return res.end(body);
  }

  // responses
  // Buffer对象或者String对象可以直接通过res.end返回
  // Stream对象使用pipe方法将数据流放入res
  if (Buffer.isBuffer(body)) return res.end(body);
  if ("string" == typeof body) return res.end(body);
  if (body instanceof Stream) return body.pipe(res);

  // body: json
  body = JSON.stringify(body);
  if (!res.headersSent) {
    ctx.length = Buffer.byteLength(body);
  }
  res.end(body);
}
