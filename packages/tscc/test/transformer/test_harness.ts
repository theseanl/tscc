import * as ts from 'typescript';
import TsccSpecWithTS from '../../src/spec/TsccSpecWithTS';
import * as tsickle from 'tsickle';

type EmitTransformerFactory = (host: tsickle.TsickleHost) => tsickle.EmitTransformers;

export function emit(tsconfigPath: string, files: string[], transformerFactory: EmitTransformerFactory, override: Partial<ts.CompilerOptions> = {}) {
	const {parsedConfig} = TsccSpecWithTS.loadTsConfigFromPath(tsconfigPath);
	const {options} = parsedConfig;
	Object.assign(options, override);
	const host = ts.createCompilerHost(options);
	const program = ts.createProgram(files, options, host);
	const transformerHost = {
		shouldSkipTsickleProcessing: () => false,
		shouldIgnoreWarningsForPath: () => true,
		googmodule: false,
		pathToModuleName: x => x,
		fileNameToModuleId: x => x,
		moduleResolutionHost: ts.createCompilerHost(parsedConfig.options),
		options: parsedConfig.options,
	};

	const out = new Map<string, string>();
	const {externs} = tsickle.emitWithTsickle(
		program, transformerHost, host, options, undefined,
		(fileName, data) => {out.set(fileName, data);},
		undefined /* cancellationtoken */, false /* emitOnlyDtsFiles */,
		transformerFactory(transformerHost)
	);
	return {out, externs}
}

