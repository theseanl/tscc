/**
 * @fileoverview this is a hand-written, non-exhaustive d.ts file for closure library's base.js.
 * Instead of automatically generating this using clutz, we provide here a few definitions
 * written in hand, as in many cases one can refine type information than what clutz provides.
 *  - closure annotation {Object} incompatible with Typescript: dict-type object cannot be assigned
 *    to Object in Typescript.
 *  - One may use type predicates to provide a better user experience
 */

declare namespace goog {

	/**
	 * Reference to the global object.
	 * https://www.ecma-international.org/ecma-262/9.0/index.html#sec-global-object
	 *
	 * More info on this implementation here:
	 * https://docs.google.com/document/d/1NAeW4Wk7I7FV0Y2tcUFvQdGMc89k2vdgSXInw8_nvCI/edit
	 *
	 * @const
	 * @suppress {undefinedVars} self won't be referenced unless `this` is falsy.
	 * @type {!Global}
	 */
	const global: typeof globalThis;

	/**
	 * Handles strings that are intended to be used as CSS class names.
	 *
	 * This function works in tandem with @see goog.setCssNameMapping.
	 *
	 * Without any mapping set, the arguments are simple joined with a hyphen and
	 * passed through unaltered.
	 *
	 * When there is a mapping, there are two possible styles in which these
	 * mappings are used. In the BY_PART style, each part (i.e. in between hyphens)
	 * of the passed in css name is rewritten according to the map. In the BY_WHOLE
	 * style, the full css name is looked up in the map directly. If a rewrite is
	 * not specified by the map, the compiler will output a warning.
	 *
	 * When the mapping is passed to the compiler, it will replace calls to
	 * goog.getCssName with the strings from the mapping, e.g.
	 *     var x = goog.getCssName('foo');
	 *     var y = goog.getCssName(this.baseClass, 'active');
	 *  becomes:
	 *     var x = 'foo';
	 *     var y = this.baseClass + '-active';
	 *
	 * If one argument is passed it will be processed, if two are passed only the
	 * modifier will be processed, as it is assumed the first argument was generated
	 * as a result of calling goog.getCssName.
	 *
	 * @param {string} className The class name.
	 * @param {string=} opt_modifier A modifier to be appended to the class name.
	 * @return {string} The class name or the concatenation of the class name and
	 *     the modifier.
	 */
	function getCssName(className: string, opt_modifier?: string): string

	/**
	 * Sets the map to check when returning a value from goog.getCssName(). Example:
	 * <pre>
	 * goog.setCssNameMapping({
	 *   "goog": "a",
	 *   "disabled": "b",
	 * });
	 *
	 * var x = goog.getCssName('goog');
	 * // The following evaluates to: "a a-b".
	 * goog.getCssName('goog') + ' ' + goog.getCssName(x, 'disabled')
	 * </pre>
	 * When declared as a map of string literals to string literals, the JSCompiler
	 * will replace all calls to goog.getCssName() using the supplied map if the
	 * --process_closure_primitives flag is set.
	 *
	 * @param {!Object} mapping A map of strings to strings where keys are possible
	 *     arguments to goog.getCssName() and values are the corresponding values
	 *     that should be returned.
	 * @param {string=} opt_style The style of css name mapping. There are two valid
	 *     options: 'BY_PART', and 'BY_WHOLE'.
	 * @see goog.getCssName for a description.
	 */
	function setCssNameMapping(mapping: {[key: string]: string}, opt_style: 'BY_PART' | 'BY_WHOLE'): void

	/**
	 * Gets a localized message.
	 *
	 * This function is a compiler primitive. If you give the compiler a localized
	 * message bundle, it will replace the string at compile-time with a localized
	 * version, and expand goog.getMsg call to a concatenated string.
	 *
	 * Messages must be initialized in the form:
	 * <code>
	 * var MSG_NAME = goog.getMsg('Hello {$placeholder}', {'placeholder': 'world'});
	 * </code>
	 *
	 * This function produces a string which should be treated as plain text. Use
	 * {@link goog.html.SafeHtmlFormatter} in conjunction with goog.getMsg to
	 * produce SafeHtml.
	 *
	 * @param {string} str Translatable string, places holders in the form {$foo}.
	 * @param {Object<string, string>=} opt_values Maps place holder name to value.
	 * @param {{html: boolean}=} opt_options Options:
	 *     html: Escape '<' in str to '&lt;'. Used by Closure Templates where the
	 *     generated code size and performance is critical which is why {@link
	 *     goog.html.SafeHtmlFormatter} is not used. The value must be literal true
	 *     or false.
	 * @return {string} message with placeholders filled.
	 */
	function getMsg(str: string, opt_values?: {[key: string]: string}, opt_options?: {html: boolean}): string

	/**
	 * Gets a localized message. If the message does not have a translation, gives a
	 * fallback message.
	 *
	 * This is useful when introducing a new message that has not yet been
	 * translated into all languages.
	 *
	 * This function is a compiler primitive. Must be used in the form:
	 * <code>var x = goog.getMsgWithFallback(MSG_A, MSG_B);</code>
	 * where MSG_A and MSG_B were initialized with goog.getMsg.
	 *
	 * @param {string} a The preferred message.
	 * @param {string} b The fallback message.
	 * @return {string} The best translated message.
	 */
	function getMsgWithFallback(a: string, b: string): string

	/**
	 * Exposes an unobfuscated global namespace path for the given object.
	 * Note that fields of the exported object *will* be obfuscated, unless they are
	 * exported in turn via this function or goog.exportProperty.
	 *
	 * Also handy for making public items that are defined in anonymous closures.
	 *
	 * ex. goog.exportSymbol('public.path.Foo', Foo);
	 *
	 * ex. goog.exportSymbol('public.path.Foo.staticFunction', Foo.staticFunction);
	 *     public.path.Foo.staticFunction();
	 *
	 * ex. goog.exportSymbol('public.path.Foo.prototype.myMethod',
	 *                       Foo.prototype.myMethod);
	 *     new public.path.Foo().myMethod();
	 *
	 * @param {string} publicPath Unobfuscated name to export.
	 * @param {*} object Object the name should point to.
	 * @param {Object=} opt_objectToExportTo The object to add the path to; default
	 *     is goog.global.
	 */
	function exportSymbol(publicPath: string, object: any, opt_objectToExportTo?: {}): void

	/**
	 * Exports a property unobfuscated into the object's namespace.
	 * ex. goog.exportProperty(Foo, 'staticFunction', Foo.staticFunction);
	 * ex. goog.exportProperty(Foo.prototype, 'myMethod', Foo.prototype.myMethod);
	 * @param {Object} object Object whose static property is being exported.
	 * @param {string} publicName Unobfuscated name to export.
	 * @param {*} symbol Object the name should point to.
	 */
	function exportProperty(object: {}, publicName: string, symbol: any): void

	/**
	 * Defines a named value. In uncompiled mode, the value is retrieved from
	 * CLOSURE_DEFINES or CLOSURE_UNCOMPILED_DEFINES if the object is defined and
	 * has the property specified, and otherwise used the defined defaultValue.
	 * When compiled the default can be overridden using the compiler options or the
	 * value set in the CLOSURE_DEFINES object. Returns the defined value so that it
	 * can be used safely in modules. Note that the value type MUST be either
	 * boolean, number, or string.
	 *
	 * @param {string} name The distinguished name to provide.
	 * @param {T} defaultValue
	 * @return {T} The defined value.
	 * @template T
	 */
	function define<T extends string | number | boolean>(name: string, defaultValue: T): T

	/**
	 * @define {boolean} DEBUG is provided as a convenience so that debugging code
	 * that should not be included in a production. It can be easily stripped
	 * by specifying --define goog.DEBUG=false to the Closure Compiler aka
	 * JSCompiler. For example, most toString() methods should be declared inside an
	 * "if (goog.DEBUG)" conditional because they are generally used for debugging
	 * purposes and it is difficult for the JSCompiler to statically determine
	 * whether they are used.
	 */
	var DEBUG: boolean;


	//==============================================================================
	// Language Enhancements
	//==============================================================================

	/**
	 * This is a "fixed" version of the typeof operator.  It differs from the typeof
	 * operator in such a way that null returns 'null' and arrays return 'array'.
	 * @param {?} value The value to get the type of.
	 * @return {string} The name of the type.
	 */
	function typeOf(value: any): "undefined" | "null" | "boolean" | "number" | "string" | "object" | "function" | "array"

	/**
	 * Returns true if the specified value is not undefined.
	 *
	 * @param {?} val Variable to test.
	 * @return {boolean} Whether variable is defined.
	 */
	function isDef<T>(x: T): x is T extends undefined ? never : T;

	/**
	 * Returns true if the specified value is a string.
	 * @param {?} val Variable to test.
	 * @return {boolean} Whether variable is a string.
	 */
	function isString(x: any): x is string

	/**
	 * Returns true if the specified value is a boolean.
	 * @param {?} val Variable to test.
	 * @return {boolean} Whether variable is boolean.
	 */
	function isBoolean(x: any): x is boolean

	/**
	 * Returns true if the specified value is a number.
	 * @param {?} val Variable to test.
	 * @return {boolean} Whether variable is a number.
	 */
	function isNumber(x: any): x is number

	/**
	 * Returns true if the specified value is null.
	 * @param {?} val Variable to test.
	 * @return {boolean} Whether variable is null.
	 */
	function isNull(x: any): x is null

	/**
	 * Returns true if the specified value is defined and not null.
	 * @param {?} val Variable to test.
	 * @return {boolean} Whether variable is defined and not null.
	 */
	function isDefAndNotNull<T>(x: T): x is NonNullable<T>
	/**
	 * Returns true if the specified value is an array.
	 * @param {?} val Variable to test.
	 * @return {boolean} Whether variable is an array.
	 */
	function isArray(x: any): x is Array<any>

	/**
	 * Returns true if the object looks like an array. To qualify as array like
	 * the value needs to be either a NodeList or an object with a Number length
	 * property. Note that for this function neither strings nor functions are
	 * considered "array-like".
	 *
	 * @param {?} val Variable to test.
	 * @return {boolean} Whether variable is an array.
	 */
	function isArrayLike(x: any): x is ArrayLike<any>


	/**
	 * Returns true if the object looks like a Date. To qualify as Date-like the
	 * value needs to be an object and have a getFullYear() function.
	 * @param {?} val Variable to test.
	 * @return {boolean} Whether variable is a like a Date.
	 */
	function isDateLike(x: any): x is Date

	/**
	 * Returns true if the specified value is a function.
	 * @param {?} val Variable to test.
	 * @return {boolean} Whether variable is a function.
	 */
	function isFunction(x: any): x is Function


	/**
	 * Returns true if the specified value is an object.  This includes arrays and
	 * functions.
	 * @param {?} val Variable to test.
	 * @return {boolean} Whether variable is an object.
	 */
	function isObject(x: any): x is NonNullable<object> | Function;
}

// This module name is a tsickle primitive, see `googmodule.ts` of tsickle. Instead of exposing
// `goog` to the global scope, we let users to write (precisely)
//
// import * as goog from 'goog:google3.javascript.closure.goog';
//
// to get a handle of a goog namespace.
declare module "goog:goog" {
	export = goog;
}
