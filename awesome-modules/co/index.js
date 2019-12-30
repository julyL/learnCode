/**
 * slice() reference.
 */

var slice = Array.prototype.slice;

/**
 * Expose `co`.
 */

module.exports = co['default'] = co.co = co;

/**
 * Wrap the given generator `fn` into a
 * function that returns a promise.
 * This is a separate function so that
 * every `co()` call doesn't create a new,
 * unnecessary closure.
 *
 * @param {GeneratorFunction} fn
 * @return {Function}
 * @api public
 */

co.wrap = function (fn) {
    createPromise.__generatorFunction__ = fn;
    return createPromise;
    function createPromise() {
        return co.call(this, fn.apply(this, arguments));
    }
};

/**
 * Execute the generator function or a generator
 * and return a promise.
 *
 * @param {Function} fn
 * @return {Promise}
 * @api public
 */

function co(gen) {
    var ctx = this;
    var args = slice.call(arguments, 1);

    // we wrap everything in a promise to avoid promise chaining,
    // which leads to memory leak errors.
    // see https://github.com/tj/co/issues/180
    return new Promise(function (resolve, reject) {
        // 执行Generator函数，返回迭代器对象
        if (typeof gen === 'function') gen = gen.apply(ctx, args);
        if (!gen || typeof gen.next !== 'function') return resolve(gen);

        // 内部会第一次调用gen.next，开始执行Generator
        onFulfilled();

        /**
         * @param {Mixed} res
         * @return {Promise}
         * @api private
         */

        function onFulfilled(res) {
            var ret;
            try {
                ret = gen.next(res);
            } catch (e) {
                // 如果Generator内部抛出的错误，直接reject当前Promsie,停止后续执行
                return reject(e);
            }
            // next内部会递归调用next方法
            next(ret);
            return null;
        }

        /**
         * @param {Error} err
         * @return {Promise}
         * @api private
         */

        function onRejected(err) {
            var ret;
            try {
                // 当yield后面的Promsie状态为reject时，执行gen.throw主动在抛出错误,yield语句的结果变为了 throw(err)
                ret = gen.throw(err);
            } catch (e) {
                // 如果这个yield没有进行try catch,那么将最终导致Generator流程中断，当前Promise以这个错误作为拒因进行reject
                return reject(e);
            }
            // yield进行了try catch,则继续后续流程
            next(ret);
        }

        /**
         * Get the next value in the generator,
         * return a promise.
         *
         * @param {Object} ret
         * @return {Promise}
         * @api private
         */

        function next(ret) {
            // done为true，表示Generator已经执行结束, 将结果作为resolve的值
            if (ret.done) return resolve(ret.value);
            // 将ret.value转换为Promsie，调用call是为了让内部函数的this都和调用co方法时保持一致（否则this指向将发生错误）
            var value = toPromise.call(ctx, ret.value);
            // 通过then方法，当Promsie状态变化时，内部会自动调用next方法 从而达到自动执行Generator的效果。
            if (value && isPromise(value)) return value.then(onFulfilled, onRejected);
            return onRejected(new TypeError('You may only yield a function, promise, generator, array, or object, '
                + 'but the following object was passed: "' + String(ret.value) + '"'));
        }
    });
}

/**
 * Convert a `yield`ed value into a promise.
 *
 * @param {Mixed} obj
 * @return {Promise}
 * @api private
 */

// 将obj转换为一个Promsie
// 1. obj不存在则直接返回，会进行报错
// 2. Promsie对象不需要处理直接返回
// 3. 生成器函数 通过co方法转换为Promsie返回
// 4. 将callback方式转换为Promsie返回，callback(err,data)
// 5. obj为数组或对象时，返回一个Promsie。当obj的每个key（可能为Promsie）都resolve之后再resolve这个Promise。
function toPromise(obj) {
    if (!obj) return obj;
    if (isPromise(obj)) return obj;
    if (isGeneratorFunction(obj) || isGenerator(obj)) return co.call(this, obj);
    if ('function' == typeof obj) return thunkToPromise.call(this, obj);
    if (Array.isArray(obj)) return arrayToPromise.call(this, obj);
    if (isObject(obj)) return objectToPromise.call(this, obj);
    return obj;
}

/**
 * Convert a thunk to a promise.
 *
 * @param {Function}
 * @return {Promise}
 * @api private
 */
// 将callback(err, data)风格转换为Promsie 
function thunkToPromise(fn) {
    var ctx = this;
    return new Promise(function (resolve, reject) {
        fn.call(ctx, function (err, res) {
            if (err) return reject(err);
            // 处理参数超过2个情况
            if (arguments.length > 2) res = slice.call(arguments, 1);
            resolve(res);
        });
    });
}

/**
 * Convert an array of "yieldables" to a promise.
 * Uses `Promise.all()` internally.
 *
 * @param {Array} obj
 * @return {Promise}
 * @api private
 */

function arrayToPromise(obj) {
    return Promise.all(obj.map(toPromise, this));
}

/**
 * Convert an object of "yieldables" to a promise.
 * Uses `Promise.all()` internally.
 *
 * @param {Object} obj
 * @return {Promise}
 * @api private
 */

function objectToPromise(obj) {
    var results = new obj.constructor();
    var keys = Object.keys(obj);
    var promises = [];
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var promise = toPromise.call(this, obj[key]);
        if (promise && isPromise(promise)) defer(promise, key);
        else results[key] = obj[key];
    }
    return Promise.all(promises).then(function () {
        return results;
    });

    function defer(promise, key) {
        // predefine the key in the result
        results[key] = undefined;
        promises.push(promise.then(function (res) {
            results[key] = res;
        }));
    }
}

/**
 * Check if `obj` is a promise.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isPromise(obj) {
    return 'function' == typeof obj.then;
}

/**
 * Check if `obj` is a generator.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

function isGenerator(obj) {
    return 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

/**
 * Check if `obj` is a generator function.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

function isGeneratorFunction(obj) {
    var constructor = obj.constructor;
    if (!constructor) return false;
    if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) return true;
    return isGenerator(constructor.prototype);
}

/**
 * Check for plain object.
 *
 * @param {Mixed} val
 * @return {Boolean}
 * @api private
 */

function isObject(val) {
    return Object == val.constructor;
}