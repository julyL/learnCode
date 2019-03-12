### pify

[https://www.npmjs.com/package/pify](https://www.npmjs.com/package/pify)


#### pify(input,options)

input可以是对象或者方法
```js

// 方法
pify(fs.readFile)(__filename, 'utf-8').then(res => {
    console.log(res);
})

// 对象
// 对fs对象上所有的方法,根据函数方法名筛选出符合include、exclude匹配规则的进行promiseify
pify(fs).readFile(__filename, 'utf-8').then(res => {
    console.log(res);
})

```

options选项
```js
{
    exclude: [/.+(Sync|Stream)$/],   // 默认排除函数名有中Sync和Stream的函数 (支持字符串和正则2种匹配)
    errorFirst: true,                // 回调函数第一个参数是否为error
    promiseModule: Promise,          // 默认promiseify返回的是原生Promise对象
    include:undefined,               // 仅对函数名匹配include的进行promiseify, 优先级 include> exclude
    excludeMain:undefined,           // 当input为函数时,是否对函数自身进行promiseify
    multiArgs:undefined,             // callback支持传递多个参数,
    errorFirst:undefined,            // 为真表示callback第一个参数为err,此时如果err为真,则该Promise会执行reject
}
```

#### 实现原理
```js
funcA(arg1,arg2,..., function cb(err,res){})

pify(funcA)(arg1,arg2,...).then(res=>{}).catch(err=>{})

// 简单的版本: 会返回一个函数,该函数执行后会返回一个Promise对象。通过将原先fn中的回调函数替换为该Promise对象的resolve方法,原先fn的回调函数执行时,改Promsie也就resolve了
pify = (func) => {
    return (...args) =>{
        return new Promise(resolve,reject) {
            args.push(resolve);
            func.apply(this,args);
        }
    }
}
```

上诉版本有个明显的问题, resolve函数只支持传一个参数, pify内具体实现如下
```js
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
```
pify对于回调函数传多个参数的情况做了处理,通过resolve([arg1,arg2,...])返回多个参数, 并且对第一个参数是error对象，则会根据该error决定是否需要执行reject
