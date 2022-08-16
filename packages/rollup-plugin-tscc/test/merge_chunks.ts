///<reference types="jest"/>
import { mergeAllES, mergeIIFE } from "../src/merge_chunks";
import MultiMap from "../src/MultiMap";
import * as rollup from "rollup";
import path = require("path");

describe(`mergeChunk`, function () {
	test(`merges chunks for a single entry`, async function () {
		const entry = "entry.js";
		const chunkAllocation = MultiMap.fromObject({
			"entry.js": ["chunk-0.js", "chunk-1.js", "entry.js"],
		});
		const bundle: rollup.OutputBundle = {
			"entry.js": mockChunk({
				fileName: "entry.js",
				code: `export const a = 'a'; export const b = 'b';`,
				exports: ["a", "b"],
				name: "entry",
			}),
			"chunk-0.js": mockChunk({
				fileName: "chunk-0.js",
				code: `export const a = 'c'; export const b = 'd';`,
				exports: ["a", "b"],
				name: "chunk-0",
			}),
			"chunk-1.js": mockChunk({
				fileName: "chunk-1.js",
				code: `export const a = 'e'; export const b = 'f';`,
				exports: ["a", "b"],
				name: "chunk-1",
			}),
		};
		const mergedChunk = await mergeIIFE(entry, chunkAllocation, bundle);

		expect(mergedChunk.name).toBe("entry");
		expect(mergedChunk.code).toMatchInlineSnapshot(`
		"var entry = (function (exports) {
			'use strict';

			const a$2 = 'c'; const b$2 = 'd';

			var chunk0 = {
				__proto__: null,
				a: a$2,
				b: b$2
			};

			const a$1 = 'e'; const b$1 = 'f';

			var chunk1 = {
				__proto__: null,
				a: a$1,
				b: b$1
			};

			const a = 'a'; const b = 'b';

			exports.$0 = chunk0;
			exports.$1 = chunk1;
			exports.a = a;
			exports.b = b;

			return exports;

		})({});
		"
	`);
		expect(mergedChunk.exports).toEqual(["$0", "$1", "a", "b"]);
		expect(mergedChunk.fileName).toBe(entry);
	});
	test(`merge chunks for a single entry with relative path imports and conflicting import name`, async function () {
		const entry = "entry.js";
		const chunkAllocation = MultiMap.fromObject({
			"entry.js": ["a/chunk-0.js", "b/c/chunk-1.js", "entry.js"],
		});
		const bundle: rollup.OutputBundle = {
			"entry.js": mockChunk({
				fileName: "entry.js",
				code: `import { a as A } from './a/chunk-0.js'; export const a = A; export const b = 'b'; export const $0 = 'c';`,
				exports: ["a", "b", "$0"],
				name: "entry",
			}),
			"a/chunk-0.js": mockChunk({
				fileName: "a/chunk-0.js",
				code: `import { b as B } from '../b/c/chunk-1.js'; export const a = 'c'; export const b = B;`,
				exports: ["a", "b"],
				name: "chunk-0",
			}),
			"b/c/chunk-1.js": mockChunk({
				fileName: "b/c/chunk-1.js",
				code: `export const a = 'e'; export const b = 'f';`,
				exports: ["a", "b"],
				name: "chunk-1",
			}),
		};
		const mergedChunk = await mergeIIFE(entry, chunkAllocation, bundle);

		expect(mergedChunk.name).toBe("entry");
		expect(mergedChunk.code).toMatchInlineSnapshot(`
		"var entry = (function (exports) {
			'use strict';

			const a$2 = 'e'; const b$2 = 'f';

			var chunk1 = {
				__proto__: null,
				a: a$2,
				b: b$2
			};

			const a$1 = 'c'; const b$1 = b$2;

			var chunk0 = {
				__proto__: null,
				a: a$1,
				b: b$1
			};

			const a = a$1; const b = 'b'; const $0 = 'c';

			exports.$0 = $0;
			exports.$1 = chunk0;
			exports.$2 = chunk1;
			exports.a = a;
			exports.b = b;

			return exports;

		})({});
		"
	`);
		expect(mergedChunk.exports).toEqual(["$0", "$1", "$2", "a", "b"]);
		expect(mergedChunk.fileName).toBe(entry);
	});

	test(`merge chunks for with imports from external chunks`, async function () {
		const entry = "entry.js",
			chunk0 = "a/chunk-0.js",
			chunk1 = "b/c/chunk-1.js",
			anotherEntry = "d/another-entry.js",
			chunk2 = "e/f/chunk-2.js",
			chunk3 = "chunk-3.js",
			chunk4 = "chunk-4.js";
		const chunkAllocation = MultiMap.fromObject({
			[entry]: [chunk0, chunk1, entry],
			[anotherEntry]: [chunk2, chunk3, chunk4, anotherEntry],
		});
		const bundle: rollup.OutputBundle = {
			[entry]: mockChunk({
				fileName: entry,
				code:
					`import { b as e } from './${chunk3}'; import { c as f } from './${chunk0}';` +
					`export const a = 'a'; export const b = 'b'; export const c = e; export const d = f;`,
				exports: ["a", "b", "c", "d"],
				name: "entry",
			}),
			[chunk0]: mockChunk({
				fileName: chunk0,
				code: `import { a as c } from '../${chunk2}'; export const a = 'c'; export const b = 'd'; export { c };`,
				exports: ["a", "b", "c"],
				name: "chunk-0",
			}),
			[chunk1]: mockChunk({
				fileName: chunk1,
				code: `export const a = 'e'; export const b = 'f';`,
				exports: ["a", "b"],
				name: "chunk-1",
			}),
			[anotherEntry]: mockChunk({
				fileName: anotherEntry,
				code: `export const a = 'g'; export const b = 'h'; export const $0 = '$0';`,
				exports: ["a", "b", "$0"],
				name: "another-entry",
			}),
			[chunk2]: mockChunk({
				fileName: chunk2,
				code: `import { a as c } from '../../${chunk4}'; export const a = 'i'; export const b = c;`,
				exports: ["a", "b"],
				name: "chunk-2",
			}),
			[chunk3]: mockChunk({
				fileName: chunk3,
				code: `export const a = 'k'; export const b = 'l';`,
				exports: ["a", "b"],
				name: "chunk-3",
			}),
			[chunk4]: mockChunk({
				fileName: chunk4,
				code: `export const a = 'm'; export const b = 'n';`,
				exports: ["a", "b"],
				name: "chunk-4",
			}),
		};
		const mergedChunk = await mergeIIFE(entry, chunkAllocation, bundle);
		const anotherMergedChunk = await mergeIIFE(anotherEntry, chunkAllocation, bundle);
		expect(mergedChunk.code).toMatchInlineSnapshot(`
		"var entry = (function (exports, chunk2_js, chunk3_js) {
			'use strict';

			const a$2 = 'c'; const b$2 = 'd';

			var chunk0 = {
				__proto__: null,
				a: a$2,
				b: b$2,
				c: chunk2_js.a
			};

			const a$1 = 'e'; const b$1 = 'f';

			var chunk1 = {
				__proto__: null,
				a: a$1,
				b: b$1
			};

			const a = 'a'; const b = 'b'; const c = chunk3_js.b; const d = chunk2_js.a;

			exports.$0 = chunk0;
			exports.$1 = chunk1;
			exports.a = a;
			exports.b = b;
			exports.c = c;
			exports.d = d;

			return exports;

		})({}, another_entry.$1, another_entry.$2);
		"
	`);
		expect(anotherMergedChunk.code).toMatchInlineSnapshot(`
		"var another_entry = (function (exports) {
			'use strict';

			const a$3 = 'm'; const b$3 = 'n';

			var chunk4 = {
				__proto__: null,
				a: a$3,
				b: b$3
			};

			const a$2 = 'i'; const b$2 = a$3;

			var chunk2 = {
				__proto__: null,
				a: a$2,
				b: b$2
			};

			const a$1 = 'k'; const b$1 = 'l';

			var chunk3 = {
				__proto__: null,
				a: a$1,
				b: b$1
			};

			const a = 'g'; const b = 'h'; const $0 = '$0';

			exports.$0 = $0;
			exports.$1 = chunk2;
			exports.$2 = chunk3;
			exports.$3 = chunk4;
			exports.a = a;
			exports.b = b;

			return exports;

		})({});
		"
	`);
		// Test that bundled code evaluates well when concatenated
		expect(new Function(anotherMergedChunk.code + mergedChunk.code + `return entry.d`)()).toBe(
			"i"
		);
	});
	test(`Correctly merge chunks referencing external modules`, async function () {
		const chunkAllocation = MultiMap.fromObject({
			"entry.js": ["entry.js"],
			"entry2.js": ["entry2.js"],
		});
		const bundle: rollup.OutputBundle = {
			"entry.js": mockChunk({
				fileName: "entry.js",
				code: `import * as A from 'external'; console.log(A); export const a = 1;`,
				exports: ["a"],
				name: "entry",
			}),
			"entry2.js": mockChunk({
				fileName: "entry2.js",
				code: `import * as A from 'external'; import { a } from './entry.js'; console.warn(A); console.log(a);`,
				exports: [],
				name: "entry2",
			}),
		};
		const globals = {
			external: "External",
		};
		const mergedChunk = await mergeIIFE("entry.js", chunkAllocation, bundle, globals);
		const anotherMergedChunk = await mergeIIFE("entry2.js", chunkAllocation, bundle, globals);
		expect(mergedChunk.code).toMatchInlineSnapshot(`
		"var entry = (function (exports, A) {
			'use strict';

			console.log(A); const a = 1;

			exports.a = a;

			return exports;

		})({}, External);
		"
	`);
		expect(anotherMergedChunk.code).toMatchInlineSnapshot(`
		"(function (A, entry_js) {
			'use strict';

			console.warn(A); console.log(entry_js.a);

		})(External, entry);
		"
	`);
	});

	test(`Correctly merge chunks referencing external modules via relative paths`, async function () {
		const entry = "entry.js";
		const entry2 = "entry2.js";
		const chunk1 = "chunk1.js";
		const externalRelative = "external_relative";
		const externalAbsolute = path.resolve("external/absolute.js");
		const chunkAllocation = MultiMap.fromObject({
			[entry]: [chunk1, entry],
			[entry2]: [entry2],
		});
		const bundle: rollup.OutputBundle = {
			[entry]: mockChunk({
				fileName: entry,
				code:
					`import { C } from "${externalRelative}";` +
					`import { D } from "${externalAbsolute}";` +
					`export const c = C + D;`,
				exports: ["c"],
				name: "entry",
			}),
			[entry2]: mockChunk({
				fileName: entry2,
				code:
					`import { a } from "${externalRelative}";` +
					`import { e } from "${chunk1}";` +
					`export const d = a;` +
					`export const f = e;`,
				exports: ["d"],
				name: "entry2",
			}),
			[chunk1]: mockChunk({
				fileName: chunk1,
				code:
					`import { A } from "${externalAbsolute}";` +
					`import { B } from "${externalRelative}";` +
					`export const e = A + B;`,
				exports: ["e"],
				name: "chunk1",
			}),
		};
		const globals = {
			[externalRelative]: "ExternalRelative",
			[externalAbsolute]: "ExternalAbsolute",
		};

		const [mergedChunk, mergedChunk2] = await Promise.all([
			mergeIIFE(entry, chunkAllocation, bundle, globals),
			mergeIIFE(entry2, chunkAllocation, bundle, globals),
		]);
		expect(mergedChunk.code).toMatchInlineSnapshot(`
		"var entry = (function (exports, absolute_js, external_relative) {
			'use strict';

			const e = absolute_js.A + external_relative.B;

			var chunk1 = {
				__proto__: null,
				e: e
			};

			const c = external_relative.C + absolute_js.D;

			exports.$0 = chunk1;
			exports.c = c;

			return exports;

		})({}, ExternalAbsolute, ExternalRelative);
		"
	`);
		expect(mergedChunk2.code).toMatchInlineSnapshot(`
		"var entry2 = (function (exports, external_relative, chunk1_js) {
			'use strict';

			const d = external_relative.a;const f = chunk1_js.e;

			exports.d = d;
			exports.f = f;

			return exports;

		})({}, ExternalRelative, entry.$0);
		"
	`);
	});

	test(`merges chunk without external modules in ES6 modules format`, async function () {
		const entry = "entry.js";
		const entry2 = "entry2.js";
		const chunk1 = "chunk1.js";
		const chunkAllocation = MultiMap.fromObject({
			[entry]: [chunk1, entry],
			[entry2]: [entry2],
		});
		const bundle: rollup.OutputBundle = {
			[entry]: mockChunk({
				fileName: entry,
				code:
					`import { a, sum } from '${chunk1}'; ` +
					`export const c = sum(a, 1); ` +
					`console.log(sum(c, -1)); `,
				exports: ["c"],
			}),
			[entry2]: mockChunk({
				fileName: entry2,
				code:
					`import { b, sum } from "${chunk1}"; ` +
					`export const d = b + 2; ` +
					`export function add3(a, b, c) { return sum(sum(a, b), c); } ` +
					`console.log(add3(1, 2, 3)); `,
				exports: ["d"],
			}),
			[chunk1]: mockChunk({
				fileName: chunk1,
				code:
					`export const a = 3; ` +
					`export const b = 4; ` +
					`export function sum(a, b) { return a + b; } `,
				exports: ["a", "b"],
			}),
		};
		const [mergedESModuleChunk, mergedESModuleChunk2] = await mergeAllES(
			chunkAllocation,
			bundle,
			{},
			"es"
		);
		expect(mergedESModuleChunk.code).toMatchInlineSnapshot(`
		"const a = 3; function sum(a, b) { return a + b; }

		const c = sum(a, 1); console.log(sum(c, -1));

		export { sum as s };
		"
	`);
		expect(mergedESModuleChunk2.code).toMatchInlineSnapshot(`
		"import { s as sum } from './entry.js';

		function add3(a, b, c) { return sum(sum(a, b), c); } console.log(add3(1, 2, 3));
		"
	`);
	});
	test(`merges chunk containing external modules in ES6 module format`, async function () {
		const entry = "entry.js";
		const entry2 = "entry2.js";
		const chunk1 = "chunk1.js";
		const externalNonAbsolute = "external";
		const chunkAllocation = MultiMap.fromObject({
			[entry]: [chunk1, entry],
			[entry2]: [entry2],
		});
		const bundle: rollup.OutputBundle = {
			[entry]: mockChunk({
				fileName: entry,
				code: `import { sum } from "${externalNonAbsolute}";` + `console.log(sum(1, 2));`,
				exports: ["c"],
			}),
			[entry2]: mockChunk({
				fileName: entry2,
				code:
					`import { multiply } from "${externalNonAbsolute}";` +
					`import { sum3 } from "${chunk1}";` +
					`console.log(sum3(1, 2, multiply(3, 4)));`,
				exports: ["d"],
			}),
			[chunk1]: mockChunk({
				fileName: chunk1,
				code:
					`import { sum } from "${externalNonAbsolute}";` +
					`export function sum3(a, b, c) {
						return sum(a, sum(b, c));
					};`,
				exports: ["e"],
			}),
		};
		const globals = {
			[externalNonAbsolute]: "ExternalNonAbsolute",
		};
		const [mergedESModuleChunk, mergedESModuleChunk2] = await mergeAllES(
			chunkAllocation,
			bundle,
			globals,
			"es"
		);
		expect(mergedESModuleChunk.code).toMatchInlineSnapshot(`
		"import { sum } from 'external';

		console.log(sum(1, 2));

		function sum3(a, b, c) {
								return sum(a, sum(b, c));
							}

		export { sum3 as s };
		"
	`);
		expect(mergedESModuleChunk2.code).toMatchInlineSnapshot(`
		"import { multiply } from 'external';
		import { s as sum3 } from './entry.js';

		console.log(sum3(1, 2, multiply(3, 4)));
		"
	`);
	});
	test.todo(
		`merges chunk containing external modules referenced via relative path in ES6 module format`
	);
});

function mockChunk(chunk: Partial<rollup.OutputChunk>): rollup.OutputChunk {
	if (!("dynamicImports" in chunk)) chunk.dynamicImports || [];
	if (!("isEntry" in chunk)) chunk.isEntry = true;
	if (!("modules" in chunk)) chunk.modules = {};
	if (!("facadeModuleId" in chunk)) chunk.facadeModuleId = null;
	if (!("imports" in chunk)) chunk.imports = [];
	if (!("isDynamicEntry" in chunk)) chunk.isDynamicEntry = false;
	return <rollup.OutputChunk>chunk;
}
