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
    super();

    this.proxy = false;
    this.middleware = [];
    this.subdomainOffset = 2;
    this.env = process.env.NODE_ENV || "development";
    this.context = Object.create(context);
    this.request = Object.create(request);
    this.response = Object.create(response);
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
    debug("listen");
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
    if (isGeneratorFunction(fn)) {
      // 判断是否为Generator函数  function*
      deprecate(
        "Support for generators will be removed in v3. " +
          "See the documentation for examples of how to convert old middleware " +
          "https://github.com/koajs/koa/blob/master/docs/migration.md"
      );
      fn = convert(fn);
    }
    debug("use %s", fn._name || fn.name || "-");
    this.middleware.push(fn);
    return this; // 通过返回this实现链式调用
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

    if (!this.listeners("error").length) this.on("error", this.onerror);

    // http.createServer(handleRequest)
    const handleRequest = (req, res) => {
      const ctx = this.createContext(req, res); // 对原生的req,res进行扩展封装成ctx对象
      return this.handleRequest(ctx, fn); // 服务器接受请求时的主要处理逻辑
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
    res.statusCode = 404;
    const onerror = err => ctx.onerror(err); // 进行错误处理
    const handleResponse = () => respond(ctx); // 处理请求,根据请求返回正确的状态码和内容
    onFinished(res, onerror);
    return fnMiddleware(ctx)
      .then(handleResponse)
      .catch(onerror);
    // fnMiddleware(ctx)会执行所有的中间件,并返回一个Promise对象
    // 如果所有中间件都顺利执行,会执行handleResponse. 如果中间执行抛出异常或者handleResponse执行抛出异常,则会执行onerror进行统一错误处理
  }

  /**
   * Initialize a new context.
   *
   * @api private
   */

  createContext(req, res) {
    // 扩展ctx对象
    const context = Object.create(this.context);
    // 在context.js中已经将context上的部分属性代理给了context.request和context.response
    // 通过如下设置,将context.request中的属性get和set逻辑 交由 request.js中处理
    // 例子: 对ctx.body处理时, 实际处理的是 ctx.response.body, 处理逻辑分离到了response.js中
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
    assert(err instanceof Error, `non-error thrown: ${err}`);

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
  // 所有中间件执行完之后的请求处理逻辑,主要根据状态码和请求的一些信息返回响应的内容
  // allow bypassing koa
  if (false === ctx.respond) return;

  const res = ctx.res;
  if (!ctx.writable) return; // ctx.writable为false(response.finished = true)说明响应已完成,不需要任何处理

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
    if (!res.headersSent && isJSON(body)) {
      // res.headersSent为true表示响应头部已发送(res.end已经调用)
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
