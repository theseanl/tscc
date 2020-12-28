import { SourceMapConsumer, SourceMapGenerator, Mapping, RawSourceMap } from 'source-map';

/**
 * From a file with sourcemap, splice intervals specified with the third argument
 * and translate sourcemaps accordingly.
 * @param content
 * @param map
 * @param spliceIntervals sorted, non-overlapping intervals to splice.
 */
export default async function spliceSourceMap(content: string, map: RawSourceMap, spliceIntervals: [number, number][]): Promise<RawSourceMap> {
	const consumer = await new SourceMapConsumer(map);
	const generator = new SourceMapGenerator({ file: map.file });

	const seeker = new Seeker(content, spliceIntervals);

	consumer.eachMapping(({ source, generatedLine, generatedColumn, originalLine, originalColumn, name }) => {
		// line numbers in mozilla/source-map are 1-based. column numbers are 0-based.
		seeker.seek(generatedLine - 1, generatedColumn);
		if (seeker.isInInterval()) return;
		let transformedLine = seeker.getTransformedLine();
		let transformedColumn = seeker.getTransformedColumn();
		const mapping = getMapping(
			source, 
			transformedLine + 1, 
			transformedColumn,
			originalLine, 
			originalColumn,
			name
		);
		generator.addMapping(mapping);
	});

	return generator.toJSON();
}

/**
 * A lot of seemingly unused code was removed here that did not affect test
 * runs. If some mysterious source map bug emerges, look here first.
 */

function getMapping(
	source: string,
	generatedLine: number,
	generatedColumn: number,
	originalLine: number,
	originalColumn: number,
	name: string
): Mapping {
	return <Mapping>{
		name,
		source,
		generated: {
			line: generatedLine,
			column: generatedColumn,
		},
		original: {
			line: originalLine,
			column: originalColumn,
		},
	};
}

export function splitWithRegex(contents: string, regex: RegExp) {
	const intervals: [number, number][] = [];
	let prevEnd = 0;
	let replacedContent = '';
	let execRes: RegExpExecArray | null;
	while ((execRes = regex.exec(contents)) !== null) {
		let removeStart = execRes.index;
		let removeEnd = removeStart + execRes[0].length;
		replacedContent += contents.substring(prevEnd, removeStart);
		prevEnd = removeEnd;
		intervals.push([removeStart, removeEnd])
	}
	replacedContent += contents.substring(prevEnd);
	return { contents: replacedContent, intervals }
}

export class Seeker {
	constructor(
		private contents: string,
		private intervals: [number, number][]
	) { }
	/*************** State machine state *****************/
	// Current cursor position descriptors
	private line = 0;
	private column = 0;
	private index = 0;
	private lineStart = 0; // Index of current line's start
	private intervalIndex = -1; // Index of last interval whose start comes before then or at the same point with the current index
	private accLine = 0;
	private accColumn = 0;
	/************* State machine state end ***************/

	/**
	 * Seeks the last interval that intersects with the interval [0, index], starting from the current interval.
	 * Returns a contribution of lengths occupied by intervals in [this.Index, index).
	 * (Beware the parentheses)
	 */
	private seekInterval(index: number) {
		let { intervalIndex, index: prevIndex } = this;
		let occupied = 0;
		if (intervalIndex === -1) intervalIndex = 0;
		let interval = this.getInterval(intervalIndex);
		while (interval && interval[0] <= index) {
			if (interval[1] > prevIndex) {
				occupied += min(interval[1], index) - max(interval[0], prevIndex);
			}
			interval = this.getInterval(++intervalIndex);
		}
		this.intervalIndex = intervalIndex - 1;
		return occupied;
	}
	private seekWithinLine(nextColumn: number) {
		let increment = nextColumn - this.column;
		let nextIndex = this.index + increment;

		// Update column (line and lineStart stays the same)
		let lineEnd = this.nextLineBreak();
		if (lineEnd !== -1 && nextIndex > lineEnd)
			throw new Error('EOL');
		if (nextIndex >= this.contents.length) throw new Error('EOF');

		this.column = nextColumn;

		// Update intervalIndex, accColumn (accLine stays the same)
		let occupied = this.seekInterval(nextIndex);
		this.accColumn += increment - occupied;
		this.index = nextIndex;
	}
	private nextLine() {
		// Update line,column,lineStart
		let lineStart = this.nextLineBreak() + 1;
		if (lineStart > 0 && this.contents.length <= lineStart)
			throw new Error(`EOF`);

		this.lineStart = lineStart;
		this.line++;
		this.column = 0;
		let increment = lineStart - this.index;

		// Update interavlIndex, accLine, accColumn
		// Check if there is an interval containing lineStart - 1 (index of '\n')
		let occupied = this.seekInterval(lineStart - 1);
		let interval = this.getInterval(this.intervalIndex);

		this.index = lineStart; // Setting it after seekInterval call, as it requires prev index.

		if (!interval || interval[1] <= lineStart - 1) {
			// No interval contains the previous line break character - accLine will be increased.
			this.accLine++;
			this.accColumn = 0;
			// intervalIndex may need to proceed one step further,
			// as we are looking for the latest interval s.t. interval[0] <= lineStart
			// See test "when interval ends with \n".
			let nextInterval = this.getInterval(this.intervalIndex + 1);
			if (nextInterval && nextInterval[0] === lineStart) this.intervalIndex++;
		} else {
			// This interval contains the line break character.
			// In order to get # of occupied positions before the lineStart, we need to increase
			// occupied by 1, since the line break character is occupied by the current interval.
			this.accColumn += increment - occupied - 1;
		}
	}
	seek(nextLine: number, nextColumn: number) {
		while (nextLine > this.line) {
			this.nextLine();
		}
		this.seekWithinLine(nextColumn);
	}

	// Querying methods
	isInInterval(): boolean {
		let currentInterval = this.getInterval(this.intervalIndex);
		return currentInterval && currentInterval[1] > this.index;
	}
	getTransformedLine(): number {
		return this.accLine;
	}
	getTransformedColumn(): number {
		return this.accColumn;
	}

	private nextLineBreak(): number {
		return this.contents.indexOf('\n', this.index) || this.contents.length;
	}
	private getInterval(intervalIndex: number): [number, number] {
		return this.intervals[intervalIndex];
	}
}

function max(a: number, b: number) {
	return a > b ? a : b;
}

function min(a: number, b: number) {
	return a > b ? b : a;
}
