## redux笔记

#### state
> 整个应用的 state 被储存在一棵 object tree 中，并且这个 object tree 只存在于唯一一个 store 中.

#### action
> action 是一个用于描述已发生事件的普通对象，唯一改变 state 的方法就是触发 action。
```js
 store.dispatch(action)   // 触发action来改变state
```

---

#### reducer
reducer 就是一个纯函数，接收旧的 state 和 action，返回新的 state。
```js
(previousState, action) => newState
```
> reducer 一定要保持纯净。只要传入参数相同，返回计算得到的下一个 state 就一定相同。没有特殊情况、没有副作用，没有 API 请求、没有变量修改，单纯执行计算。

#### combineReducers
> 拆分Reducer，使得各个子reducer只需要处理state的一部分。combineReducers最终会将各个reducer的处理结果组合成一个新的state

```js
const reducer = combineReducers({
  a: doSomethingWithA,
  b: processB,
  c: c
})

// 等同于
function reducer(state = {}, action) {
  return {
    a: doSomethingWithA(state.a, action),
    b: processB(state.b, action),
    c: c(state.c, action)
  }
}
```

**combineReducers源码**
```js
// 省略部分代码
function combineReducers(reducers) {
    // reducers -> 筛选出值为函数类型的组成 -> finalReducers
    const finalReducerKeys = Object.keys(finalReducers);

    return function combination(state = {}, action) {
        // 判断执行reducer之后state是否改变
        let hasChanged = false

        // 需要根据各个子reducer的返回值来组装的新state对象
        const nextState = {}

        for (let i = 0; i < finalReducerKeys.length; i++) {
            const key = finalReducerKeys[i]
            const reducer = finalReducers[key]

            // 取出state中同名的key,作为一个局部state 传入 reducer中执行。这样reducer中的处理函数不需要处理整个store，只需要处理一个局部state即可。 
            const previousStateForKey = state[key]

            // 执行reducer逻辑返回新的state对象
            const nextStateForKey = reducer(previousStateForKey, action)

            // 根据reducers中子reducer的处理结果 组装成一个完整的state树(子reducer只处理state的一部分)
            nextState[key] = nextStateForKey

            // 判断执行reducer之后state是否变化
            hasChanged = hasChanged || nextStateForKey !== previousStateForKey
        }
        // 如果前后state变化了,则传入新的state,没有变则返回原state对象(此时React不会更新视图)
        return hasChanged ? nextState : state
    }
}
```

#### applyMiddleware(...middlewares)
> 通过“修改dispath方法”,可以实现在原始的dispatch真正发起action之前做一些额外的处理工作，比如记录日志。

```js
const middleware1 = store => next => action => {
  console.log('middleware1 start')
  let result = next(action)
  console.log('middleware1 end')
  return result
}

const middleware2 = store => next => action => {
  console.log('middleware2 start')
  let result = next(action)
  console.log('middleware2 end')
  return result
}

执行dispatch结果如下
middleware1 start => middleware2 start => (执行原生的dispatch) => middleware2 end => middleware1 start
```

#### bindActionCreator(actionCreator, dispatch) 
> 传入的actionCreator可以为action生成函数 或者 对象

```js
// 代码中示例的actionCreator均为action生成函数

// 传函数
bindActionCreator(actionCreator, dispatch) 
=>
function () {
    return dispatch(actionCreator.apply(this, arguments))
}

// 传对象
bindActionCreator({
    key1: actionCreator1,
    key2: actionCreator2,
}, dispatch)
=>
{
    key1: function () {
        return dispatch(actionCreator1.apply(this, arguments))
    },
    key2: function () {
        return dispatch(actionCreator2.apply(this, arguments))
    },
}
```
#### compose(...funcs) 
```js
compose(a, b, c)(args) => a(b(c(args)))   // 执行顺序从右至左
```