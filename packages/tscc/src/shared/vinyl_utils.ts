import stream = require('stream')
import Vinyl = require('vinyl');
import Logger from '../log/Logger';
import chalk = require('chalk');
import spliceSourceMap, {splitWithRegex} from './sourcemap_splice';

import {RawSourceMap} from 'source-map';

// Custom property augmenting Vinyl interface used by gulp-sourcemaps
const SOURCE_MAP = 'sourceMap'

/**
 * JSON file format that Closure Compiler accepts.
 * See `AbstractCommandLineRunner#JsonFileSpec`
 */
export declare interface IClosureCompilerInputJson {
	path: string,
	src: string,
	sourceMap?: string
}

/**
 * JSON file format that Closure Compiler produces.
 * See `AbstractCommandLineRunner#outputJsonStream`
 * {@link https://github.com/google/closure-compiler/blob/master/src/com/google/javascript/jscomp/AbstractCommandLineRunner.java#L1517}
 * It is extremely weird that it accepts `sourceMap` as input but produces `source_map` as output.
 */
export declare interface IClosureCompilerOutputJson {
	path: string,
	src: string,
	source_map?: string
}

/**
 * Object produced by stream-json package
 */
interface ArrayStreamItem<T> {
	key: number,
	value: T
}

abstract class LoggingTransformStream extends stream.Transform {
	abstract _rawTransform(data: any, encoding: BufferEncoding): any
	constructor(
		protected logger: Logger
	) {super({objectMode: true});}
	async _transform(data: any, encoding: BufferEncoding, callback: stream.TransformCallback) {
		let transformed: any;
		try {
			transformed = await this._rawTransform(data, encoding);
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e));
			this.logger.log(chalk.red('Error during post-transformation: '));
			this.logger.log(error.stack!);
			callback(error);
			return;
		}
		callback(null, transformed);
	}
}

export class ClosureJsonToVinyl extends LoggingTransformStream {
	constructor(
		private applySourceMap: boolean | undefined,
		logger: Logger
	) {super(logger)}
	_rawTransform(data: ArrayStreamItem<IClosureCompilerOutputJson>, encoding: BufferEncoding) {
		if (!data) return data;
		const json = data.value;
		const vinyl = new Vinyl({
			path: json.path,
			contents: Buffer.from(json.src)
		});
		if (this.applySourceMap && json.source_map) {
			// Custom property used by gulp-sourcemaps and plugins supporting it
			vinyl[SOURCE_MAP] = JSON.parse(json.source_map);
		}
		return vinyl;
	}
}

export class RemoveTempGlobalAssignments extends LoggingTransformStream {
	async _rawTransform(data: Vinyl, encoding: BufferEncoding) {
		if (data.isNull()) return data;
		const origContents = data.contents!.toString(encoding);
		// Fast path
		if (!origContents.includes('__tscc_export_start__')) return data;
		if (!data[SOURCE_MAP]) { // Simple regex replace
			data.contents = Buffer.from(origContents.replace(RemoveTempGlobalAssignments.reCcExport, ''));
		} else { // Perform sourcemap-aware replace
			const origMap: RawSourceMap = data[SOURCE_MAP];
			const {contents: replacedContents, intervals}
				= splitWithRegex(origContents, RemoveTempGlobalAssignments.reCcExport);
			const replacedMap = await spliceSourceMap(origContents, origMap, intervals);
			// Modify data
			data.contents = Buffer.from(replacedContents);
			data[SOURCE_MAP] = replacedMap;
		}
		return data;
	}
	private static reCcExport = /;?\s*["']__tscc_export_start__["'][\s\S]*["']__tscc_export_end__["']\s*/g;
}

