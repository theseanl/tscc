export function swap([a, b]) {
	return [b, a];
}

export function sort([a, b]) {
	return a > b ? [a, b] : swap([a, b]);
}

