function decorator(target, prop:PropertyKey, desc:PropertyDescriptor) {
	return desc;
}

class A {
	@decorator
	b() {console.log('a')}
}

(new A).b();

export {A}
