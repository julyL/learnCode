## vue-router

路由和视图响应式的建立：

在执行mounted之前，vue会将包含router-view的html模板生成render函数并执行,这个render函数中会触发`$route`对象的getter。这样就与router-view建立了联系。渲染Watcher会被`$route`的dep收集。随后路由改变时，都会触发`$route`的setter,从而通过dep.notify触发渲染Watcher的执行，重新渲染路由组件
