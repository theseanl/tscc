///<reference types="jest" />
import spliceSourceMap, {Seeker, splitWithRegex} from '../../src/shared/sourcemap_splice';
import {SourceMapConsumer} from 'source-map';
import MagicString from 'magic-string';



const testString =
	`0123456789
01###2345678
0123#####45%%%%%678##9
%%%%%%01234##567%%%
%%%%89
####%%0123#########
###%%%%%%####%%%##%%%%
4567#####8
####012%%%3456

##0123

0123%%%%`;
const expected =
	`0123456789
012345678
0123456789
0123456789
012345678
0123456

0123

0123`

describe(`spliceWithRegex`, function () {
	test(`produces expected output`, function () {
		const {contents, intervals} = splitTestString(testString);
		expect(contents).toBe(expected);
		expect(intervals).toEqual([
			[13, 16], [28, 33],
			[35, 40], [43, 45],
			[47, 53], [58, 60],
			[63, 71], [74, 78],
			[78, 80], [84, 97],
			[97, 103], [103, 107],
			[107, 110], [110, 112],
			[112, 117], [121, 126],
			[128, 132], [135, 138],
			[144, 146], [156, 160]
		]);
	});
})

describe(`Seeker`, function () {
	test(`correctly maps positions when it is queried multiple times within a line`, function () {
		const testString = `012###34####5####67##89##`;
		const {intervals} = splitTestString(testString);
		const seeker = new Seeker(testString, intervals);
		const t = new TestSupport(seeker);

		expect(t.pos(0, 2)).toEqual([0, 2]);
		expect(t.pos(0, 5)).toBeUndefined();
		expect(t.pos(0, 6)).toEqual([0, 3]);
		expect(t.pos(0, 13)).toBeUndefined();
		expect(t.pos(0, 16)).toBeUndefined();
		expect(t.pos(0, 21)).toEqual([0, 8]);
	});

	test.skip(`correctly maps positions when it skips quering several lines`, function () {
		const {intervals} = splitTestString(testString);
		const seeker = new Seeker(testString, intervals);
		const t = new TestSupport(seeker);

		expect(t.pos(4, 4)).toEqual([3, 8]);
		expect(t.pos(8, 10)).toEqual([5, 3]);
		expect(t.pos(12, 4)).toEqual([9, 4])
	})

	test(`correctly maps positions when there are intervals ending with line break characters`, function () {
		const testString = [
			"01234",
			"###01234",
			"01234"
		].join('\n');
		const {intervals} = splitTestString(testString);
		const seeker = new Seeker(testString, intervals);
		const t = new TestSupport(seeker);
		expect(t.pos(0, 3)).toEqual([0, 3]);
		expect(t.pos(1, 4)).toEqual([1, 1]);
		expect(t.pos(2, 2)).toEqual([2, 2])
	})

	test(`correctly maps positions with a contrived example`, function () {
		const {intervals} = splitTestString(testString);
		const seeker = new Seeker(testString, intervals);
		const t = new TestSupport(seeker);

		expect(t.pos(0, 4)).toEqual([0, 4]);
		expect(t.pos(0, 9)).toEqual([0, 9]);
		expect(t.pos(0, 10)).toEqual([0, 10]);

		expect(t.pos(1, 1)).toEqual([1, 1]);
		expect(t.pos(1, 2)).toBeUndefined();
		expect(t.pos(1, 4)).toBeUndefined();
		expect(t.pos(1, 5)).toEqual([1, 2]);
		expect(t.pos(1, 12)).toEqual([1, 9]);

		expect(t.pos(2, 16)).toEqual([2, 6]);

		expect(t.pos(3, 15)).toEqual([3, 7]);
		expect(t.pos(4, 5)).toEqual([3, 9]);

		expect(t.pos(5, 7)).toEqual([4, 1]);
		expect(t.pos(6, 14)).toBeUndefined();
		expect(t.pos(7, 0)).toEqual([4, 4]);
		expect(t.pos(7, 9)).toEqual([4, 8]);

		expect(t.pos(9, 0)).toEqual([6, 0])
		expect(t.pos(10, 0)).toBeUndefined();
		expect(t.pos(10, 2)).toEqual([7, 0]);

		expect(t.pos(12, 3)).toEqual([9, 3]);
		expect(t.pos(12, 7)).toBeUndefined();
		expect(() => {t.pos(12, 8)}).toThrow();
	})

	class TestSupport {
		constructor(
			private seeker: Seeker
		) {}
		pos(line: number, column: number) {
			this.seeker.seek(line, column);
			if (this.seeker.isInInterval()) return;
			line = this.seeker.getTransformedLine();
			column = this.seeker.getTransformedColumn();
			return [line, column];
		}
	}
})

function splitTestString(string: string, regex: RegExp = /(?:#[#\s]+|%[%\s]+)/g) {
	return splitWithRegex(string, regex)
}

describe(`spliceSourceMap`, function () {
	test(`Does expected things`, async () => {
		const testString = Array.from({length: 20}, () => '#').join('');
		const ms = new MagicString(testString);
		const map = JSON.parse(ms.generateMap({hires: true}).toString());
		const map2 = JSON.parse(ms.remove(3, 5).remove(11, 13).generateMap({hires: true}).toString());
		expect(new Set(Object.keys(map))).toEqual(new Set(Object.keys(map2)));
		for (let key in map) {
			if (key === 'mappings') continue;
			expect(map[key]).toEqual(map2[key]);
		}
		const splicedMap = await spliceSourceMap(testString, map, [[3, 5], [11, 13]]);

		const consumer = await SourceMapConsumer.with(splicedMap, null, async function (consumer) {
			const consumer2 = await SourceMapConsumer.with(map2, null, async function (consumer2) {
				consumer.eachMapping(mapping => {
					const origPos = consumer.originalPositionFor({
						line: mapping.generatedLine,
						column: mapping.generatedColumn
					});
					const origPos2 = consumer2.originalPositionFor({
						line: mapping.generatedLine,
						column: mapping.generatedColumn
					});
					expect(origPos).toEqual(origPos2)
				})
			});
		});
	})
})

