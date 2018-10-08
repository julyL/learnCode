'use strict';

const debug = require('debug')('koa-session:context');
const Session = require('./session');
const util = require('./util');

const ONE_DAY = 24 * 60 * 60 * 1000;

class ContextSession {
  /**
   * context session constructor
   * @api public
   */

  constructor(ctx, opts) {
    this.ctx = ctx;
    this.app = ctx.app;
    this.opts = opts || {};
    this.store = this.opts.ContextStore ? new this.opts.ContextStore(ctx) : this.opts.store;
  }

  /**
   * internal logic of `ctx.session`
   * @return {Session} session object
   *
   * @api public
   */
  // 读取session
  get() {
    const session = this.session;
    // already retrieved
    if (session) return session;
    // unset
    if (session === false) return null;

    // cookie session store
    if (!this.store) this.initFromCookie(); // 从cookie中取值,设置session值
    return this.session;
  }

  /**
   * internal logic of `ctx.session=`
   * @param {Object} val session object
   *
   * @api public
   */

  set(val) {
    if (val === null) {
      this.session = false;
      return;
    }
    if (typeof val === 'object') {
      // use the original `externalKey` if exists to avoid waste storage
      this.create(val, this.externalKey);
      return;
    }
    throw new Error('this.session can only be set as null or an object.');
  }

  /**
   * init session from external store
   * will be called in the front of session middleware
   *
   * @api public
   */
  // 外部存储时,设置session值 
  async initFromExternal() {
    debug('init from external');
    const ctx = this.ctx;
    const opts = this.opts;

    // 取到client请求携带cookie值
    const externalKey = ctx.cookies.get(opts.key, opts);    
    debug('get external key from cookie %s', externalKey);

    // 没有携带cookie
    if (!externalKey) {     
      // create a new `externalKey`
      this.create();
      return;
    }

    // 从外部取到的cookie不合法
    const json = await this.store.get(externalKey, opts.maxAge, { rolling: opts.rolling });
    if (!this.valid(json, externalKey)) {
      // create a new `externalKey`
      this.create();
      return;
    }

    // 如果client端的cookie有效则将cookie值用于新建session
    this.create(json, externalKey);
    this.prevHash = util.hash(this.session.toJSON());
  }

  /**
   * init session from cookie
   * @api private
   */
  // 首先判断client请求是否携带了cookie,没有则server端生成session并通过ctx.cookies.set设置返回的cookie
  // 如果client端的cookie经过判断是有效的则使用cookie新建session
  initFromCookie() {
    debug('init from cookie');
    const ctx = this.ctx;
    const opts = this.opts;

    const cookie = ctx.cookies.get(opts.key, opts);
    if (!cookie) {
      this.create();
      return;
    }

    let json;
    debug('parse %s', cookie);
    try {
      json = opts.decode(cookie);
    } catch (err) {
      // backwards compatibility:
      // create a new session if parsing fails.
      // new Buffer(string, 'base64') does not seem to crash
      // when `string` is not base64-encoded.
      // but `JSON.parse(string)` will crash.
      debug('decode %j error: %s', cookie, err);
      if (!(err instanceof SyntaxError)) {
        // clean this cookie to ensure next request won't throw again
        ctx.cookies.set(opts.key, '', opts);
        // ctx.onerror will unset all headers, and set those specified in err
        err.headers = {
          'set-cookie': ctx.response.get('set-cookie')
        };
        throw err;
      }
      this.create();
      return;
    }

    debug('parsed %j', json);

    if (!this.valid(json)) {
      this.create();
      return;
    }

    // support access `ctx.session` before session middleware
    this.create(json);
    this.prevHash = util.hash(this.session.toJSON());
  }

  /**
   * verify session(expired or )
   * @param  {Object} value session object
   * @param  {Object} key session externalKey(optional)
   * @return {Boolean} valid
   * @api private
   */

  valid(value, key) {
    const ctx = this.ctx;
    if (!value) {
      this.emit('missed', { key, value, ctx });
      return false;
    }

    // 判断session是否过期
    if (value._expire && value._expire < Date.now()) {
      debug('expired session');
      this.emit('expired', { key, value, ctx });
      return false;
    }

    // 执行opts.valid方法判断session有效性
    const valid = this.opts.valid;
    if (typeof valid === 'function' && !valid(ctx, value)) {
      // valid session value fail, ignore this session
      debug('invalid session');
      this.emit('invalid', { key, value, ctx });
      return false;
    }
    return true;
  }

  /**
   * @param {String} event event name
   * @param {Object} data event data
   * @api private
   */
  emit(event, data) {
    setImmediate(() => {
      this.app.emit(`session:${event}`, data);
    });
  }

  /**
   * create a new session and attach to ctx.sess
   *
   * @param {Object} [val] session data
   * @param {String} [externalKey] session external key
   * @api private
   */

  create(val, externalKey) {
    debug('create session with val: %j externalKey: %s', val, externalKey);
    if (this.store) this.externalKey = externalKey || this.opts.genid();
    this.session = new Session(this.ctx, val);
  }

  /**
   * Commit the session changes or removal.
   *
   * @api public
   */

  async commit() {
    const session = this.session;
    const opts = this.opts;
    const ctx = this.ctx;

    // not accessed
    if (undefined === session) return;

    // removed
    if (session === false) {
      await this.remove();
      return;
    }

    const reason = this._shouldSaveSession();
    debug('should save session: %s', reason);
    if (!reason) return;

    // 触发beforeSave钩子
    if (typeof opts.beforeSave === 'function') {
      debug('before save');
      opts.beforeSave(ctx, session);
    }
    const changed = reason === 'changed';
    await this.save(changed);
  }

  // 'force', 'changed', 'rolling', 'renew' 等对应的处理,需要通过设置opts.store 并在store.set方法中实现
  _shouldSaveSession() {
    const prevHash = this.prevHash; // session内容的hash值,用于判断内容是否发生改变
    const session = this.session;

    // force save session when `session._requireSave` set
    if (session._requireSave) return 'force';

    // do nothing if new and not populated
    const json = session.toJSON();
    if (!prevHash && !Object.keys(json).length) return '';

    // 判断session内容是否发生改变
    const changed = prevHash !== util.hash(json); 
    if (changed) return 'changed';

    // save if opts.rolling set
    if (this.opts.rolling) return 'rolling';

    // otps.renew为真时,如果当前时间超过session有效期的一半,则返回'renew'
    if (this.opts.renew) {
      const expire = session._expire;
      const maxAge = session.maxAge;
      // renew when session will expired in maxAge / 2
      if (expire && maxAge && expire - Date.now() < maxAge / 2) return 'renew';
    }

    return '';
  }

  /**
   * remove session
   * @api private
   */

  async remove() {
    const opts = this.opts;
    const ctx = this.ctx;
    const key = opts.key;
    const externalKey = this.externalKey;

    // 销毁存储的session并设置cookie为空
    if (externalKey) await this.store.destroy(externalKey);
    ctx.cookies.set(key, '', opts);
  }

  /**
   * save session
   * @api private
   */

  async save(changed) {
    const opts = this.opts;
    const key = opts.key;
    const externalKey = this.externalKey;
    let json = this.session.toJSON();
    // set expire for check
    let maxAge = opts.maxAge ? opts.maxAge : ONE_DAY; // 设置session有效期,默认1天
    if (maxAge === 'session') {
      // do not set _expire in json if maxAge is set to 'session'
      // also delete maxAge from options
      opts.maxAge = undefined;
    } else {
      // 由于每次更新session时都会重新设置过期时间,所以session不需要手动设置有效期
      json._expire = maxAge + Date.now();   
      json._maxAge = maxAge;
    }

    // 更新外部存储的session值
    if (externalKey) {
      debug('save %j to external key %s', json, externalKey);
      if (typeof maxAge === 'number') {
        // ensure store expired after cookie
        maxAge += 10000;
      }
      await this.store.set(externalKey, json, maxAge, {
        changed,
        rolling: opts.rolling
      });
      // 外部存储session时,client端的cookie仅存储用于session取值的key即可
      this.ctx.cookies.set(key, externalKey, opts);  
      return;
    }

    // save to cookie
    debug('save %j to cookie', json);
    json = opts.encode(json);
    debug('save %s', json);

    // 在cookie中直接存储session
    this.ctx.cookies.set(key, json, opts); 
  }
}

module.exports = ContextSession;
