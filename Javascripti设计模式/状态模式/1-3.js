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

machine.onOff = function () {
    console.log('关灯');
}
machine.onWeakLight = function () {
    console.log('弱灯');
}
machine.onStrongLight = function () {
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

/*

弱光
强光
关灯
弱光

*/