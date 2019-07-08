const adornClass: ClassDecorator = (target) => target
const adornProperty: PropertyDecorator = (target, prop) => {}
const adornMethod: MethodDecorator = (target, prop, desc) => desc;
const adornParameter: ParameterDecorator = (target, prop, paramIndex) => {}

@adornClass
class A {
	@adornMethod
	aMethod() {

	}

	@adornProperty
	aProperty	

	@adornMethod
	get anAccessor() {
		return NaN;
	}
	set anAccessor(v: number) {

	}
	aMethodWithParams(@adornParameter param) {

	}
}

// Make it a module
export {};

