import warning from './warning.js';

function createTransitionManager() {
  let prompt = null; // 用于控制history改变时，是否需要进行用户提醒

  // 用于设置history改变时的提醒, 返回值用于取消设置提醒
  // nextPrompt可以是function || string
  function setPrompt(nextPrompt) {
    warning(prompt == null, 'A history supports only one prompt at a time');

    prompt = nextPrompt;

    return () => {
      // 多次执行setPrompt方法时,只有最近执行的setPrompt返回的方法能够取消prompt的设置
      if (prompt === nextPrompt) prompt = null;
    };
  }

  function confirmTransitionTo(
    location,
    action,
    getUserConfirmation,
    callback
  ) {
    // TODO: If another transition starts while we're still confirming
    // the previous one, we may end up in a weird state. Figure out the
    // best way to handle this.

    // 如果设置了prompt,在程序改变url之前会调用getUserConfirmation方法(默认为window.confirm,也可以实现自定义弹窗)询问用户是否需要离开当前url  
    // 如果callback传入false,则表示用户取消了离开操作,此时不应该改变页面的url
    if (prompt != null) {
      const result =
        typeof prompt === 'function' ? prompt(location, action) : prompt;

      if (typeof result === 'string') {
        if (typeof getUserConfirmation === 'function') {
          getUserConfirmation(result, callback);
        } else {
          warning(
            false,
            'A history needs a getUserConfirmation function in order to use a prompt message'
          );
          callback(true);
        }
      } else {
        // Return false from a transition hook to cancel the transition.
        callback(result !== false);
      }
    } else {
      callback(true);
    }
  }

  let listeners = [];

  function appendListener(fn) {
    // 内部闭包变量,用于控制fn是否执行
    let isActive = true;

    function listener(...args) {
      if (isActive) fn(...args);
    }

    listeners.push(listener);

    // return的值用于取消事件监听
    return () => {
      // 禁止fn执行
      isActive = false;
      // 从总的listeners中过滤当前listener
      listeners = listeners.filter(item => item !== listener);
    };
  }

  function notifyListeners(...args) {
    listeners.forEach(listener => listener(...args));
  }

  return {
    setPrompt,
    confirmTransitionTo,
    appendListener,
    notifyListeners
  };
}

export default createTransitionManager;
