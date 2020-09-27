export function riffle<T>(x: T, array: T[]): T[] {
	let out: T[] = [];
	for (let i = 0, l = array.length; i < l; i++) {
		out.push(x, array[i]);
	}
	return out;
}

export function flatten<T>(array: T[][]): T[] {
	let out: T[] = [];
	for (let i = 0, l = array.length; i < l; i++) {
		out.push(...array[i]);
	}
	return out;
}

export function union<T>(array1: T[], array2: T[]): T[] {
	let out: T[] = array1.slice();
	for (let i = 0, l = array2.length; i < l; i++) {
		let el = array2[i];
		if (out.includes(el)) continue;
		out.push(el);
	}
	return out;
}
