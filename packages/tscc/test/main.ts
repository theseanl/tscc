import {parseTsccCommandLineArgs, buildTsccSpecJSONAndTsArgsFromArgs} from '../src/main'


describe(`buildTsccSpecJSONAndTsArgsFromArgs`, () => {
	test(`transforms --module flag to "modules" property of spec JSON`, () => {
		const testArgs = [
			'--module', 'entry:entry.ts',
			'--module', 'dependency:dependency.ts:entry:',
			'--module', 'dependency2:dependency2.ts:entry,dependency:css_renaming_map.js'
		]
		const {tsccSpecJSON} = buildTsccSpecJSONAndTsArgsFromArgs(parseTsccCommandLineArgs(testArgs, false));
		expect(tsccSpecJSON.modules).toEqual([
			{
				moduleName: 'entry',
				entry: 'entry.ts'
			}, {
				moduleName: 'dependency',
				entry: 'dependency.ts',
				dependencies: ['entry']
			}, {
				moduleName: 'dependency2',
				entry: 'dependency2.ts',
				dependencies: ['entry', 'dependency'],
				extraSources: ['css_renaming_map.js']
			}
		])
	})
	test(`transforms --spec flag to "specFile" property of spec JSON`, () => {
		const testArgs = [
			'--spec', 'src'
		];
		const {tsccSpecJSON} = buildTsccSpecJSONAndTsArgsFromArgs(parseTsccCommandLineArgs(testArgs, false));
		expect(tsccSpecJSON.specFile).toEqual('src');
	})
	test(`transforms nested --prefix flags to a nested object of spec JSON`, () => {
		const testArgs = [
			"--prefix.rollup", "gen/dev/",
			"--prefix.cc", "gen/prod/"
		];
		const {tsccSpecJSON} = buildTsccSpecJSONAndTsArgsFromArgs(parseTsccCommandLineArgs(testArgs, false));
		expect(tsccSpecJSON.prefix).toEqual({
			"rollup": "gen/dev/",
			"cc": "gen/prod/"
		})
	})
	test(`transforms nested --debug flags to a nested object of spec JSON`, () => {
		const testArgs = [
			"--debug.persistArtifacts",
			"--debug.ignoreWarningsPath", "/node_modules/",
		];
		const {tsccSpecJSON} = buildTsccSpecJSONAndTsArgsFromArgs(parseTsccCommandLineArgs(testArgs, false));
		expect(tsccSpecJSON.debug).toEqual({
			"persistArtifacts": true,
			"ignoreWarningsPath": ["/node_modules/"]
		})
	})
	test(`transforms closure compiler arguments to "compilerFlags" property of spec json`, () => {
		const testArgs = [
			'--',
			'--project', '.',
			'--',
			'--externs', 'extern1.js',
			'--externs', 'extern2.js',
			'--assume_function_wrapper'
		];
		const {tsccSpecJSON} = buildTsccSpecJSONAndTsArgsFromArgs(parseTsccCommandLineArgs(testArgs,false));
		expect(tsccSpecJSON.compilerFlags).toEqual({
			'externs': ['extern1.js', 'extern2.js'],
			'assume_function_wrapper': true
		})
	})
	test(`slices ts arguments part`, () => {
		const testArgs = [
			'--spec', '.',
			'--',
			'--project', 'src',
			'--downlevelIteration',
			'--target', 'ES2016',
			'--',
			'--rewrite_polyfills', 'false'
		];
		const {tsArgs} = buildTsccSpecJSONAndTsArgsFromArgs(parseTsccCommandLineArgs(testArgs, false));
		expect(tsArgs).toEqual(['--project', 'src', '--downlevelIteration', '--target', 'ES2016'])
	})
	test(`slices ts arguments part when cc arguments are not present`, () => {
		const testArgs = [
			'--spec', '.',
			'--',
			'--project', 'src'
		];
		const {tsArgs} = buildTsccSpecJSONAndTsArgsFromArgs(parseTsccCommandLineArgs(testArgs, false));
		expect(tsArgs).toEqual(['--project', 'src'])
	})
})

