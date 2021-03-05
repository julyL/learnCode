### Vue源码解析


`new Vue()` => 执行`vm.$mount`方法 => 执行`compileToFunctions`生成render函数,调用`mount`方法 => `mountComponent`


mountComponent会创建一个Watcher


```js
updateComponent = () => {
    vm._update(vm._render(), hydrating)
}

 new Watcher(vm, updateComponent, noop, {
    before () {
      if (vm._isMounted) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }, true /* isRenderWatcher */)

```

初始化dom渲染时，会调用vm._render生成VNode,在通过vm._update更新DOM.

