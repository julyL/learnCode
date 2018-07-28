"use strict";

const debug = require("debug")("koa-session");
const ContextSession = require("./lib/context");
const util = require("./lib/util");
const assert = require("assert");
const uid = require("uid-safe");
const is = require("is-type-of");

const CONTEXT_SESSION = Symbol("context#contextSession");
const _CONTEXT_SESSION = Symbol("context#_contextSession");

/**
 * Initialize session middleware with `opts`:
 *
 * - `key` session cookie name ["koa:sess"]
 * - all other options are passed as cookie options
 *
 * @param {Object} [opts]
 * @param {Application} app, koa application instance
 * @api public
 */

module.exports = function(opts, app) {
  // session(app[, opts])
  if (opts && typeof opts.use === "function") {
    [app, opts] = [opts, app];
  }
  // app required
  if (!app || typeof app.use !== "function") {
    throw new TypeError("app instance required: `session(opts, app)`");
  }

  opts = formatOpts(opts);           // 检测opts并设置相应属性的默认值
  extendContext(app.context, opts);  // 扩展ctx对象

  return async function session(ctx, next) {
    const sess = ctx[CONTEXT_SESSION];
    if (sess.store) await sess.initFromExternal();  // 从外部存储中获取session
    try {
      await next();
    } catch (err) {
      throw err;
    } finally {
      // 根据ctx.session的值来更新存储的session并通过ctx.cookies.set设置response.headers的Set-Cookie值来更新client端的cookie。考虑到其他中间件可能会操作ctx.session,所以sess.commit是在next方法之后调用的
      await sess.commit();
    }
  };
};

/**
 * format and check session options
 * @param  {Object} opts session options
 * @return {Object} new session options
 *
 * @api private
 */

function formatOpts(opts) {
  opts = opts || {};
  // key
  opts.key = opts.key || "koa:sess";

  // back-compat maxage
  if (!("maxAge" in opts)) opts.maxAge = opts.maxage;

  // defaults
  if (opts.overwrite == null) opts.overwrite = true;
  if (opts.httpOnly == null) opts.httpOnly = true;
  if (opts.signed == null) opts.signed = true;

  debug("session options %j", opts);

  // setup encoding/decoding
  if (typeof opts.encode !== "function") {
    opts.encode = util.encode;
  }
  if (typeof opts.decode !== "function") {
    opts.decode = util.decode;
  }

  // opts.store可用于设置session的外部存储,必须实现get,set,destroy方法
  const store = opts.store;
  if (store) {
    assert(is.function(store.get), "store.get must be function");
    assert(is.function(store.set), "store.set must be function");
    assert(is.function(store.destroy), "store.destroy must be function");
  }

  const ContextStore = opts.ContextStore;
  if (ContextStore) {
    assert(is.class(ContextStore), "ContextStore must be a class");
    assert(is.function(ContextStore.prototype.get), "ContextStore.prototype.get must be function");
    assert(is.function(ContextStore.prototype.set), "ContextStore.prototype.set must be function");
    assert(is.function(ContextStore.prototype.destroy), "ContextStore.prototype.destroy must be function");
  }

  // 用于生成session id
  if (!opts.genid) {
    if (opts.prefix) {
      opts.genid = () => `${opts.prefix}${Date.now()}-${uid.sync(24)}`;
    } else {
      opts.genid = () => `${Date.now()}-${uid.sync(24)}`;
    }
  }

  return opts;
}

/**
 * extend context prototype, add session properties
 *
 * @param  {Object} context koa"s context prototype
 * @param  {Object} opts session options
 *
 * @api private
 */

// 设置app.content的getter和setter,在ctx对象上挂载session等字段
function extendContext(context, opts) {
  Object.defineProperties(context, {
    [CONTEXT_SESSION]: {
      get() {
        if (this[_CONTEXT_SESSION]) {
          return this[_CONTEXT_SESSION];
        }
        this[_CONTEXT_SESSION] = new ContextSession(this, opts); // 初次取值时(getter)会新建一个ContextSession对象
        return this[_CONTEXT_SESSION];
      }
    },
    session: {
      get() {
        return this[CONTEXT_SESSION].get();
      },
      set(val) {
        this[CONTEXT_SESSION].set(val);
      },
      configurable: true
    },
    sessionOptions: {
      get() {
        return this[CONTEXT_SESSION].opts;
      }
    }
  });
}
