export default class PartialMap<K, V extends {}> extends Map<K, Partial<V>> {
	set(key: K, value: Partial<V>) {
		if (!this.has(key)) {
			super.set(key, value);
		} else {
			let prevValue = this.get(key);
			Object.assign(prevValue, value);
		}
		return this;
	}
}
