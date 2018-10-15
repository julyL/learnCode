import compose from './compose'

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */
export default function applyMiddleware(...middlewares) {
  // 在createStore方法内部是这样调用applyMiddleware的,enhancer就是applyMiddleware
  // enhancer(createStore)(reducer, preloadedState); 
  return (createStore) => (...args) => {
    // redux中间件扩展最为核心的地方： 
    // 通过store.dispatch获取到原生dispath方法，中间件通过对dispatch进行重写来实现扩展功能，一个中间件执行之后会将重写的dispatch方法交给下一个中间件处理
    const store = createStore(...args)
    let dispatch = store.dispatch
    let chain = []

    // 需要传入中间件的2个方法
    const middlewareAPI = {
      getState: store.getState,
      dispatch: (...args) => dispatch(...args)
    }

    // 按照顺序链式调用中间件,中间件中的代码只能是同步的才能保证执行顺序(不同于Koa中间件)
    chain = middlewares.map(middleware => middleware(middlewareAPI))

    // compose(a, b, c)(store.dispatch) => a(b(c(store.dispatch)))  
    dispatch = compose(...chain)(store.dispatch)
    // 从右至左调用, 上一个中间件返回的dispatch传入给下一个中间件进行处理
    // (中间件可以重写dispatch方法，从而实现功能扩展)

    return {
      ...store,
      dispatch
    }
  }
}