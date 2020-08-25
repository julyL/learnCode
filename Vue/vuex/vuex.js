/**
 * vuex v3.1.3
 * (c) 2020 Evan You
 * @license MIT
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
            (global = global || self, global.Vuex = factory());
}(this, (function () {
    'use strict';

    // Vue2.0 中通过mixin将vuexInit 注入到beforeCreate事件中
    function applyMixin(Vue) {
        var version = Number(Vue.version.split('.')[0]);

        if (version >= 2) {
            Vue.mixin({ beforeCreate: vuexInit });
        } else {
            // override init and inject vuex init procedure
            // for 1.x backwards compatibility.
            var _init = Vue.prototype._init;
            Vue.prototype._init = function (options) {
                if (options === void 0) options = {};

                options.init = options.init
                    ? [vuexInit].concat(options.init)
                    : vuexInit;
                _init.call(this, options);
            };
        }

        /**
         * Vuex init hook, injected into each instances init hooks list.
         */
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
    }

    var target = typeof window !== 'undefined'
        ? window
        : typeof global !== 'undefined'
            ? global
            : {};
    var devtoolHook = target.__VUE_DEVTOOLS_GLOBAL_HOOK__;

    function devtoolPlugin(store) {
        if (!devtoolHook) { return }

        store._devtoolHook = devtoolHook;

        devtoolHook.emit('vuex:init', store);

        devtoolHook.on('vuex:travel-to-state', function (targetState) {
            store.replaceState(targetState);
        });

        store.subscribe(function (mutation, state) {
            devtoolHook.emit('vuex:mutation', mutation, state);
        });
    }

    /**
     * Get the first item that pass the test
     * by second argument function
     *
     * @param {Array} list
     * @param {Function} f
     * @return {*}
     */

    /**
     * forEach for object
     */
    function forEachValue(obj, fn) {
        Object.keys(obj).forEach(function (key) { return fn(obj[key], key); });
    }

    function isObject(obj) {
        return obj !== null && typeof obj === 'object'
    }

    function isPromise(val) {
        return val && typeof val.then === 'function'
    }

    function assert(condition, msg) {
        if (!condition) { throw new Error(("[vuex] " + msg)) }
    }

    function partial(fn, arg) {
        return function () {
            return fn(arg)
        }
    }

    // Base data struct for store's module, package with some attribute and method
    var Module = function Module(rawModule, runtime) {
        this.runtime = runtime;
        // Store some children item
        this._children = Object.create(null);
        // Store the origin module object which passed by programmer
        this._rawModule = rawModule;
        var rawState = rawModule.state;

        // Store the origin module's state
        this.state = (typeof rawState === 'function' ? rawState() : rawState) || {};
    };

    var prototypeAccessors = { namespaced: { configurable: true } };

    prototypeAccessors.namespaced.get = function () {
        return !!this._rawModule.namespaced
    };

    Module.prototype.addChild = function addChild(key, module) {
        this._children[key] = module;
    };

    Module.prototype.removeChild = function removeChild(key) {
        delete this._children[key];
    };

    Module.prototype.getChild = function getChild(key) {
        return this._children[key]
    };

    Module.prototype.update = function update(rawModule) {
        this._rawModule.namespaced = rawModule.namespaced;
        if (rawModule.actions) {
            this._rawModule.actions = rawModule.actions;
        }
        if (rawModule.mutations) {
            this._rawModule.mutations = rawModule.mutations;
        }
        if (rawModule.getters) {
            this._rawModule.getters = rawModule.getters;
        }
    };

    Module.prototype.forEachChild = function forEachChild(fn) {
        forEachValue(this._children, fn);
    };

    Module.prototype.forEachGetter = function forEachGetter(fn) {
        if (this._rawModule.getters) {
            forEachValue(this._rawModule.getters, fn);
        }
    };

    Module.prototype.forEachAction = function forEachAction(fn) {
        if (this._rawModule.actions) {
            forEachValue(this._rawModule.actions, fn);
        }
    };

    Module.prototype.forEachMutation = function forEachMutation(fn) {
        if (this._rawModule.mutations) {
            forEachValue(this._rawModule.mutations, fn);
        }
    };

    Object.defineProperties(Module.prototype, prototypeAccessors);

    var ModuleCollection = function ModuleCollection(rawRootModule) {
        // register root module (Vuex.Store options)
        // debugger;
        this.register([], rawRootModule, false);
    };

    ModuleCollection.prototype.get = function get(path) {
        return path.reduce(function (module, key) {
            return module.getChild(key)
        }, this.root)
    };

    // 返回根module到当前module所有namespace为true, namespaced+'/'组成的路径
    ModuleCollection.prototype.getNamespace = function getNamespace(path) {
        var module = this.root;
        return path.reduce(function (namespace, key) {
            module = module.getChild(key);
            return namespace + (module.namespaced ? key + '/' : '')
        }, '')
    };

    ModuleCollection.prototype.update = function update$1(rawRootModule) {
        update([], this.root, rawRootModule);
    };

    ModuleCollection.prototype.register = function register(path, rawModule, runtime) {
        var this$1 = this;
        if (runtime === void 0) runtime = true;

        {
            assertRawModule(path, rawModule);
        }

        var newModule = new Module(rawModule, runtime);
        if (path.length === 0) {
            this.root = newModule;
        } else {
            // 将当前module放入父级module的_children中, 建立module的父子级关系
            var parent = this.get(path.slice(0, -1));
            parent.addChild(path[path.length - 1], newModule);
        }

        // register nested modules
        if (rawModule.modules) {
            forEachValue(rawModule.modules, function (rawChildModule, key) {
                this$1.register(path.concat(key), rawChildModule, runtime);
            });
        }
    };

    ModuleCollection.prototype.unregister = function unregister(path) {
        var parent = this.get(path.slice(0, -1));
        var key = path[path.length - 1];
        if (!parent.getChild(key).runtime) { return }

        parent.removeChild(key);
    };

    function update(path, targetModule, newModule) {
        {
            assertRawModule(path, newModule);
        }

        // update target module
        targetModule.update(newModule);

        // update nested modules
        if (newModule.modules) {
            for (var key in newModule.modules) {
                if (!targetModule.getChild(key)) {
                    {
                        console.warn(
                            "[vuex] trying to add a new module '" + key + "' on hot reloading, " +
                            'manual reload is needed'
                        );
                    }
                    return
                }
                update(
                    path.concat(key),
                    targetModule.getChild(key),
                    newModule.modules[key]
                );
            }
        }
    }

    var functionAssert = {
        assert: function (value) { return typeof value === 'function'; },
        expected: 'function'
    };

    var objectAssert = {
        assert: function (value) {
            return typeof value === 'function' ||
                (typeof value === 'object' && typeof value.handler === 'function');
        },
        expected: 'function or object with "handler" function'
    };

    var assertTypes = {
        getters: functionAssert,
        mutations: functionAssert,
        actions: objectAssert
    };

    // 这里rawModule对应new Vuex.Store(options)的options
    function assertRawModule(path, rawModule) {
        Object.keys(assertTypes).forEach(function (key) {
            if (!rawModule[key]) { return }

            var assertOptions = assertTypes[key];
            // 遍历rawModule的getters、mutations、actions对象，确保每个val都必须是函数
            forEachValue(rawModule[key], function (value, type) {
                assert(
                    assertOptions.assert(value),
                    makeAssertionMessage(path, key, type, value, assertOptions.expected)
                );
            });
        });
    }

    function makeAssertionMessage(path, key, type, value, expected) {
        var buf = key + " should be " + expected + " but \"" + key + "." + type + "\"";
        if (path.length > 0) {
            buf += " in module \"" + (path.join('.')) + "\"";
        }
        buf += " is " + (JSON.stringify(value)) + ".";
        return buf
    }

    var Vue; // bind on install

    var Store = function Store(options) {
        debugger;
        var this$1 = this;
        if (options === void 0) options = {};

        // Auto install if it is not done yet and `window` has `Vue`.
        // To allow users to avoid auto-installation in some cases,
        // this code should be placed here. See #731
        if (!Vue && typeof window !== 'undefined' && window.Vue) {
            install(window.Vue);
        }

        {
            assert(Vue, "must call Vue.use(Vuex) before creating a store instance.");
            assert(typeof Promise !== 'undefined', "vuex requires a Promise polyfill in this browser.");
            assert(this instanceof Store, "store must be called with the new operator.");
        }

        var plugins = options.plugins; if (plugins === void 0) plugins = [];
        var strict = options.strict; if (strict === void 0) strict = false;

        // store internal state
        // 用于strict: true时，判断state是否由mutation修改
        this._committing = false;
        // 存储所有注册的 actions  key为 namespace + actionName (无命名空间namespace为'')
        this._actions = Object.create(null);
        this._actionSubscribers = [];
        // 存储所有注册的 mutations
        this._mutations = Object.create(null);
        // 存储所有注册的 getters
        this._wrappedGetters = Object.create(null);
        this._modules = new ModuleCollection(options);
        // 存储对象，防止命名空间重复声明
        this._modulesNamespaceMap = Object.create(null);
        // 存储 subscribe 订阅的事件
        this._subscribers = [];
        // 用于 watch 方法
        this._watcherVM = new Vue();
        this._makeLocalGettersCache = Object.create(null);

        // bind commit and dispatch to self
        var store = this;
        var ref = this;
        var dispatch = ref.dispatch;
        var commit = ref.commit;

        // 绑定dispatch、commit的this指向为store
        this.dispatch = function boundDispatch(type, payload) {
            return dispatch.call(store, type, payload)
        };
        this.commit = function boundCommit(type, payload, options) {
            return commit.call(store, type, payload, options)
        };

        // strict mode
        this.strict = strict;

        var state = this._modules.root.state;

        // init root module.
        // this also recursively registers all sub-modules
        // and collects all module getters inside this._wrappedGetters
        installModule(this, state, [], this._modules.root);

        // initialize the store vm, which is responsible for the reactivity
        // (also registers _wrappedGetters as computed properties)
        resetStoreVM(this, state);

        // apply plugins
        plugins.forEach(function (plugin) { return plugin(this$1); });

        var useDevtools = options.devtools !== undefined ? options.devtools : Vue.config.devtools;
        if (useDevtools) {
            devtoolPlugin(this);
        }
    };

    var prototypeAccessors$1 = { state: { configurable: true } };

    prototypeAccessors$1.state.get = function () {
        return this._vm._data.$$state
    };

    prototypeAccessors$1.state.set = function (v) {
        {
            assert(false, "use store.replaceState() to explicit replace store state.");
        }
    };

    Store.prototype.commit = function commit(_type, _payload, _options) {
        var this$1 = this;

        // check object-style commit
        // commit支持多种形式的参数调用, 对参数进行统一格式化
        var ref = unifyObjectStyle(_type, _payload, _options);
        var type = ref.type;
        var payload = ref.payload;
        var options = ref.options;

        var mutation = { type: type, payload: payload };
        // entry为该mutation绑定的所有事件回调
        var entry = this._mutations[type];
        if (!entry) {
            {
                console.error(("[vuex] unknown mutation type: " + type));
            }
            return
        }
        this._withCommit(function () {
            // 按顺序执行监听该mutation的所有事件
            entry.forEach(function commitIterator(handler) {
                handler(payload);
            });
        });

        // 执行subscribe方法监听的回调
        this._subscribers
            .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
            .forEach(function (sub) { return sub(mutation, this$1.state); });

        if (
            options && options.silent
        ) {
            console.warn(
                "[vuex] mutation type: " + type + ". Silent option has been removed. " +
                'Use the filter functionality in the vue-devtools'
            );
        }
    };

    Store.prototype.dispatch = function dispatch(_type, _payload) {
        var this$1 = this;

        // check object-style dispatch
        var ref = unifyObjectStyle(_type, _payload);
        var type = ref.type;
        var payload = ref.payload;

        var action = { type: type, payload: payload };
        var entry = this._actions[type];
        if (!entry) {
            {
                console.error(("[vuex] unknown action type: " + type));
            }
            return
        }

        try {
            this._actionSubscribers
                .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
                .filter(function (sub) { return sub.before; })
                .forEach(function (sub) { return sub.before(action, this$1.state); });
        } catch (e) {
            {
                console.warn("[vuex] error in before action subscribers: ");
                console.error(e);
            }
        }

        var result = entry.length > 1
            ? Promise.all(entry.map(function (handler) { return handler(payload); }))
            : entry[0](payload);

        return result.then(function (res) {
            try {
                this$1._actionSubscribers
                    .filter(function (sub) { return sub.after; })
                    .forEach(function (sub) { return sub.after(action, this$1.state); });
            } catch (e) {
                {
                    console.warn("[vuex] error in after action subscribers: ");
                    console.error(e);
                }
            }
            return res
        })
    };

    Store.prototype.subscribe = function subscribe(fn) {
        return genericSubscribe(fn, this._subscribers)
    };

    Store.prototype.subscribeAction = function subscribeAction(fn) {
        var subs = typeof fn === 'function' ? { before: fn } : fn;
        return genericSubscribe(subs, this._actionSubscribers)
    };

    Store.prototype.watch = function watch(getter, cb, options) {
        var this$1 = this;

        {
            assert(typeof getter === 'function', "store.watch only accepts a function.");
        }
        return this._watcherVM.$watch(function () { return getter(this$1.state, this$1.getters); }, cb, options)
    };

    Store.prototype.replaceState = function replaceState(state) {
        var this$1 = this;

        this._withCommit(function () {
            this$1._vm._data.$$state = state;
        });
    };

    Store.prototype.registerModule = function registerModule(path, rawModule, options) {
        if (options === void 0) options = {};

        if (typeof path === 'string') { path = [path]; }

        {
            assert(Array.isArray(path), "module path must be a string or an Array.");
            assert(path.length > 0, 'cannot register the root module by using registerModule.');
        }

        this._modules.register(path, rawModule);
        installModule(this, this.state, path, this._modules.get(path), options.preserveState);
        // reset store to update getters...
        resetStoreVM(this, this.state);
    };

    Store.prototype.unregisterModule = function unregisterModule(path) {
        var this$1 = this;

        if (typeof path === 'string') { path = [path]; }

        {
            assert(Array.isArray(path), "module path must be a string or an Array.");
        }

        this._modules.unregister(path);
        this._withCommit(function () {
            var parentState = getNestedState(this$1.state, path.slice(0, -1));
            Vue.delete(parentState, path[path.length - 1]);
        });
        resetStore(this);
    };

    Store.prototype.hotUpdate = function hotUpdate(newOptions) {
        this._modules.update(newOptions);
        resetStore(this, true);
    };

    // this._committing用于标记是否是通过mutation来变更state
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

    Object.defineProperties(Store.prototype, prototypeAccessors$1);

    // 注册事件,返回解绑函数
    function genericSubscribe(fn, subs) {
        if (subs.indexOf(fn) < 0) {
            subs.push(fn);
        }
        return function () {
            var i = subs.indexOf(fn);
            if (i > -1) {
                subs.splice(i, 1);
            }
        }
    }

    function resetStore(store, hot) {
        store._actions = Object.create(null);
        store._mutations = Object.create(null);
        store._wrappedGetters = Object.create(null);
        store._modulesNamespaceMap = Object.create(null);
        var state = store.state;
        // init all modules
        installModule(store, state, [], store._modules.root, true);
        // reset vm
        resetStoreVM(store, state, hot);
    }

    function resetStoreVM(store, state, hot) {
        var oldVm = store._vm;

        // bind store public getters
        store.getters = {};
        // reset local getters cache
        store._makeLocalGettersCache = Object.create(null);
        var wrappedGetters = store._wrappedGetters;
        var computed = {};
        // 将getter代理到store._vm上,通过Vue计算属性实现
        forEachValue(wrappedGetters, function (fn, key) {
            // use computed to leverage its lazy-caching mechanism
            // direct inline function use will lead to closure preserving oldVm.
            // using partial to return function with only arguments preserved in closure environment.
            computed[key] = partial(fn, store);
            Object.defineProperty(store.getters, key, {
                get: function () { return store._vm[key]; },
                enumerable: true // for local getters
            });
        });

        // use a Vue instance to store the state tree
        // suppress warnings just in case the user has added
        // some funky global mixins
        var silent = Vue.config.silent;
        Vue.config.silent = true;
        store._vm = new Vue({
            data: {
                $$state: state
            },
            computed: computed
        });
        Vue.config.silent = silent;

        // enable strict mode for new vm
        // 严格模式,state必须通过commit进行修改
        if (store.strict) {
            enableStrictMode(store);
        }

        if (oldVm) {
            if (hot) {
                // dispatch changes in all subscribed watchers
                // to force getter re-evaluation for hot reloading.
                store._withCommit(function () {
                    oldVm._data.$$state = null;
                });
            }
            Vue.nextTick(function () { return oldVm.$destroy(); });
        }
    }

    function installModule(store, rootState, path, module, hot) {
        var isRoot = !path.length;
        var namespace = store._modules.getNamespace(path);

        // register in namespace map
        if (module.namespaced) {
            if (store._modulesNamespaceMap[namespace] && "development" !== 'production') {
                console.error(("[vuex] duplicate namespace " + namespace + " for the namespaced module " + (path.join('/'))));
            }
            store._modulesNamespaceMap[namespace] = module;
        }

        // set state
        if (!isRoot && !hot) {
            // 获取当前module的父级state
            var parentState = getNestedState(rootState, path.slice(0, -1));
            // 获取当前module名称
            var moduleName = path[path.length - 1];
            store._withCommit(function () {
                {
                    // 将module上的state对象挂载到父级的state上时,有同名字段会造成覆盖时进行提示
                    if (moduleName in parentState) {
                        console.warn(
                            ("[vuex] state field \"" + moduleName + "\" was overridden by a module with the same name at \"" + (path.join('.')) + "\"")
                        );
                    }
                }
                // 挂载module上的state到父级state上
                Vue.set(parentState, moduleName, module.state);
            });
        }
        /*
            获取上下文环境local （commit、dispatch、getters、state都是属于当前namespace下的）
            local = {
                commit,
                dispatch,
                getters,
                state
            }
        */
        var local = module.context = makeLocalContext(store, namespace, path);

        // 设置了命名空间时，所有的mutation、action、getter都带有命名空间路径 如: 'namespace/mutation'
        module.forEachMutation(function (mutation, key) {
            var namespacedType = namespace + key;
            registerMutation(store, namespacedType, mutation, local);
        });

        module.forEachAction(function (action, key) {
            // 设置root为true,表示全局action
            var type = action.root ? key : namespace + key;
            var handler = action.handler || action;
            registerAction(store, type, handler, local);
        });

        module.forEachGetter(function (getter, key) {
            var namespacedType = namespace + key;
            registerGetter(store, namespacedType, getter, local);
        });

        // 设置了module时，递归注册mutation、action、getter、state
        module.forEachChild(function (child, key) {
            installModule(store, rootState, path.concat(key), child, hot);
        });
    }

    /**
     * make localized dispatch, commit, getters and state
     * if there is no namespace, just use root ones
     */
    function makeLocalContext(store, namespace, path) {
        var noNamespace = namespace === '';

        var local = {
            // 如果设置命名空间，则dispatch触发的事件名 = 命名空间 + type
            // 无namspace: dispatch(type)   有namespace: dispatch(namespace+type)
            dispatch: noNamespace ? store.dispatch : function (_type, _payload, _options) {
                var args = unifyObjectStyle(_type, _payload, _options);
                var payload = args.payload;
                var options = args.options;
                var type = args.type;
                // 如果显示root为true,表示触发的是全局action
                if (!options || !options.root) {
                    // 触发局部action,只针对特定namespace有效
                    type = namespace + type;
                    if (!store._actions[type]) {
                        console.error(("[vuex] unknown local action type: " + (args.type) + ", global type: " + type));
                        return
                    }
                }

                return store.dispatch(type, payload)
            },
            // commit同理，命名空间下的commit(type)  =>  commit(namespace+type)
            commit: noNamespace ? store.commit : function (_type, _payload, _options) {
                var args = unifyObjectStyle(_type, _payload, _options);
                var payload = args.payload;
                var options = args.options;
                var type = args.type;

                if (!options || !options.root) {
                    type = namespace + type;
                    if (!store._mutations[type]) {
                        console.error(("[vuex] unknown local mutation type: " + (args.type) + ", global type: " + type));
                        return
                    }
                }

                store.commit(type, payload, options);
            }
        };

        // getters and state object must be gotten lazily
        // because they will be changed by vm update
        Object.defineProperties(local, {
            getters: {
                get: noNamespace
                    ? function () { return store.getters; }
                    : function () { return makeLocalGetters(store, namespace); }
            },
            state: {
                // 存在module时,会以module的名称为key存储的该module对应的state 如store[moduleName].state
                get: function () { return getNestedState(store.state, path); }
            }
        });

        return local
    }

    // 当设置了namespace时，getter中原本的key,需写成 `${namespace}/${key}`,多了一个表示namespace的前缀
    // makeLocalGetters方法会对getter的键值进行校验,检测namespace是否匹配
    function makeLocalGetters(store, namespace) {
        if (!store._makeLocalGettersCache[namespace]) {
            var gettersProxy = {};
            var splitPos = namespace.length;
            Object.keys(store.getters).forEach(function (type) {
                // skip if the target getter is not match this namespace
                // 检测getter字段名中的namespace是否匹配, key='namespace/xxx'
                if (type.slice(0, splitPos) !== namespace) { return }

                // extract local getter type
                // 获取去除namspace前缀后实际的键值
                var localType = type.slice(splitPos);

                // Add a port to the getters proxy.
                // Define as getter property because
                // we do not want to evaluate the getters in this time.
                Object.defineProperty(gettersProxy, localType, {
                    get: function () { return store.getters[type]; },
                    enumerable: true
                });
            });
            store._makeLocalGettersCache[namespace] = gettersProxy;
        }

        return store._makeLocalGettersCache[namespace]
    }

    // 注册mutations
    // store._mutations[type] = [ handler1, handler2...]
    function registerMutation(store, type, handler, local) {
        var entry = store._mutations[type] || (store._mutations[type] = []);
        entry.push(function wrappedMutationHandler(payload) {
            // 以store为this执行mutation, 第一个参数为当前上下文的state对象,第二个为commit传入的payload
            handler.call(store, local.state, payload);
        });
    }

    function registerAction(store, type, handler, local) {
        var entry = store._actions[type] || (store._actions[type] = []);
        entry.push(function wrappedActionHandler(payload) {
            // 调用action回调,local为当前命名空间下的上下文环境,store为全局命名空间
            var res = handler.call(store, {
                dispatch: local.dispatch,
                commit: local.commit,
                getters: local.getters,
                state: local.state,
                rootGetters: store.getters,
                rootState: store.state
            }, payload);
            // action的返回值会默认包装为Promise
            if (!isPromise(res)) {
                res = Promise.resolve(res);
            }
            if (store._devtoolHook) {
                return res.catch(function (err) {
                    store._devtoolHook.emit('vuex:error', err);
                    throw err
                })
            } else {
                return res
            }
        });
    }

    function registerGetter(store, type, rawGetter, local) {
        if (store._wrappedGetters[type]) {
            {
                console.error(("[vuex] duplicate getter key: " + type));
            }
            return
        }
        store._wrappedGetters[type] = function wrappedGetter(store) {
            // 调用getter函数
            return rawGetter(
                local.state, // local state
                local.getters, // local getters
                store.state, // root state
                store.getters // root getters
            )
        };
    }

    // 严格模式下state变化时，同步检测_committing是否为true。
    // 只有通过commit方法修改state时, _committing才为true
    function enableStrictMode(store) {
        store._vm.$watch(function () { return this._data.$$state }, function () {
            {
                assert(store._committing, "do not mutate vuex store state outside mutation handlers.");
            }
        }, { deep: true, sync: true });
    }
    // getNestedState({ a: { b: 1 } }, ['a','b'])  => 1
    function getNestedState(state, path) {
        return path.reduce(function (state, key) { return state[key]; }, state)
    }

    /*
    支持commit多个传参方式
    store.commit('increment', {
        amount: 10
    })
    或者
    store.commit({
        type: 'increment',
        amount: 10
    })
    */
    function unifyObjectStyle(type, payload, options) {
        if (isObject(type) && type.type) {
            options = payload;
            payload = type;
            type = type.type;
        }

        {
            assert(typeof type === 'string', ("expects string as the type, but found " + (typeof type) + "."));
        }

        return { type: type, payload: payload, options: options }
    }

    function install(_Vue) {
        // 这里的Vue为局部声明的变量（line:301），并不会访问全局Vue
        // 在一次install之后，Vue就会被赋值 用于防止重复绑定
        if (Vue && _Vue === Vue) {
            {
                console.error(
                    '[vuex] already installed. Vue.use(Vuex) should be called only once.'
                );
            }
            return
        }
        Vue = _Vue;
        applyMixin(Vue);
    }

    /**
     * Reduce the code which written in Vue.js for getting the state.
     * @param {String} [namespace] - Module's namespace
     * @param {Object|Array} states # Object's item can be a function which accept state and getters for param, you can do something for state and getters in it.
     * @param {Object}
     */
    // 根据参数states的键值进行映射，方便访问$store.state上的值
    // mapState({ key :val }) 相当于  `this[key]()` 映射为 `this.$store.state[val]`
    var mapState = normalizeNamespace(function (namespace, states) {
        var res = {};
        if (!isValidMap(states)) {
            console.error('[vuex] mapState: mapper parameter must be either an Array or an Object');
        }
        normalizeMap(states).forEach(function (ref) {
            // key,val分别为 传给mapState参数的键和值
            var key = ref.key;
            var val = ref.val;

            res[key] = function mappedState() {
                var state = this.$store.state;
                var getters = this.$store.getters;
                if (namespace) {
                    var module = getModuleByNamespace(this.$store, 'mapState', namespace);
                    if (!module) {
                        return
                    }
                    // state和getters为当前【命名空间】下的局部state和getters
                    state = module.context.state;
                    getters = module.context.getters;
                }
                // 如果键为函数，传入state和getter,返回执行结果
                // 否则返回state上对应的值
                return typeof val === 'function'
                    ? val.call(this, state, getters)
                    : state[val]
            };
            // mark vuex getter for devtools
            res[key].vuex = true;
        });
        return res
    });

    /**
     * Reduce the code which written in Vue.js for committing the mutation
     * @param {String} [namespace] - Module's namespace
     * @param {Object|Array} mutations # Object's item can be a function which accept `commit` function as the first param, it can accept anthor params. You can commit mutation and do any other things in this function. specially, You need to pass anthor params from the mapped function.
     * @return {Object}
     */
    // 根据传入的参数mutations的键值进行映射
    // mapMutations({ key :val }) 相当于  `this[key]()` 映射为 `this.$store.dispatch(val)`
    var mapMutations = normalizeNamespace(function (namespace, mutations) {
        var res = {};
        if (!isValidMap(mutations)) {
            console.error('[vuex] mapMutations: mapper parameter must be either an Array or an Object');
        }
        normalizeMap(mutations).forEach(function (ref) {
            var key = ref.key;
            var val = ref.val;

            res[key] = function mappedMutation() {
                // 复制arguments到args
                var args = [], len = arguments.length;
                while (len--) args[len] = arguments[len];

                // Get the commit method from store
                // 全局空间下的commit
                var commit = this.$store.commit;
                if (namespace) {
                    var module = getModuleByNamespace(this.$store, 'mapMutations', namespace);
                    if (!module) {
                        return
                    }
                    // 当前命名空间下的commit(只会触发局部state改变)
                    commit = module.context.commit;
                }
                // 1. 如果是函数则调用，第一个参数为commit
                // 2. 接触发val对应Mutation
                /*
                    mapMutation({
                        mutation1(commit){
                            commit("increment")
                       },
                       mutation2:"increment",
                    })
                
                */
                return typeof val === 'function'
                    ? val.apply(this, [commit].concat(args))
                    : commit.apply(this.$store, [val].concat(args))
            };
        });
        return res
    });

    /**
     * Reduce the code which written in Vue.js for getting the getters
     * @param {String} [namespace] - Module's namespace
     * @param {Object|Array} getters
     * @return {Object}
     */
    // mapGetter相当于根据$store.state来设置计算属性，从而扩展state 
    var mapGetters = normalizeNamespace(function (namespace, getters) {
        var res = {};
        if (!isValidMap(getters)) {
            console.error('[vuex] mapGetters: mapper parameter must be either an Array or an Object');
        }
        normalizeMap(getters).forEach(function (ref) {
            var key = ref.key;
            var val = ref.val;

            // The namespace has been mutated by normalizeNamespace
            // 经normalizeNamespace函数处理后，namespace必定是空字符串 or '/'结尾的字符串
            val = namespace + val;
            res[key] = function mappedGetter() {
                if (namespace && !getModuleByNamespace(this.$store, 'mapGetters', namespace)) {
                    return
                }
                if (!(val in this.$store.getters)) {
                    console.error(("[vuex] unknown getter: " + val));
                    return
                }
                return this.$store.getters[val]
            };
            // mark vuex getter for devtools
            res[key].vuex = true;
        });
        return res
    });

    /**
     * Reduce the code which written in Vue.js for dispatch the action
     * @param {String} [namespace] - Module's namespace
     * @param {Object|Array} actions # Object's item can be a function which accept `dispatch` function as the first param, it can accept anthor params. You can dispatch action and do any other things in this function. specially, You need to pass anthor params from the mapped function.
     * @return {Object}
     */
    // 根据传入的参数actions的键值进行映射： 
    // mapActions({ key :val }) 相当于  `this[key]()` 映射为 `this.$store.dispatch(val)`
    var mapActions = normalizeNamespace(function (namespace, actions) {
        var res = {};
        if (!isValidMap(actions)) {
            console.error('[vuex] mapActions: mapper parameter must be either an Array or an Object');
        }
        normalizeMap(actions).forEach(function (ref) {
            var key = ref.key;
            var val = ref.val;

            res[key] = function mappedAction() {
                var args = [], len = arguments.length;
                while (len--) args[len] = arguments[len];

                // get dispatch function from store
                var dispatch = this.$store.dispatch;
                if (namespace) {
                    var module = getModuleByNamespace(this.$store, 'mapActions', namespace);
                    if (!module) {
                        return
                    }
                    dispatch = module.context.dispatch;
                }
                return typeof val === 'function'
                    ? val.apply(this, [dispatch].concat(args))
                    : dispatch.apply(this.$store, [val].concat(args))
            };
        });
        return res
    });

    /**
     * Rebinding namespace param for mapXXX function in special scoped, and return them by simple object
     * @param {String} namespace
     * @return {Object}
     */
    // 重新设置mapXXX方法的namespace
    var createNamespacedHelpers = function (namespace) {
        return ({
            mapState: mapState.bind(null, namespace),
            mapGetters: mapGetters.bind(null, namespace),
            mapMutations: mapMutations.bind(null, namespace),
            mapActions: mapActions.bind(null, namespace)
        });
    };

    /**
     * Normalize the map
     * normalizeMap([1, 2, 3]) => [ { key: 1, val: 1 }, { key: 2, val: 2 }, { key: 3, val: 3 } ]
     * normalizeMap({a: 1, b: 2, c: 3}) => [ { key: 'a', val: 1 }, { key: 'b', val: 2 }, { key: 'c', val: 3 } ]
     * @param {Array|Object} map
     * @return {Object}
     */
    // 将数组和对象统一转化为键值对象
    function normalizeMap(map) {
        if (!isValidMap(map)) {
            return []
        }
        return Array.isArray(map)
            ? map.map(function (key) { return ({ key: key, val: key }); })
            : Object.keys(map).map(function (key) { return ({ key: key, val: map[key] }); })
    }

    /**
     * Validate whether given map is valid or not
     * @param {*} map
     * @return {Boolean}
     */
    function isValidMap(map) {
        return Array.isArray(map) || isObject(map)
    }

    /**
     * Return a function expect two param contains namespace and map. it will normalize the namespace and then the param's function will handle the new namespace and the map.
     * @param {Function} fn
     * @return {Function}
     */
    // 确保namespace为空字符串 or '/'结尾的字符串
    function normalizeNamespace(fn) {
        return function (namespace, map) {
            // function(map)形式传参处理，使namespace为''
            if (typeof namespace !== 'string') {
                map = namespace;
                namespace = '';
            } else if (namespace.charAt(namespace.length - 1) !== '/') {
                // namespace有值时保证以 '/'结尾
                namespace += '/';
            }
            return fn(namespace, map)
        }
    }

    /**
     * Search a special module from store by namespace. if module not exist, print error message.
     * @param {Object} store
     * @param {String} helper
     * @param {String} namespace
     * @return {Object}
     */
    // 检测用户输入的命名空间是否存在 如commit('invalidNamespace/xxx')
    function getModuleByNamespace(store, helper, namespace) {
        var module = store._modulesNamespaceMap[namespace];
        if (!module) {
            console.error(("[vuex] module namespace not found in " + helper + "(): " + namespace));
        }
        return module
    }

    var index = {
        Store: Store,
        install: install,
        version: '3.1.3',
        mapState: mapState,
        mapMutations: mapMutations,
        mapGetters: mapGetters,
        mapActions: mapActions,
        createNamespacedHelpers: createNamespacedHelpers
    };

    return index;

})));
