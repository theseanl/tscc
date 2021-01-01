import * as rollup from 'rollup';
import {IInputTsccSpecJSON} from '@tscc/tscc-spec';
import TsccSpecRollupFacade from './spec/TsccSpecRollupFacade';
import ITsccSpecRollupFacade from './spec/ITsccSpecRollupFacade';
import computeChunkAllocation, {ChunkSortError} from './sort_chunks';
import mergeChunks, {ChunkMergeError} from './merge_chunks';
import path = require('path');

const pluginImpl: (options: IInputTsccSpecJSON) => rollup.Plugin = (pluginOptions) => {
	const spec: ITsccSpecRollupFacade = TsccSpecRollupFacade.loadSpec(pluginOptions);

	const isManyModuleBuild = spec.getOrderedModuleSpecs().length > 1;
	const globals = spec.getRollupExternalModuleNamesToGlobalMap();

	// virtual modules, see https://rollupjs.org/guide/en#conventions
	const EMPTY_BUNDLE_ID = "\0empty_bundle_id";

	/* Plugin methods start */
	const name = "rollup-plugin-tscc";
	const options: rollup.Plugin["options"] = (options = {}) => {
		// Add entry files read fom tsccconfig
		options.input = spec.getRollupOutputNameToEntryFileMap();
		options.external = spec.getExternalModuleNames();
		return options;
	};
	const outputOptions: rollup.Plugin["outputOptions"] = (outputOptions = {}) => {
		outputOptions.dir = '.';
		outputOptions.entryFileNames = "[name].js";
		outputOptions.chunkFileNames = "_"; // rollup makes these unique anyway.
		outputOptions.globals = globals;
		if (isManyModuleBuild) {
			// For many-module build, currently only iife builds are available.
			// Intermediate build format is 'es'.
			outputOptions.format = 'es';
		}
		/**
		 * "paths" option is mainly intended to replace external module paths to 3rd-party CDN urls
		 * in the bundle output.
		 *
		 * Why are we doing this? Currently rollup's handling of external modules provided via
		 * absolute path is somewhat buggy. I haven't tracked down the exact cause, but sometimes
		 * external modules' paths are relative to CWD, sometimes relative to the common demoninator
		 * of files (check inputBase of rollup source). It seems that this is consistent internally,
		 * but not when user-provided absolute paths are involved. In particular the
		 * "external-modules-in-many-module-build" test case fails.
		 *
		 * One place where one replaces an absolute path to a relative path is
		 * `ExternalModule.setRenderPath` which sets `renderPath` which is later resolved relatively
		 * from certain path to compute final path in import statements. If outputOption.path
		 * function is provided, the value produced by this function is used as `renderPath`
		 * instead, so we are hooking into it so that `renderPath` is set to an absolute path.
		 */
		const orig = outputOptions.paths;
		outputOptions.paths = (id) => {
			if (id in globals) return id;
			if (typeof orig === 'function') return orig(id);
			/**
			 * Rollup's type declaration assumes that `paths` function always returns string, but
			 * determining from rollup source code, it should return falsy values to trigger its
			 * default `setRenderPath` behavior, hence we are returning '' here.
			 */
			return '';
		}
		return outputOptions;
	};
	const resolveId: rollup.ResolveIdHook = (source) => {
		let depsPath = spec.resolveRollupExternalDeps(source);
		if (depsPath) {
			return path.resolve(process.cwd(), depsPath);
			// Using 'posix' does not work well with rollup internals
		}
		if (source.startsWith(EMPTY_BUNDLE_ID)) {
			return source;
		}
	};
	const load: rollup.LoadHook = (id: string) => {
		if (id.startsWith(EMPTY_BUNDLE_ID)) {
			return Promise.resolve('');
		}
	};
	const generateBundle = handleError<NonNullable<rollup.Plugin["generateBundle"]>>(async function (
		this: rollup.PluginContext, options, bundle, isWrite
	) {
		// Quick path for single-module builds
		if (spec.getOrderedModuleSpecs().length === 1) return;

		// Get entry dependency from spec
		const entryDeps = spec.getRollupOutputNameDependencyMap();

		// Get chunk dependency from rollup.OutputBundle
		const chunkDeps: {[chunkName: string]: string[]} = {};
		for (let [fileName, chunkInfo] of Object.entries(bundle)) {
			// TODO This is a possible source of conflicts with other rollup plugins. Some plugins
			// may add unexpected chunks. In general, it is not clear what TSCC should do in such
			// cases. A safe way would be to strip out such chunks and deal only with chunks that
			// are expected to be emitted. We may trim such chunks here.
			if (!isChunk(chunkInfo)) continue;
			chunkDeps[fileName] = [];
			for (let imported of chunkInfo.imports) {
				chunkDeps[fileName].push(imported);
			}
		}

		// Compute chunk allocation
		const chunkAllocation = computeChunkAllocation(chunkDeps, entryDeps);

		/**
		 * Hack `bundle` object, as described in {@link https://github.com/rollup/rollup/issues/2938}
		 */
		await Promise.all([...entryDeps.keys()].map(async (entry: string) => {
			// 0. Merge bundles that ought to be merged with this entry point
			const mergedBundle = await mergeChunks(entry, chunkAllocation, bundle, globals);
			// 1. Delete keys for chunks that are included in this merged chunks
			for (let chunk of chunkAllocation.get(entry)) {
				delete bundle[chunk];
			}
			// 2. Add the merged bundle object
			bundle[entry] = mergedBundle;
		}));
	});

	return {name, generateBundle, options, outputOptions, resolveId, load};
};

function isChunk(output: rollup.OutputChunk | rollup.OutputAsset): output is rollup.OutputChunk {
	return output.type === 'chunk';
}

function handleError<H extends (this: rollup.PluginContext, ..._: any[]) => unknown>(hook: H): H {
	return <H>async function () {
		try {
			return await Reflect.apply(hook, this, arguments);
		} catch (e) {
			// Handle known type of errors
			if (e instanceof ChunkSortError || e instanceof ChunkMergeError) {
				this.error(e.message);
			} else {
				throw e;
			}
		}
	}
}

export default pluginImpl;

