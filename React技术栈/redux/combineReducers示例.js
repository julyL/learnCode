const {
    createStore,
    combineReducers,
} = require("redux");

var initState = {
    age: 54,
    name: {
        firstName: "Ma",
        lastName: "Yun",
        fullName: "Ma Yun"
    }
}

function reducer_name(state = initState.name, action) {
    switch (action.type) {
        case 'modify_name':
            let {
                firstName,
                lastName
            } = action.newName;
            return Object.assign({}, state, {
                fullName: firstName + " " + lastName,
                firstName,
                lastName
            })
        default:
            return state;
    }

}

function reducer_age(state = initState.age, action) {
    switch (action.type) {
        case 'add_age':
            return state + 1;
        case 'substract_age':
            return state - 1;
        case 'modify_age':
            return action.toAge
        default:
            return state;
    }
}
var reducer = combineReducers({
    name: reducer_name,
    age: reducer_age,
})
var store = createStore(reducer, initState);

console.log('\ninitState:\n', store.getState());

const unsubscribe = store.subscribe(() =>
    console.log("\nsubscribe:\n", store.getState())
)

store.dispatch({
    type: "add_age"
})

function actionModifyName(newName) {
    return {
        type: "modify_name",
        newName
    }
}

store.dispatch(actionModifyName({
    firstName: "码",
    lastName: "云"
}))

store.dispatch({
    type: "modify_age",
    toAge: 66
})