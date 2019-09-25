var o = {
	a: {},
	b: {},
	"c": {},
	["d"]: {},
	[Symbol('foo')]: {},
	[Math.random() > .5 ? "foo" : "bar"]: {}
};

var {a, c, d, foo, ...rest} = o;

function A(a, {b, c, ...d}) {
	console.log(d);
}

// From what's new in Typescript 2.1
(function () {
	var original = {a: {}, b: {}, c: {}};
	let copy = {...original};
})();

(function () {
	var foo = {}, bar = {}, baz = {};
	let merged = {...foo, ...bar, ...baz};
})();

(function () {
	let obj = {x: 1, y: "string"};
	var newObj = {...obj, z: 3, y: 4}; // { x: number, y: number, z: number }
})();
(function () {
	let obj = {x: 1, y: 1, z: 1};
	let {z, ...obj1} = obj;
	obj1; // {x: number, y:number};
})();
// make it to a module
export {};
