// Github: https://github.com/sindresorhus/pify 
// 版本4.0.0
'use strict';

// processFn是进行promiseify的核心方法
// processFn会返回一个函数,该函数执行后会返回一个Promise对象。通过将原先fn中的回调函数替换为该Promise对象的resolve方法,原先fn的回调函数执行时,改Promsie也就resolve了
const processFn = (fn, options) => function (...args) {
    // 设置使用的Promise实现
    const P = options.promiseModule;

    return new P((resolve, reject) => {
        // 为真表示原fn函数的回调函数支持多个参数传递,此时直接将多个参数放入一个数组,通过resolve(...args)传递
        if (options.multiArgs) {
            args.push((...result) => {
                // 如果回调的第一个参数为error并且为真值,则直接reject
                // 没有error或者error为假值,直接移除error参数, 很精妙
                if (options.errorFirst) {
                    if (result[0]) {
                        reject(result);
                    } else {
                        // 没有error直接移除
                        result.shift();
                        resolve(result);
                    }
                } else {
                    resolve(result);
                }
            });
        } else if (options.errorFirst) {
            args.push((error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        } else {
            args.push(resolve);
        }

        fn.apply(this, args);
    });
};

module.exports = (input, options) => {
    options = Object.assign({
        exclude: [/.+(Sync|Stream)$/], // 默认排除函数名有中Sync和Stream的函数
        errorFirst: true, // 回调函数第一个参数是否为error
        promiseModule: Promise // 默认promiseify返回的是原生Promise对象
    }, options);

    const objType = typeof input;
    if (!(input !== null && (objType === 'object' || objType === 'function'))) {
        throw new TypeError(`Expected \`input\` to be a \`Function\` or \`Object\`, got \`${input === null ? 'null' : objType}\``);
    }

    // 用于判断当前key值是否需要promiseify
    // include和exclude为数组,支持字符串和正则匹配,include优先级大于exclude
    const filter = key => {
        const match = pattern => typeof pattern === 'string' ? key === pattern : pattern.test(key);
        return options.include ? options.include.some(match) : !options.exclude.some(match);
    };

    let ret;
    //  根据"原对象"来生成一个"新对象"(用于promiseify后作为返回值)
    if (objType === 'function') {
        ret = (...args) => options.excludeMain ? input(...args) : processFn(input, options)(...args);
    } else {
        ret = Object.create(Object.getPrototypeOf(input));
    }

    // 在"新对象"的属性上筛选出需要promiseify的函数并进行promiseify
    for (const key in input) { // eslint-disable-line guard-for-in
        const property = input[key];
        ret[key] = typeof property === 'function' && filter(key) ? processFn(property, options) : property;
    }

    return ret;
};