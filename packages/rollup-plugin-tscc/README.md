# rollup-plugin-tscc

This is a companion plugin for tscc which lets you perform an isomorphic build with rollup.
The code splitting strategy of Closure Compiler is rather different from any other bundling tools – it relies on providing an exact set of expected chunks and their interdependencies, whereas most of the available bundlers may create dynamic unnamed chunks. In some cases, the rigid approach of Closure Compiler is more suitable.

This plugin operates solely on the bundling level, and in particular, it does not require Typescript at all, so it can be used in any Javascript projects.

## Usage

Feed the output module dependency to `rollup-plugin-tscc` via [tscc spec file](https://github.com/theseanl/tscc#modules),
[input files](https://rollupjs.org/guide/en/#input), [external](https://rollupjs.org/guide/en/#external), and output file names will be taken care by the plugin.

```js
// rollup.config.js
export default {
    plugins: [
        output: {
            dir: '.'
        }
        require('@tscc/rollup-plugin-tscc')({
            /* Contents of spec JSON */
            modules: {
                "root-module": "./src/root-entry-file.js",
                "deferred-chunk-1": {
                    "entry": "./src/unimportant-feature-entry-file.js",
                    "dependencies": [
                        "root-module"
                    ]
                }
            }
            // or, you can provide the above contents via a separate file.
            specFile: "path_to_spec_file.json"
        })
    ]
}
```

Then invoking rollup with the above will produce precisely two files, `root-module.js` and `deferred-chunk-1.js`.

### Chunk format

By specifying `"chunkFormat": "global"` or `"chunkFormat": "module"`, you can designate how the code-splitted output chunks will reference variables and functions in another chunk. `"global"` corresponds to rollup's `"iife"`, and `"module"` corresponds to rollup's `"es"`.

### External modules

Especially in code-splitting builds, it is required to use the spec file's [`external`](https://github.com/theseanl/tscc#external) field instead of the rollup input option's external property, because this information has to be propagated down to the plugin.

### Dynamic imports

It does not support dynamic imports. It is mostly because Closure Compiler doesn't, and this package's goal is to
provide isomorphic build with closure compiler. Closure Compiler's wiki says it supports pass-through handling of `import()`, but it appears to be broken: https://github.com/google/closure-compiler/issues/3941 – apparently this ECMAScript feature is not widely used within Google. Closure Compiler's focus on _sequential_ nature of JS, which makes it extremely robust, doesn't seem to be a good fit with dynamic imports.

---

For more detailed description, we refer to the [README of the main package](https://github.com/theseanl/tscc).
