///<reference types="jest"/>
import TypescriptDependencyGraph from '../../src/graph/TypescriptDependencyGraph';
import * as ts from 'typescript';
import path = require('path');

describe(`TypescriptDependencyGraph`, () => {
	it(`discovers transitive dependencies`, () => {
		const testProjectRoot = path.resolve(__dirname, '../sample/tsdepsgraph');
		const program = createProgramFromConfigFile(path.join(testProjectRoot, 'tsconfig.json'));
		const graph = new TypescriptDependencyGraph(program);
		graph.addRootFile(
			path.join(testProjectRoot, 'entry.ts')
		);
		expect(new Set(graph.iterateFiles())).toEqual(new Set([
			"entry.ts",
			"a.ts",
			"node_modules/aa/types2.d.ts",
			"ab.d.ts",
			"node_modules/ac/ac.d.ts",
			"b.d.ts",
			"bb.d.ts",
			"node_modules/bc/types3.d.ts",
			"node_modules/c/types.d.ts",
			"node_modules/c/cb.d.ts",
			"node_modules/c/node_modules/cc/cc.d.ts"
		].map(relPath => path.normalize(path.join(testProjectRoot, relPath)))));
	});
});

function createProgramFromConfigFile(configFilePath: string): ts.Program {
	const {fileNames, options} = ts.getParsedCommandLineOfConfigFile(
		path.resolve(__dirname, configFilePath),
		{},
		<any>ts.sys
	);
	const compilerHost = ts.createCompilerHost(options);
	return ts.createProgram(
		fileNames,
		options,
		compilerHost
	);
}
