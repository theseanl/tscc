///<reference types="jest"/>
import {escapedGoogNameIsDts, escapeGoogAdmissibleName, unescapeGoogAdmissibleName} from '../../src/shared/escape_goog_identifier'

describe(`escape_goog_identifier`, () => {
	describe(`escapeGoogAdmissibleName, unescapeGoogAdmissiblename`, () => {
		test(
			`it defines a one-to-one correspondence between the set of strings`
			+ `and the set of valid goog identifiers`,
			() => {
				const testStrings = [
					`gXKDrQ5KkuKyjWBNHToI`,
					`ಠ_ಠಠ~ಠಠoಠಠxಠಠ.ಠಥ_ಥಠ益ಠ(⚆_⚆)( ͡ಠ ʖ̯ ͡ಠ)(¬_¬)( ಠل͟ಠ)┌∩┐(ಠ_ಠ)┌∩┐¯\_(ツ)_/¯( ͡° ͜ʖ ͡°)`,
					`asdf🈳asdfasdf🌧⛽⛪34etrtfgh#$%YTEDF🦎`
				];
				for (let testString of testStrings) {
					expect(unescapeGoogAdmissibleName(escapeGoogAdmissibleName(testString)))
						.toBe(testString);
				}
			}
		);
	});
	describe(`escapedGoogNameIsDts`, () => {
		test(`detects if an original(unescaped) string ends with .d.ts.`, () => {
			expect(escapedGoogNameIsDts(escapeGoogAdmissibleName(
				`🔴 🚈 ♊️ 🐏 🎁 🍻 🎺 😁 ❎ 🚾 ↪️ 🔵 ⏳ 🌯 🙏 🚣 💱 👂 ☹ 0️⃣.d.ts`
			))).toBe(true);
		})
	});
});
