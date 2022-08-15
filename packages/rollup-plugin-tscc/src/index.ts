import * as rollup from 'rollup';
import {IInputTsccSpecJSON} from '@tscc/tscc-spec';
import TsccSpecRollupFacade from './spec/TsccSpecRollupFacade';
import ITsccSpecRollupFacade from './spec/ITsccSpecRollupFacade';
import computeChunkAllocation, {ChunkSortError} from './sort_chunks';
import mergeChunks, {ChunkMergeError} from './merge_chunks';
import path = require('path');
import {googShimMixin} from './goog_shim_mixin';

const pluginImpl: (options: IInputTsccSpecJSON) => rollup.Plugin = (pluginOptions) => {
	const spec: ITsccSpecRollupFacade = TsccSpecRollupFacade.loadSpec(pluginOptions);

	const isManyModuleBuild = spec.getOrderedModuleSpecs().length > 1;
	const globals = spec.getRollupExternalModuleNamesToGlobalMap();

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
		return outputOptions;
	};
	const resolveId: rollup.ResolveIdHook = (id, importer) => {

		/**
		 * Getting absolute paths for external modules working has been pretty tricky. I haven't
		 * tracked down the exact cause, but sometimes external modules' paths are relative to CWD,
		 * sometimes relative to the common demoninator of files (check inputBase of rollup source).
		 * It seems that this is consistent internally, but not when user-provided absolute paths
		 * are involved. In particular the "external-modules-in-many-module-build" test case fails.
		 *
		 * Prior to rollup 2.44.0, we have used "paths" output option to force rollup to keep use
		 * absolute paths for external modules internally. "paths" option is mainly intended to
		 * replace external module paths to 3rd-party CDN urls in the bundle output, so our use is
		 * more like an 'exploit'. One place where one replaces an absolute path to a relative path
		 * is `ExternalModule.setRenderPath` which sets `renderPath` which is later resolved
		 * relatively from certain path to compute final path in import statements. If
		 * outputOption.path function is provided, the value produced by this function is used as
		 * `renderPath` instead, so we are hooking into it so that `renderPath` is set to an
		 * absolute path.
		 *
		 * Since 2.44.0, it has supported returning {external: 'absolute'} value from `resolveId`
		 * hook, which seems to be achieving what we have done using `output.paths` option. In
		 * particular it disables rollup's 'helpful' renormalization of paths, see
		 * https://github.com/rollup/rollup/blob/a8647dac0fe46c86183be8596ef7de25bc5b4e4b/src/ExternalModule.ts#L94,
		 * https://github.com/rollup/rollup/blob/983c0cac83727a13af834fe79dfeef89da4fb84b/src/Chunk.ts#L699.
		 * The related PR is https://github.com/rollup/rollup/pull/4021.
		 *
		 * These paths are then used in intermediate chunks, and will not be emitted in final bundle
		 * due to the helpful renormalization which we do not disable in the secondary bundling.
		 */
		if (importer) {
			const resolved = path.resolve(path.dirname(importer), id);
			if (resolved in globals) {
				return {id: resolved, external: "absolute"};
			}
		}
		let depsPath = spec.resolveRollupExternalDeps(id);
		if (depsPath) {
			return path.resolve(process.cwd(), depsPath);
			// Using 'posix' does not work well with rollup internals
		}
	};
	// Returning null defers to other load functions, see https://rollupjs.org/guide/en/#load
	const load: rollup.LoadHook = (id: string) => null;

	const generateBundle = handleError<NonNullable<rollup.FunctionPluginHooks["generateBundle"]>>(async function (
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

	return googShimMixin({name, generateBundle, options, outputOptions, resolveId, load});
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

