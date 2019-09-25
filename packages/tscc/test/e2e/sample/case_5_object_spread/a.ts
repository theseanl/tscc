function myDecorator(target, prop, desc) {
	let {value, ...rest} = desc;
	console.log(rest);
	desc.value = {};
}

class A {
	@myDecorator
	public myMethod(a, {b, ...c}) {
		const {d, ...e} = b;
		console.log(e);
	}
}

const b = new A();
b.myMethod({}, {b: {c: {}, d: {}}, e: {}, f: {}, g: {}});
const {c, ...rest} = {a: {}, b: {}, c: {}};
window["d"] = rest;
export {};
