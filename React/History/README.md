## history代码阅读
> 操作history历史栈的库,react-route的核心依赖库

[github地址](https://github.com/ReactTraining/history#readme)

### 代码解读
- [x] createBrowserHistory  (采用Html5 History Api处理History)
- [ ] createHashHistory  (采用Hash模式,兼容性良好)
- [ ] createMemoryHistory (适用于没有dom的环境如React Native)

#### createBrowserHistory
> 原生的history.pushState, history.replaceState等方法可以改变当前的url,但是并不会触发popstate事件。只有当触发go、forward、浏览器的前进、后退等时才会触发popstate事件。

createBrowserHistory中对原生方法进行了一层封装，提供的go、push、repalce等方法。这些方法内部的实现还是调用原生history对象上的方法。如createBrowserHistory返回的`push`方法内部调用是`pushState`。

History主要是新增了`listen`和`block`方法:
1.listen方法用于监听历史记录的变更, 每当调用go、push等改变历史记录时,都会触发通过listen绑定的回调。
2.block方法用于向用户询问是否需要离开当前页面,默认采用window.confirm进行提示,也可以自定义弹窗。如果用户拒绝,将不会执行url变更。

一个简单的单页应用见./demo/index.html
