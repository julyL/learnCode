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

  opts = formatOpts(opts); //  进行默认设置
  extendContext(app.context, opts); //  在ctx的原型对象上添加新属性 ( app.context === ctx.__proto__ )

  return async function session(ctx, next) {
    const sess = ctx[CONTEXT_SESSION];
    if (sess.store) await sess.initFromExternal(); //  从外部存储中获取session。需设置opts.store对象并实现get,set,destory方法
    try {
      await next();
    } catch (err) {
      throw err;
    } finally {
      await sess.commit(); // 此时后续的中间件都调用完毕,对于session的处理逻辑都已经执行完了。由于所有对session的操作都是通过ctx.session进行的。所以最后需要用ctx.session的值来更新session
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
/* 
基础补充: 
Object.defineProperties(obj, props) 根据props设置obj的属性,props的key为obj需要设置的属性,val为属性描述符 类似 Object.defineProperty(obj, prop, 属性描述符)

CONTEXT_SESSION 是Symbol类型, Symbol类型常用于设置对象的属性(表示这个对象的属性名是唯一的,不用担心重复命名),使用时外面必须用[]包裹
Symbol("name") !== Symbol("name")  Symbol对象本身是惟一的,"name"是给这个Symbol对象取的名称(用于调试时区分Symbol对象,可相同)
*/
// 对context(即ctx.__proto__)的属性设置getter和setter,当处理ctx.session时,实际操作的是this[_CONTEXT_SESSION]
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
