///<reference types="jest"/>
import mergeChunk from "../src/merge_chunks";
import MultiMap from "../src/MultiMap";
import * as rollup from "rollup";

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
		const mergedChunk = await mergeChunk(entry, chunkAllocation, bundle);

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
		const mergedChunk = await mergeChunk(entry, chunkAllocation, bundle);

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
		const mergedChunk = await mergeChunk(entry, chunkAllocation, bundle);
		const anotherMergedChunk = await mergeChunk(anotherEntry, chunkAllocation, bundle);
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
			"entry.js": ["external", "entry.js"],
			"entry2.js": ["external", "entry2.js"],
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
		const mergedChunk = await mergeChunk("entry.js", chunkAllocation, bundle, globals);
		const anotherMergedChunk = await mergeChunk("entry2.js", chunkAllocation, bundle, globals);
		expect(mergedChunk.code).toMatchInlineSnapshot(`
		"var entry = (function (exports, A) {
			'use strict';

			console.log(A); const a = 1;

			exports.$0 = A;
			exports.a = a;

			return exports;

		})({}, External);
		"
	`);
		expect(anotherMergedChunk.code).toMatchInlineSnapshot(`
		"var entry2 = (function (exports, A, entry_js) {
			'use strict';

			console.warn(A); console.log(entry_js.a);

			exports.$0 = A;

			return exports;

		})({}, External, entry);
		"
	`);
	});
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
