/**
 * @fileoverview A valid goog.module name must start with [a-zA-Z_$] end only contain [a-zA-Z0-9._$].
 * This file provides an analogue of Javascript escape/unescape function pair for string identifiers
 * for goog.module, goog.provide, etc.
 * One does not lose information after escaping so that we can faithfully map converted module names
 * to the original TS source file's name.
 */
import path = require('path');

function codePoint(char: string) { return char.codePointAt(0); }
/**************************************************************************************************/
const LOWERCASE_A_CODE_POINT = codePoint('a')!;
const LOWERCASE_Z_CODE_POINT = codePoint('z')!;
const UPPERCASE_A_CODE_POINT = codePoint('A')!;
const UPPERCASE_Z_CODE_POINT = codePoint('Z')!;
const PERIOD_CODE_POINT = codePoint('.')!;
const LOWER_DASH_CODE_POINT = codePoint('_')!;
const DOLLAR_SIGN_CODE_POINT = codePoint('$')!;
const ZERO_CODE_POINT = codePoint('0')!;
const NINE_CODE_POINT = codePoint('9')!;
const SEP = path.sep;
/**************************************************************************************************/
function isLatin(code: number) {
	return (
		(LOWERCASE_A_CODE_POINT <= code && code <= LOWERCASE_Z_CODE_POINT) ||
		(UPPERCASE_A_CODE_POINT <= code && code <= UPPERCASE_Z_CODE_POINT));
}
function isNumber(code: number) {
	return ZERO_CODE_POINT <= code && code <= NINE_CODE_POINT;
}
function isLowerDash(code: number) {
	return code === LOWER_DASH_CODE_POINT;
}
function isPeriod(code: number) {
	return code === PERIOD_CODE_POINT;
}
function isDollarSign(code: number) {
	return code === DOLLAR_SIGN_CODE_POINT;
}
/**************************************************************************************************/
/**
 *                   Latin  ⟹  Latin
 *                  number  ⟹  number
 *                     "_"  ⟹  "_"
 *          path separator  ⟹  "." (for ergonomical reason)
 *                     "."  ⟹  "$."
 *     Any other character  ⟹  "$" followed by length 4 base36 representation of its code point,
 *                              left-padded with 0.
 *
 * This requires that the first character is not a path separator, in order to make sure that
 * the resulting escaped name does not start with ".", which is disallowed in goog.module. One should
 * always feed relative paths.
 */
export function escapeGoogAdmissibleName(name: string): string {
	let out = "";

	if (name[0] === SEP)
		throw new TypeError("Name cannot start with a path separator");

	else if (name.length > 0) {
		for (const char of name) {
			let code = codePoint(char)!;
			if (isLatin(code) || isNumber(code) || isLowerDash(code)) {
				out += char;
			} else if (char === SEP) {
				out += ".";
			} else if (isPeriod(code)) {
				out += "$.";
			} else {
				out += "$" + code.toString(36).padStart(4, "0");
			}
		}
	}

	return out;
}
export function unescapeGoogAdmissibleName(escapedName: string): string {
	let out = "";
	let i = 0;
	let code: number;
	// charCodeAt returns NaN when an index is out of range.
	while (!isNaN(code = escapedName.charCodeAt(i))) {
		if (isLatin(code) || isNumber(code) || isLowerDash(code)) {
			out += escapedName[i];
			i++;
		} else if (isPeriod(code)) {
			out += SEP;
			i++;
		} else if (isDollarSign(code)) {
			// If the next character is ".", add "."
			if (isPeriod(escapedName.charCodeAt(i + 1))) {
				out += ".";
				i += 2;
			} else {
				// Read next 4 chars
				try {
					let base32Codes = parseInt(escapedName.substr(i + 1, 4), 36);
					out += String.fromCodePoint(base32Codes);
					i += 5;
				} catch (e) {
					console.log(escapedName);
					throw new RangeError(`Invalid characters between position ${i + 1} and ${i + 4}`);
				}
			}
		} else {
			throw new RangeError(`Invalid character at position ${i}`);
		}
	}
	return out;
}
export function escapedGoogNameIsDts(escapedName: string) {
	return escapedName.endsWith("$.d$.ts");
}
