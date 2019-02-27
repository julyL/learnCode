function createThunkMiddleware(extraArgument) {
  return ({ dispatch, getState }) => next => action => {
    if (typeof action === 'function') {
      // 如果为函数，则交由函数内部进行dispatch
      return action(dispatch, getState, extraArgument);
    }
    //action不是函数,则直接dispatch(action)
    return next(action);
  };
}

const thunk = createThunkMiddleware();
thunk.withExtraArgument = createThunkMiddleware;

export default thunk;
