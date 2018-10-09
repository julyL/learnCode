const fsm = require('easy-fsm')

let machine = fsm.create({
    initial: 'off',
    states: {
        off: {
            on: {
                click: 'weakLight'
            }
        },
        weakLight: {
            on: {
                click: 'strongLight'
            }
        },
        strongLight: {
            on: {
                click: 'off'
            }
        }
    }
})

machine.onEnterOff = function () {
    console.log('关灯');
}
machine.onEnterWeakLight = function () {
    console.log('弱灯');
}
machine.onEnterStrongLight = function () {
    console.log('强灯');
}


machine.fire('click')
    .then(() => {
        return machine.fire('click');
    })
    .then(() => {
        return machine.fire('click');
    })
    .then(() => {
        return machine.fire('click');
    })