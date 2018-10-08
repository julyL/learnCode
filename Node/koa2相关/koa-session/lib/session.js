'use strict';

/**
 * Session model.
 */

class Session {
  /**
   * Session constructor
   * @param {Context} ctx
   * @param {Object} obj
   * @api private
   */

  constructor(ctx, obj) {
    this._ctx = ctx;
    if (!obj) {
      // 用于标记session是新的,有如下3种情况
      // 1. 当原先session不存在  2. 获取到的session未通过opts.valid方法的验证  3.获取到session解码失败(仅在cookie中直接存储session时存在)
      this.isNew = true;
    } else {
      for (const k in obj) {
        // restore maxAge from store
        if (k === '_maxAge')
          this._ctx.sessionOptions.maxAge = obj._maxAge; // 更新_maxAge
        else this[k] = obj[k];
      }
    }
  }

  /**
   * JSON representation of the session.
   *
   * @return {Object}
   * @api public
   */

  toJSON() {
    const obj = {};

    Object.keys(this).forEach(key => {
      // isNew,_ctx是我们自行添加的字段,不是实际session中的值,需要进行过滤
      if (key === 'isNew') return;
      if (key[0] === '_') return;
      obj[key] = this[key];
    });

    return obj;
  }

  /**
   *
   * alias to `toJSON`
   * @api public
   */

  inspect() {
    return this.toJSON();
  }

  /**
   * Return how many values there are in the session object.
   * Used to see if it's 'populated'.
   *
   * @return {Number}
   * @api public
   */

  get length() {
    return Object.keys(this.toJSON()).length;
  }

  /**
   * populated flag, which is just a boolean alias of .length.
   *
   * @return {Boolean}
   * @api public
   */

  get populated() {
    return !!this.length;
  }

  /**
   * get session maxAge
   *
   * @return {Number}
   * @api public
   */

  get maxAge() {
    return this._ctx.sessionOptions.maxAge;
  }

  /**
   * set session maxAge
   *
   * @param {Number}
   * @api public
   */

  set maxAge(val) {
    this._ctx.sessionOptions.maxAge = val;
    // maxAge changed, must save to cookie and store
    this._requireSave = true;
  }

  /**
   * save this session no matter whether it is populated
   *
   * @api public
   */

  save() {
    this._requireSave = true;
  }
}

module.exports = Session;
