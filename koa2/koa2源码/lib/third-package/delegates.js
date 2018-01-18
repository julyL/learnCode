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

Delegator.prototype.method = function(name) {
  var proto = this.proto;
  var target = this.target;
  this.methods.push(name);

  proto[name] = function() {
    // 在ctx上添加方法[name],并且代理给ctx[target][name]方法进行处理. target为response或request
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

Delegator.prototype.getter = function(name) {
  var proto = this.proto;
  var target = this.target;
  this.getters.push(name);

  proto.__defineGetter__(name, function() {
    // ptoto即koa2中的ctx对象, 在ctx上添加name属性,设置getter.当对ctx[name]进行get操作时,实际返回的是ctx[target][name]
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

Delegator.prototype.setter = function(name) {
  var proto = this.proto;
  var target = this.target;
  this.setters.push(name);

  proto.__defineSetter__(name, function(val) {
    // 在ctx上添加name属性,设置setter。 当对ctx[name]进行setter操作时,实际对是ctx[target][name]进行赋值
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
