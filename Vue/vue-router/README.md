## vue-router

### 使用流程

> 以如下示例代码进行说明

```js
const Foo = { template: '<div>foo</div>' }
const Bar = { template: '<div>bar</div>' }

const routes = [
  { path: '/foo', component: Foo },
  { path: '/bar', component: Bar }
]

const router = new VueRouter({
  routes // （缩写） 相当于 routes: routes
})

const app = new Vue({
  router
}).$mount('#app')
```

1. 通过 `Vue.use(vueRouter)` 使用插件
2. 生成路由实例 `new VueRouter({routes})`
3. 挂载到 Vue 实例上 `new Vue({router})`

可以通过 `Vue.use(VueRouter)` 手动挂载插件，vue-router.js 内部也会自动检测全局 Vue 是否存在。如果存在会自动调用 `Vue.use(VueRouter)` 进行安装插件，代码如下：

```js
// vue-router.js
VueRouter.install = install;
// 如果是浏览器环境&&全局存在 Vue 对象，则自动安装 VueRouter 插件
if (inBrowser && window.Vue) {
    window.Vue.use(VueRouter);
}
```

Vue.use 内部会调用 install 方法

```js
function install(Vue) {
    // 防止重复安装
    if (install.installed && _Vue === Vue) { return }
    install.installed = true;
    // 存储 Vue 对象
    _Vue = Vue;
    // 省略
    Vue.mixin({
        beforeCreate: function beforeCreate() {
            // this.$options.router 就是传入 Vue 构造函数中的 router 对象
            // 仅对配置了 router 选项的组件执行走 if 为 true 条件
            if (isDef(this.$options.router)) {
                // Vue 实例对象
                this._routerRoot = this;
                // VueRouter 实例对象
                this._router = this.$options.router;
                this._router.init(this);
                Vue.util.defineReactive(this, '_route', this._router.history.current);
            } else {
                // this._routerRoot 始终指向的离它最近的传入了 router 对象作为配置而实例化的父实例
                this._routerRoot = (this.$parent && this.$parent._routerRoot) || this;
            }
            registerInstance(this, this);
        },
        destroyed: function destroyed() {
            registerInstance(this);
        }
    });

    // this._routerRoot: 为设置了 router 选项的 Vue 实例对象
    // _router: router 选项对应的 VueRouter 实例对象
    // _route: 当前路由对象
    Object.defineProperty(Vue.prototype, '$router', {
        get: function get() { return this._routerRoot._router }
    });
    Object.defineProperty(Vue.prototype, '$route', {
        get: function get() { return this._routerRoot._route }
    });

    // 全局注册组件 router-view、router-link
    Vue.component('RouterView', View);
    Vue.component('RouterLink', Link);
}
```

install 方法做了以下几件事：

1. 存储全局 Vue 对象到内部_Vue 变量上
2. **通过 Vue.mixin 在 Vue 所有组件的 beforeCreate 生命周期，注入 VueRouter 相关的处理逻辑。**
3. 添加在 Vue.prototype 上添加`$router`、`$route`
4. 全局注册组件 router-view、router-link

其中最为核心的是第 2 点，看一下 beforeCreate 的逻辑：
对于设置了`router`选项的 Vue 实例对象（也就是存在 this.$options.router), 会走 if 为 true 的逻辑，Vue 实例对象上会新增`_routerRoot`、`_router`、`_route`, 并且执行`init`方法。

* _routerRoot: router 选项的根实例
* _router： 同`this.$router`表示生成的 VueRouter 的实例对象
* _route： 同`this.$route` 表示当前激活的路由的状态信息
  
init 方法：
```js
VueRouter.prototype.init = function init(app /* Vue component instance */) {
    var this$1 = this;
    // app 为存在 this.$options.router 的 Vue 实例对象，也就是配置了路由的根实例
    this.apps.push(app);

    app.$once('hook:destroyed', function () {
        // 销毁实例的逻辑
    });

    // router 的根实例只需要执行一次初始化工作
    if (this.app) {
        return
    }

    this.app = app;

    var history = this.history;

    if (history instanceof HTML5History || history instanceof HashHistory) {
        // setupListeners 会绑定路由变化事件 hash 模式对应 hashchange 事件，history 模式对应 popstate 事件
        var setupListeners = function (routeOrError) {
            history.setupListeners();
            handleInitialScroll(routeOrError);
        };
        // 初始化时修正页面的路径
        history.transitionTo(
            history.getCurrentLocation(),
            setupListeners,
            setupListeners
        );
    }

    // 当前路由发生变化时，会通过 history.updateRoute 方法执行 history.listen 绑定的回调
    // 回调中会修改 Vue 实例的_route 选项值，也就是当前激活的路由状态信息 (this.$route)
    history.listen(function (route) {
        this$1.apps.forEach(function (app) {
            app._route = route;
        });
    });
};
```

首次执行 init 方法 this.app 会被赋值了当前 Vue 实例对象，对于 history、hash 模式，会通过 transitionTo 方法进行一次路径初始化修改。因为当前页面路径可能被修改（如 replaceState)。
> 例如：hash 模式下原先的页面路径为** index.html**, 执行完 transitionTo 之后会变为** index.html#/**

transitionTo 执行完后必定会执行 setupListeners,setupListeners 会根据当前路由 mode 绑定 popstate 或者 hashchange 事件。history.listen 用于监听当前路由对象的变化，如果路由发生变化则会执行回调修改 Vue 实例的_route 也就是 (this.$route)

transitionTo 方法

```js
function transitionTo(
    // location 为目标的路由对应的 Location 对象（此时浏览器 url 还未变化）
    // this.current 为当前 url 对应的 route 对象
    // 将通过 match 方法从路由表 (VueRouter 实例对象）中查找目标路由
    route = this.router.match(location, this.current)
    // confirmTransition 用于执行各个导航守卫，确认路由切换是否要执行
    this.confirmTransition(route, onComplete, onError);
}
```

通过 runQueue 执行导航守卫，守卫中只有执行 next, 才能继续执行下一个守卫。

```js
function confirmTransition(
    // 根据当前路由和目标路由计算出需要激活、更新、失效的路由组件
    var ref = resolveQueue(
        this.current.matched,
        route.matched
    );
    var updated = ref.updated;   // 需要更新的 routes 数组（执行 beforeRouteUpdate）
    var deactivated = ref.deactivated; // 需要失效的 route 数组 (beforeRouteLeave）
    var activated = ref.activated;  // 需要激活的 route 数组（beforeEnter、beforeRouteEnter)
    
    // 按照一定顺序排列全局守卫、路由配置项的守卫和路由组件的守卫
    var queue = [].concat(
        // in-component leave guards
        extractLeaveGuards(deactivated),   // 失效组件的 beforeRouteLeave 数组
        // global before hooks
        this.router.beforeHooks,           // 全局导航守卫 beforeEach 数组
        // in-component update hooks
        extractUpdateHooks(updated),       // 重用组件的 beforeRouteUpdate 数组
        // in-config enter guards
        activated.map(function (m) { return m.beforeEnter; }),   // 路由选项中配置的 beforeEnter 数组
        // async components
        resolveAsyncComponents(activated)        // 异步组件
    );
    
    // 通过 runQueue 执行导航守卫，守卫中只有执行 next, 才能继续执行下一个守卫。
    runQueue(queue, iterator, function () {
        // beforeRouteEnter 事件数组
        var enterGuards = extractEnterGuards(activated, postEnterCbs, isValid);
        // 合并 beforeResolve 事件数组
        var queue = enterGuards.concat(this$1.router.resolveHooks);
        runQueue(queue, iterator, function () {
            // 执行 confirmTransition 的 complete 回调（第 3 个参数）, 更新$route 对象
            onComplete(route);
        }
    })
}
```

完整的导航解析流程

1. 导航被触发。
2. 在失活的组件里调用 beforeRouteLeave 守卫。（子 => 父）
3. 调用全局的 beforeEach 守卫。
4. 在重用的组件里调用 beforeRouteUpdate 守卫 (2.2+)。 （父 => 子）
5. 在路由配置里调用 beforeEnter。
6. 解析异步路由组件。
7. 在被激活的组件里调用 beforeRouteEnter。（父 => 子）
8. 调用全局的 beforeResolve 守卫 (2.5+)。
9. 导航被确认。
10. 调用全局的 afterEach 钩子。
11. 触发 DOM 更新。
12. 调用 beforeRouteEnter 守卫中传给 next 的回调函数，创建好的组件实例会作为回调函数的参数传入
```js
beforeRouteEnter(to, from, next) {
    next(vm => {
        //通过 vm 访问组件实例
    })
}
```

例如： 路由从'/user/profile'切换到'/', profile 路由组件是 user 路由组件的 children.  beforeRouteLeave 的事件顺序是：['profile'路由组件的 beforeRouteLeave,'user'路由组件的 beforeRouteLeave]

**路由变更的流程：**

1. 通过点击事件或者 js 修改路由，内部会调用push、replace 等方法 
2. History.prototype.transitionTo在路由表中查找目标路由,可以通过path、name进行匹配 
3. History.prototype.confirmTransition执行各个导航守卫，进行路由切换的确认，在守卫中只有执行 next() 才能确保路由切换成功
4. 路由切换完成后执行 comfirmTransition 回调，更新$route 对象 
5. $route 对象更新，触发响应式视图更新，进行路由组件视图更新

**路由和视图响应式的建立：**

在执行 mounted 之前，vue 会将包含 router-view 的 html 模板生成 render 函数并执行，这个 render 函数中会触发`$route`对象的 getter。这样就与 router-view 建立了联系。渲染 Watcher 会被`$route`的 dep 收集。随后路由改变时，都会触发`$route`的 setter, 从而通过 dep.notify 触发渲染 Watcher 的执行，重新渲染路由组件
