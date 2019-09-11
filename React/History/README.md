### history代码阅读
> 只对createBrowserHistory部分进行了解读,代码注释见./lib/createBrowserHistory.js

原生的history.pushState, history.replaceState等方法可以改变当前的url,但是并不会触发popstate事件。只有当触发go、forward、浏览器的前进、后退等时才会触发popstate事件。

history库主要是对原生方法进行了一层封装，提供的go、push、repalce等方法,内部实际上还是调用原生history对象上的方法。如createBrowserHistory返回的`push`方法内部调用`pushState`,主要是新增了`listen`和`block`方法:
1.listen方法用于监听历史记录的变更, 每当调用go、push等改变历史记录时,都会触发通过listen绑定的回调。
2.block方法用于向用户询问是否需要离开当前页面,默认采用window.confirm进行提示,也可以自定义弹窗。如果用户拒绝,将不会执行url变更。

单页应用的demo见./demo/spa.html
