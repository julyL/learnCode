## Vuex

> Vuex 是一个专为 Vue.js 应用程序开发的状态管理模式。它采用集中式存储管理应用的所有组件的状态，并以相应的规则保证状态以一种可预测的方式发生变化。

Vuex中的几个概念:

* state表示状态,是状态数据来源
* getter是对state的扩展,相当于state的计算属性
* mutation类似于事件, 用于改变state的状态(state状态的改变必须是同步)
* action用于触发mutation,可以支持异步操作
* modules用于分割模块

### Vuex插件安装

如下示例：

```html
<div id="app">
    {{$store.state.count}}
</div>
```

```js
import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

const store = new Vuex.Store({
    state: {
        count: 0
    },
    getters: {
        doubleCount(state) {
            return state.count * 2
        }
    },
    mutations: {
        increment(state) {
            state.count++
        }
    },
    actions: {
        increment(ctx) {
            ctx.commit('increment')
        }
    }
})

var vm = new Vue({
    el: "#app",
    store
})

```

Vuex是作为Vue的一个插件存在的,当执行`Vue.use(Vuex)`时，会调用Vuex内部的`install`方法进行插件的安装。
install会执行applyMixin方法。applyMixin会根据vue的版本确定插件混入方式。在Vue2.x版本中,会执行`Vue.mixin({ beforeCreate: vuexInit })`将插件的初始化store操作混入到beforeCreated钩子中。vuexInit实现如下。

```js
// 将Vue中的自定义属性options.store转换为$store
function vuexInit() {
    var options = this.$options;
    if (options.store) {
        this.$store = typeof options.store === 'function'
            ? options.store()
            : options.store;
    } else if (options.parent && options.parent.$store) {
        this.$store = options.parent.$store;
    }
}
```

vueInit做的事就是将自定义属性`this.$options.store`赋值给`this.$store`。这里的this就是vue实例对象,`this.$options.store`就是new Vue时传入的自定义属性store。这样就实现了在Vue实例对象上挂载 **$store对象**

### state

Vuex中的state表示状态，Vuex通过将state代理到一个内部创建vue对象的data属性上的对象，从而实现响应式。

vuex内部会通过resetStoreVM方法创建一个Vue实例对象，并将state赋值给data的$$state, 从而使得$$state属性具备响应式。$$state就是state的代理对象

```js
function resetStoreVM(store, state){
    // store为Store的实例
    store._vm = new Vue({
        data: {
            $$state: state
        }
    });
}
```

接着, 通过Object.defineProperties将state的getter、setter操作代理到`store._vm._data.$$state`(等价于`store._vm.$$state`), 从而使得state具备响应式。

如下所示：

```js
var prototypeAccessors$1 = { state: { configurable: true } };

prototypeAccessors$1.state.get = function () {
    return this._vm._data.$$state
};

prototypeAccessors$1.state.set = function (v) {
    {
        assert(false, "use store.replaceState() to explicit replace store state.");
    }
};

Object.defineProperties(Store.prototype, prototypeAccessors$1);
```

### getter

getter相当于state的计算属性,事实上就是利用Vue的computed进行实现的

```js
function resetStoreVM(store, state, hot) {
    store.getters = {};
    var computed = {};
    var wrappedGetters = store._wrappedGetters;
    // wrappedGetters就是对用户定义的getters进行的一层包装
    forEachValue(wrappedGetters, function (fn, key) {
        computed[key] = partial(fn, store);
        Object.defineProperty(store.getters, key, {
            get: function () { return store._vm[key]; },
            enumerable: true // for local getters
        });
    });
    store._vm = new Vue({
        data: {
            $$state: state
        },
        computed: computed
    });
}
```

和实现state代理一样，getter的代理也是通过执行resetStoreVM方法。store._wrappedGetters就是用户定义的getters,只是进行了一层封装。通过forEachValue遍历所有的getters,将每个getter的回调函数fn赋值给computed变量，最后将computed变量设置为new Vue的computed选项。这样所有对store.getters上getter的访问,都会被代理到$store._vm.computed上对应名称的计算属性。

### mutations与commit

mutation表示一个用于改变state的事件,可以通过commit方法触发mutation。需要注意的是mutation中,state状态的改变必须是同步的。

commit方法的实现如下：

```js
Store.prototype.commit = function commit(_type, _payload, _options) {
    var this$1 = this;

    // commit支持多种形式的参数调用, 对参数进行统一格式化
    var ref = unifyObjectStyle(_type, _payload, _options);
    var type = ref.type;
    var payload = ref.payload;
    var options = ref.options;

    var mutation = { type: type, payload: payload };
    // entry为该mutation绑定的所有事件回调
    var entry = this._mutations[type];
    this._withCommit(function () {
        // 按顺序执行监听该mutation的所有事件
        entry.forEach(function commitIterator(handler) {
            handler(payload);
        });
    });

    // 执行subscribe方法监听的回调
    this._subscribers
        .slice()
        .forEach(function (sub) { return sub(mutation, this$1.state); });
};
```

commit方法支持多种形式的参数传参

```js
store.commit('increment', {
  amount: 10
})

store.commit({
  type: 'increment',
  amount: 10
})
```

会先通过unifyObjectStyle方法进行统一格式化,然后根据mutation名称取到对应的mutation回调函数,接着通过_withCommit方法来执行commit。_withCommit方法的作用是保证vuex的严格模式上,所以的state修改都必须通过commit来实现。

```js
Store.prototype._withCommit = function _withCommit(fn) {
    // this._committing默认为false
    var committing = this._committing;
    // 设为true,标记通过mutation进行state修改
    this._committing = true;
    // fn对应mutation的函数，当fn内部改变state时，在严格模式下会同步检测this.__committing是否为true
    fn();
    // 执行完mutation后进行复原
    this._committing = committing;
};

// 严格模式下state变化时，同步检测_committing是否为true。
// 只有通过commit方法修改state时, _committing才为true
function enableStrictMode(store) {
    store._vm.$watch(function () { return this._data.$$state }, function () {
        {
            assert(store._committing, "do not mutate vuex store state outside mutation handlers.");
        }
    }, { deep: true, sync: true });
}
```

_withCommit方法会在执行真正的commit前,设置this._committing = true。如果Vuex设置了严格模式,会执行enableStrictMode方法，监听state的变化。当state发生修改时，会同步触发watch回调,检测_committing是否true。如果严格模式下，不是通过commit方法修改state，将会报错。

### action与dispatch

Action 类似于 mutation，内部可以执行commit触发mutation。Action可以通过dispatch触发，并且可以用于处理异步操作。**dispatch会始终返回一个Promise。**

```js
Store.prototype.dispatch = function dispatch(_type, _payload) {
    // Vuex会处理action,这里取到的action必然是一个Promsie对象
    var entry = this._actions[type];

    var result = entry.length > 1
        ? Promise.all(entry.map(function (handler) { return handler(payload); }))
        : entry[0](payload);

    return result;
};
```

当定义了多个同名的action时,dispatch会返回Promise.all的结果,这样就可以在所有action都resolve之后再进行操作。
