import { Plugin, PluginImpl, ResolveIdHook, LoadHook } from 'rollup';
import { TsccSpec, ITsccSpec, IInputTsccSpecJSON } from '@tscc/tscc-spec';

const pluginImpl: PluginImpl = (pluginOptions: IInputTsccSpecJSON) => {
	const spec: ITsccSpec = TsccSpec.loadSpec(pluginOptions);

	const EMPTY_BUNDLE_ID = "\0empty_bundle_id"; // virtual modules, see https://rollupjs.org/guide/en#conventions 

	/* Plugin methods start */
	const name = "rollup-plugin-tscc";
	const options: Plugin["options"] = (options = {}) => {
		// Add entry files read fom tsccconfig
		options.input = spec.getOutputNameToEntryFileMap();
		options.external = spec.getExternalModuleNames();
		return options;
	};
	const outputOptions: Plugin["outputOptions"] = (outputOptions = {}) => {
		outputOptions.dir = '.';
		outputOptions.entryFileNames = "[name].js";
		outputOptions.globals = spec.getExternalModuleNamesToGlobalsMap();
		return outputOptions;
	}
	const resolveId: ResolveIdHook = (source) => {
		let depsPath = spec.resolveRollupExternalDeps(source);
		if (depsPath) {
			return require('path').resolve(process.cwd(), depsPath);
			// Using 'posix' does not work well with rollup internals
		}
		if (source.startsWith(EMPTY_BUNDLE_ID)) {
			return source;
		}
	};
	const load: LoadHook = (id: string) => {
		if (id.startsWith(EMPTY_BUNDLE_ID)) {
			return Promise.resolve('');
		}
	};
	return { name, options, outputOptions, resolveId, load };
}

export default pluginImpl;

