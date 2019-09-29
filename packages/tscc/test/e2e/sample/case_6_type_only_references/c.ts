import * as b from './b' // type-only import


window['b'] = (x: b.b) => {x({b() {} })}
