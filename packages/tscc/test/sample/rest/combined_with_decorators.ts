function myDecorator(target, prop, desc) {
	let {value, ...rest} = desc;
	console.log(rest);
	desc.value = {};
}

class A {
	@myDecorator
	public myMethod() {}
}

const b = new A();
window.a = b.myMethod();
const {c, ...rest} = {a: {}, b: {}, c: {}};
window.d = rest;
export {};
