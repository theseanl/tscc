/**
 * @fileoverview this is a hand-written d.ts file for goog.reflect.
 * TODO use clutz to auto-generate this.
 */
declare module "goog:goog.reflect" {
	namespace ns {
		function object<T extends {}>(type: object, literal: T): T
		function objectProperty<T>(prop: keyof T & string, object: T): string
		function sinkValue<T>(value: T): T
		function canAccessProperty<T>(obj: T, prop: keyof T): boolean
		function cache<K extends string | number, V>(cacheObj: {[key: string]: V}, key: K, valueFn: (key: K) => V): V
		function cache<K extends string | number, V, L>(cacheObj: {[key: string]: V}, key: L, valueFn: (key: L) => V, opt_keyFn?: (key: L) => K): V

	}
	export default ns;
}
