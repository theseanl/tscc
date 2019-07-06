///<reference types="jest"/>
import computeChunkAllocation from '../src/sort_chunks';
import MultiMap from '../src/MultiMap';

describe(`computeChunkAllocation`, function () {
	test(`Returns a trivial map when only one chunk is provided`, function () {
		const trivialChunkMap = {"entry.js": []};
		const trivialEntryDep = MultiMap.fromObject({"entry.js": []});
		const expectedChunkAlloc = {"entry.js": ["entry.js"]};
		const computedChunkAlloc = computeChunkAllocation(trivialChunkMap, trivialEntryDep);
		expect(MultiMap.toObject(computedChunkAlloc)).toEqual(expectedChunkAlloc);
	})
	test(`Returns an expected allocation map for a diamond dependency graph`, function () {
		const diamondEntryDep = new MultiMap<string, string>();
		diamondEntryDep.putAll("a.js", []);
		diamondEntryDep.putAll("b.js", ["a.js"]);
		diamondEntryDep.putAll("c.js", ["a.js"]);
		diamondEntryDep.putAll("d.js", ["b.js", "c.js"]);

		const chunkDep = {
			"a.js": ["ab.js", "ac.js", "ad.js", "abc.js", "abd.js", "acd.js", "abcd.js"],
			"b.js": ["ab.js", "bc.js", "bd.js", "abc.js", "abd.js", "bcd.js", "abcd.js"],
			"c.js": ["ac.js", "bc.js", "cd.js", "abc.js", "acd.js", "bcd.js", "abcd.js"],
			"d.js": ["ad.js", "bd.js", "cd.js", "abd.js", "acd.js", "bcd.js", "abcd.js"],
			"ab.js": ["abc.js", "abd.js", "abcd.js"],
			"ac.js": ["abc.js", "acd.js", "abcd.js"],
			"ad.js": ["abd.js", "acd.js", "abcd.js"],
			"bc.js": ["abc.js", "bcd.js", "abcd.js"],
			"bd.js": ["abd.js", "bcd.js", "abcd.js"],
			"cd.js": ["acd.js", "bcd.js", "abcd.js"],
			"abc.js": ["abcd.js"],
			"abd.js": ["abcd.js"],
			"acd.js": ["abcd.js"],
			"bcd.js": ["abcd.js"],
			"abcd.js": []
		};

		const expectedAlloc = { // Order may vary
			"a.js": ["abcd.js", "abc.js", "abd.js", "acd.js", "bcd.js", "ab.js", "ac.js", "ad.js", "bc.js", "a.js"],
			"b.js": ["bd.js", "b.js"],
			"c.js": ["cd.js", "c.js"],
			"d.js": ["d.js"]
		}
		const computedAlloc = MultiMap.toObject(computeChunkAllocation(chunkDep, diamondEntryDep));
		expect(new Set(Object.keys(computedAlloc))).toEqual(new Set(["a.js", "b.js", "c.js", "d.js"]));
		expect(computedAlloc["b.js"]).toEqual(expectedAlloc["b.js"]);
		expect(computedAlloc["c.js"]).toEqual(expectedAlloc["c.js"]);
		expect(computedAlloc["d.js"]).toEqual(expectedAlloc["d.js"]);
		expect(computedAlloc["a.js"][0]).toBe("abcd.js"); // This is necessary
		for (let [chunk, deps] of Object.entries(chunkDep)) {
			for (let dep of deps) {
				let dependencyOccurence = computedAlloc["a.js"].indexOf(dep);
				let chunkOccurence = computedAlloc["a.js"].indexOf(chunk);
				if (dependencyOccurence !== -1 && chunkOccurence !== -1) {
					expect(dependencyOccurence).toBeLessThan(chunkOccurence);
				}
			}
		}
	})
	test(`Removes dependencies among entry points`, function () {
		const entryDep = MultiMap.fromObject(({
			"entry-1.js": [],
			"entry-2.js": ["entry-1.js"]
		}));
		const chunkDep = {
			"chunk-1.js": [],
			"chunk-2.js": [],
			"entry-1.js": ["chunk-1.js"],
			"entry-2.js": ["chunk-1.js", "chunk-2.js", "entry-1.js"]
		};
		const computedAlloc = MultiMap.toObject(computeChunkAllocation(chunkDep, entryDep));
		expect(computedAlloc).toEqual({
			"entry-1.js": ["chunk-1.js", "entry-1.js"],
			"entry-2.js": ["chunk-2.js", "entry-2.js"]
		});
	})
})
