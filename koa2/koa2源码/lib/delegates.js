/**
 * Expose `Delegator`.
 */

module.exports = Delegator;

/**
 * Initialize a delegator.
 *
 * @param {Object} proto
 * @param {String} target
 * @api public
 */

// 调用方式 Delegator(ctx,'response')  Delegator(ctx,'request')
// proto就是koa2中的ctx对象

function Delegator(proto, target) {
  if (!(this instanceof Delegator)) return new Delegator(proto, target);
  this.proto = proto;
  this.target = target;
  this.methods = [];
  this.getters = [];
  this.setters = [];
  this.fluents = [];
}

/**
 * Delegate method `name`.
 *
 * @param {String} name
 * @return {Delegator} self
 * @api public
 */

/*
  将ctx[name]对应的方法代理到ctx[target][name]上
  栗子:  delegate(proto, 'response').method('attachment')  =>   ctx.attachment = ctx.response.attachment
*/
Delegator.prototype.method = function(name) {
  var proto = this.proto;
  var target = this.target;
  this.methods.push(name);

  proto[name] = function() {
    return this[target][name].apply(this[target], arguments);
  };

  return this;
};

/**
 * Delegator accessor `name`.
 *
 * @param {String} name
 * @return {Delegator} self
 * @api public
 */

// 通过设置getter和setter对name属性进行代理, 例如: 将ctx.status的取值和赋值操作代理到 ctx.response.status上
Delegator.prototype.access = function(name) {
  return this.getter(name).setter(name);
};

/**
 * Delegator getter `name`.
 *
 * @param {String} name
 * @return {Delegator} self
 * @api public
 */

//  设置getter, 例如:对ctx.status进行get操作,实际返回的值为 ctx.response.status
Delegator.prototype.getter = function(name) {
  var proto = this.proto;
  var target = this.target;
  this.getters.push(name);

  proto.__defineGetter__(name, function() {
    return this[target][name];
  });

  return this;
};

/**
 * Delegator setter `name`.
 *
 * @param {String} name
 * @return {Delegator} self
 * @api public
 */

//  设置setter, 例如:对ctx.status进行set操作,实际设置的值为 ctx.response.status
Delegator.prototype.setter = function(name) {
  var proto = this.proto;
  var target = this.target;
  this.setters.push(name);

  proto.__defineSetter__(name, function(val) {
    return (this[target][name] = val);
  });

  return this;
};

/**
 * Delegator fluent accessor
 *
 * @param {String} name
 * @return {Delegator} self
 * @api public
 */

Delegator.prototype.fluent = function(name) {
  var proto = this.proto;
  var target = this.target;
  this.fluents.push(name);

  proto[name] = function(val) {
    if ("undefined" != typeof val) {
      this[target][name] = val;
      return this;
    } else {
      return this[target][name];
    }
  };

  return this;
};
