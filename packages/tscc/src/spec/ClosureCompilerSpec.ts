import * as ts from 'typescript';
import {primitives} from '@tscc/tscc-spec';

/**
 * Available ES targets. Here, we distinguish between ES5 and ES5_STRICT, but
 * target ES5_STRICT by default. 
 */
export enum ES_VERSION {
	ES3 = "ECMASCRIPT3",
	ES5 = "ECMASCRIPT5",
	ES5_STRICT = "ECMASCRIPT5_STRICT",
	ES2015 = "ECMASCRIPT_2015",
	ES2016 = "ECMASCRIPT_2016",
	ES2017 = "ECMASCRIPT_2017",
	ES2018 = "ECMASCRIPT_2018",
	ES2019 = "ECMASCRIPT_2019",
	ESNext = "ECMASCRIPT_NEXT"
}

export const ES_TARGETS: {
	[key: string]: ES_VERSION,
} = {
	[ts.ScriptTarget.ES3]: ES_VERSION.ES3,
	[ts.ScriptTarget.ES5]: ES_VERSION.ES5_STRICT,
	[ts.ScriptTarget.ES2015]: ES_VERSION.ES2015,
	[ts.ScriptTarget.ES2016]: ES_VERSION.ES2016,
	[ts.ScriptTarget.ES2017]: ES_VERSION.ES2017,
	[ts.ScriptTarget.ES2018]: ES_VERSION.ES2018,
	[ts.ScriptTarget.ES2019]: ES_VERSION.ES2019,
	[ts.ScriptTarget.ESNext]: ES_VERSION.ESNext
}

/** 
 * Closure Compiler compilation level and CLI flag types.
 */
export type COMPILATION_LEVEL = 'ADVANCED' | 'SIMPLE';
export type COMPILER_FLAG_VALUE = primitives | primitives[] | undefined;

export interface ClosureCompilerFlags {
	[flag: string]: COMPILER_FLAG_VALUE,

	/** Initial defaults. */
	compilation_level: COMPILATION_LEVEL,
	language_in: ES_VERSION,
	language_out: ES_VERSION,

	/** Flags related to generated `@export` definitions. */
	generate_exports: boolean,
	export_local_property_definitions: true,

	/** Output fields. */
	js_output_file?: string,
	chunk_output_path_prefix?: string,

	/** Source maps. */
	create_source_map?: string,
	source_map_include_content?: boolean,
}

export const DEFAULT_FLAGS: ClosureCompilerFlags = {
	'compilation_level': 'ADVANCED',
	'language_in': ES_VERSION.ES3,
	'language_out': ES_VERSION.ES5,

	'generate_exports': true,
	'export_local_property_definitions': true,
};