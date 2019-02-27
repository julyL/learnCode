const {
    createStore,
    applyMiddleware
} = require("redux");

const middleware1 = store => (next) => {
    console.log('excute middleware1');
    return function M1(action) {
        console.log('middleware1 start')
        let result = next(action)
        console.log('middleware1 end')
        return result
    }
}
const middleware2 = store => (next) => {
    console.log('excute middleware2');
    return function M2(action) {
        console.log('middleware2 start')
        let result = next(action)
        console.log('middleware2 end')
        return result
    }
}


var initState = {
    age: 24
}

function reducer(state = initState, action) {
    switch (action.type) {
        case 'ADD':
            return { ...state,
                age: state.age + 1
            };
        default:
            return state;
    }
}

var middleware = applyMiddleware(middleware1, middleware2);

var store = createStore(reducer, initState, middleware);

const unsubscribe = store.subscribe(() =>
    console.log("\nsubscribe:", store.getState())
)
console.log('start dispath');
store.dispatch({
    type: "ADD"
})

/*

log:
excute middleware2
excute middleware1
start dispath
middleware1 start
middleware2 start

subscribe: {
    age: 25
}
middleware2 end


解释: 实际上middleware2先于middleware1执行。 执行applyMiddleware之后我们获得的dispatch为最后一个中间件返回的dispath(也就是M1)


*/