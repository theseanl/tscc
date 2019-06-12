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

