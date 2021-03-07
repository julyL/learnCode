## component

示例代码：

```html
<div id="app">
    <hello-world></hello-world>
</div>
```

```js
Vue.component('hello-world', {
    template: "<div>Hello world</div>"
})
```

Vue 初始化阶段会执行 `updateComponent`方法

```js
updateComponent = function () {
   vm._update(vm._render(), hydrating);
};
```
首先先会调用`vm._render()` 生成渲染函数，示例的模板函数如下所示：

```js
// 渲染函数
(function anonymous(
) {
with(this){return _c('div',{attrs:{"id":"app"}},[_c('hello-world')],1)}
})
```

渲染函数中会执行`_c('hello-world')`, `_c`就是`vm._c` 会调用 `createElement` 方法。`createElement`方法会根据 tag 判断是不是一个组件，这里的 tag 是 helloWorld，会判断为一个组件。然后`createElement`方法会调用`vnode = createComponent(Ctor, data, context, children, tag)`生成 VNode; 然后执行 `vm._update`方法，内部会对 VNode 执行 `vm.__patch__`, 最终生成 dom 赋值给 vm.$el 完成视图更新。

### 组件挂载的流程

1. 页面初始化执行 `updateComponent`
2. 执行 `vm._render` 生成 渲染函数并执行
3. 执行`_c('hello-world')`,  `_c`即`vm._c`方法会调用 `createElement`
4. `createElement` 方法根据 tag 判断，tag 为 helloWorld 是组件，然后调用 `createComponent` 生成相应的组件 VNode
5. 执行 `vm._update` 方法，内部会调用 `vm.__patch__`生成 dom 并赋值给 dom, 完成了视图更新