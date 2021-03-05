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
  routes // (缩写) 相当于 routes: routes
})

const app = new Vue({
  router
}).$mount('#app')
```

1. 通过Vue.use(vueRouter)使用插件
2. 生成路由实例 `new VueRouter({routes})`
3. 挂载到Vue实例上 `new Vue({router})`


可以通过Vue.use(VueRouter)手动挂载插件, vue-router.js内部也会自动检测全局Vue是否存在。如果存在会自动调用Vue.use(VueRouter)进行安装插件,代码如下：

```js
// vue-router.js
VueRouter.install = install;
// 如果是浏览器环境&&全局存在Vue对象,则自动安装VueRouter插件
if (inBrowser && window.Vue) {
    window.Vue.use(VueRouter);
}
```

Vue.use内部会调用install方法

```js
function install(Vue) {
    // 防止重复安装
    if (install.installed && _Vue === Vue) { return }
    install.installed = true;
    // 存储Vue对象
    _Vue = Vue;
    // 省略
    Vue.mixin({
        beforeCreate: function beforeCreate() {
            // this.$options.router就是传入Vue构造函数中的router对象
            // 仅对配置了router选项的组件执行走if为true条件
            if (isDef(this.$options.router)) {
                // Vue实例对象
                this._routerRoot = this;
                // VueRouter实例对象
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

    // this._routerRoot: 为设置了router选项的Vue实例对象
    // _router: router选项对应的VueRouter实例对象
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

install方法做了以下几件事：

1. 存储全局Vue对象到内部_Vue变量上
2. 通过Vue.mixin在Vue所有组件的beforeCreate生命周期，注入VueRouter相关的处理逻辑。
3. 添加在Vue.prototype上添加`$router`、`$route`
4. 全局注册组件 router-view、router-link

其中最为核心的是第2点，看一下beforeCreate的逻辑:

对于设置了`router`选项的Vue实例对象(也就是存在this.$options.router),会走if为true的逻辑, Vue实例对象上会新增`_routerRoot`、`_router`、`_route`, 并且执行`init`方法

* _routerRoot: router选项的根实例
* _router： 同`this.$router`表示生成的VueRouter的实例对象
* _route： 同`this.$route` 表示当前激活的路由的状态信息
  
init方法:

```js
VueRouter.prototype.init = function init(app /* Vue component instance */) {
    var this$1 = this;
    // app为存在this.$options.router的Vue实例对象,也就是配置了路由的根实例
    this.apps.push(app);

    app.$once('hook:destroyed', function () {
        // 销毁实例的逻辑
    });

    // router的根实例只需要执行一次初始化工作
    if (this.app) {
        return
    }

    this.app = app;

    var history = this.history;

    if (history instanceof HTML5History || history instanceof HashHistory) {
        // setupListeners 会绑定路由变化事件 hash模式对应hashchange事件,history模式对应popstate事件
        var setupListeners = function (routeOrError) {
            history.setupListeners();
            handleInitialScroll(routeOrError);
        };
        //用于控制路由变化过程, 按照顺序执行各个导航守卫
        history.transitionTo(
            history.getCurrentLocation(),
            setupListeners,
            setupListeners
        );
    }

    // 当前路由发生变化时，会通过history.updateRoute方法执行history.listen绑定的回调
    // 回调中会修改Vue实例的_route选项值,也就是当前激活的路由状态信息(this.$route)
    history.listen(function (route) {
        this$1.apps.forEach(function (app) {
            app._route = route;
        });
    });
};
```

init方法会执行transitionTo方法, 执行一次路由切换。
如: hash模式下原先的页面路径为**index.html**, 会在执行init方法后,变为**index.html#/**  


### 路由执行相关逻辑

1. Vue组件触发beforeCreate

对于配置了router选项的组件会执行 init => transitionTo => confirmTransition

```js
// confirmTransition代码

```

resolveQueue方法会计算路由切换过程中, 需要执行beforeRouteUpdate、beforeRouteLeave、beforeEnter事件的路由对象

```js
// resolveQueue代码
var ref = resolveQueue(
    this.current.matched,
    route.matched
);
var updated = ref.updated;   // 需要更新的routes数组(执行beforeRouteUpdate）
var deactivated = ref.deactivated; // 需要失效的route数组(beforeRouteLeave）
var activated = ref.activated;  // 需要激活的route数组（beforeEnter、beforeRouteEnter)
```

```js
var queue = [].concat(
    // in-component leave guards
    extractLeaveGuards(deactivated),   // 失效组件的beforeRouteLeave数组
    // global before hooks
    this.router.beforeHooks,           // 全局导航守卫beforeEach数组
    // in-component update hooks
    extractUpdateHooks(updated),       // 重用组件的beforeRouteUpdate数组
    // in-config enter guards
    activated.map(function (m) { return m.beforeEnter; }),   // 路由选项中配置的beforeEnter数组
    // async components
    resolveAsyncComponents(activated)        // 异步组件
);
```

通过runQueue执行导航守卫，守卫中只有执行next,才能继续执行下一个守卫。

```js
runQueue(queue, iterator, function () {
    // beforeRouteEnter事件数组
    var enterGuards = extractEnterGuards(activated, postEnterCbs, isValid);
    // 合并beforeResolve事件数组
    var queue = enterGuards.concat(this$1.router.resolveHooks);
    runQueue(queue, iterator, function () {
        // 执行confirmTransition的complete回调(第3个参数),更新$route对象
        onComplete(route);
    }
})
```

完整的导航解析流程

1. 导航被触发。
2. 在失活的组件里调用 beforeRouteLeave 守卫。(子 => 父)
3. 调用全局的 beforeEach 守卫。
4. 在重用的组件里调用 beforeRouteUpdate 守卫 (2.2+)。 (父 => 子)
5. 在路由配置里调用 beforeEnter。
6. 解析异步路由组件。
7. 在被激活的组件里调用 beforeRouteEnter。(父 => 子)
8. 调用全局的 beforeResolve 守卫 (2.5+)。
9. 导航被确认。
10. 调用全局的 afterEach 钩子。
11. 触发 DOM 更新。
12. 调用 beforeRouteEnter 守卫中传给 next 的回调函数，创建好的组件实例会作为回调函数的参数传入
```js
beforeRouteEnter(to, from, next) {
    next(vm => {
        //通过vm访问组件实例
    })
}
```

例如： 路由从'/user/profile'切换到'/', profile路由组件是user路由组件的children.  beforeRouteLeave的事件顺序是: ['profile'路由组件的beforeRouteLeave,'user'路由组件的beforeRouteLeave]


### 路由切换的原理

点击router-link进行路由切换时，会调用 VueRouter.prototype上的push、replace等方法

例如路由跳转如下，hash路由模式
'/'  => '/user/profile'

VueRouter.prototype.push  => history.push(假设history为HashHistory的实例)  => HashHistory.prototype.push  => History.prototype.transitionTo  => History.prototype.confirmTransition


路由和视图响应式的建立：

在执行mounted之前，vue会将包含router-view的html模板生成render函数并执行,这个render函数中会触发`$route`对象的getter。这样就与router-view建立了联系。渲染Watcher会被`$route`的dep收集。随后路由改变时，都会触发`$route`的setter,从而通过dep.notify触发渲染Watcher的执行，重新渲染路由组件





