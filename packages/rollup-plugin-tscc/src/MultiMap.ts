export default class MultiMap<K, V> {
	private map: Map<K, Set<V>> = new Map();
	add(key: K, value?: V) {
		let ar: Set<V>;
		if (!this.map.has(key)) {
			ar = new Set();
			this.map.set(key, ar);
		} else {
			ar = this.map.get(key)!;
		}
		if (arguments.length > 1) {
			ar.add(value!);
		}
	}
	find(key: K, value: V): boolean {
		if (!this.findKey(key)) return false;
		let values = this.map.get(key)!;
		return values.has(value);
	}
	findKey(key: K): boolean {
		return this.map.has(key);
	}
	findValue(value: V): K | undefined {
		for (let [key, values] of this.map) {
			if (values.has(value)) return key;
		}
	}
	get(key: K): V[] {
		if (!this.map.has(key)) return [];
		return [...this.map.get(key)!];
	}
	putAll(key: K, values: Iterable<V>) {
		this.map.set(key, new Set(values));
		return this;
	}
	*[Symbol.iterator]() {
		for (let [key, values] of this.map) {
			for (let value of values) {
				yield [key, value];
			}
		}
	}
	iterateValues(key: K): IterableIterator<V> | undefined {
		let values = this.map.get(key);
		if (values) return values.values();
	}
	keys() {
		return this.map.keys();
	}
	static fromObject<V>(object: {[key: string]: V[]}): MultiMap<string, V> {
		const map = new MultiMap<string, V>();
		for (let [key, values] of Object.entries(object)) {
			map.add(key);
			for (let value of values) {
				map.add(key, value);
			}
		}
		return map;
	}
	static toObject<K, V>(
		map: MultiMap<K, V>,
		stringifyKey: (k: K) => string = String,
		stringifyValue: (v: V) => string = String
	) {
		const out: {[key: string]: string[]} = {};
		for (let key of map.keys()) {
			out[stringifyKey(key)] = [...map.iterateValues(key)!].map(stringifyValue);
		}
		return out;
	}
}
