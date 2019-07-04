# TSCC

[![tscc npm version](https://img.shields.io/npm/v/@tscc/tscc.svg?style=popout&color=blue&label=%40tscc%2Ftscc)](https://www.npmjs.com/package/@tscc/tscc)
[![rollup-plugin-tscc npm version](https://img.shields.io/npm/v/@tscc/rollup-plugin-tscc.svg?style=popout&color=blue&label=%40tscc%2Frollup-plugin-tscc)](https://www.npmjs.com/package/@tscc/rollup-plugin-tscc)
[![CircleCI](https://circleci.com/gh/theseanl/tscc.svg?style=svg)](https://circleci.com/gh/theseanl/tscc)

A collection of tools to seamlessly bundle, minify Typescript with Closure Compiler.

## Migrate

It is easy to migrate an existing Typescript project to use with TSCC.
Check out [todomvc app](https://github.com/theseanl/todomvc/tree/master/typescript-react) using Typescript and React, forked from the original [tastejs/todomvc](https://github.com/tastejs/todomvc) and modified to use with TSCC to see how it can be done.

---

## Features

 - Automatically configures settings for [tsickle](https://github.com/angular/tsickle) and [closure compiler](https://github.com/google/closure-compiler), wires up tsickle output to closure compiler, sorted in accordence to dependency information which is required by closure compiler.
 - Provides an alternative [rollup](https://rollupjs.org) build using `rollup-plugin-tscc` plugin.
 - External module support - lookup `require`d nodejs modules, and wire them so that externs are generated, and transforms any code that uses externally imported variables so that it works like rollup.


## Background

Closure is a wonderful system of tools. The closure compiler is the best javascript minifier and bundler, but it is known to be very difficult to use. Documentations are scarce, and integration with external tools are not well-established.

Tsickle is another wonderful tool. It finally makes it ergonomic to write code that can naturally be consumed by closure compiler, in that it transforms `.ts` files to `.js` files which are well-annotated, which would otherwise not even be consumed by the compiler, and automatically generates "externs" file from declaration files. However, like closure compiler, one has to careful in setting it up, otherwise strange bugs can occur which are not actively worked on as of now. Also, it only performs transpilation, there is no tool to put transpiled files to closure compiler, which is another painful part.

TSCC aims to encapsulate these tools in an minimal, ergonomic API, and provide a faster, easier alternative bundling [Rollup](https://rollupjs.org), which is great for rapid development. It can be used as a drop-in replacement for rollup in existing project using rollup, after moving chunk information in `rollup.config.js` to `tscc.spec.json`. TSCC spec file is a single source of truth for all of your module bundling information.
 
## Installation 

`yarn add -D @tscc/tscc`, or to use as a command-line tool, `yarn global add @tscc/tscc` 

## Usage
 
### Command line

`tscc [--help] [--clean] [--spec <spec_file_path>] [--project <typescript_project_root>]`

### JS API

```js
import tscc from 'tscc';

tscc({ 
    /* Contents of spec JSON */
}, tsConfigRoot?)

// or,

tscc("path_or_dirname_of_spec_file");

// or, 

tscc({
    /* Contents of spec JSON */
    specFile: "path_to_spec_file"
})

// To load spec file from the path and override it.
```

### Usage with rollup

Install `rollup-plugin-tscc` by executing `yarn add -D @tscc/rollup-plugin-tscc`.
```js
// rollup.config.js
const tscc = require('@tscc/rollup-plugin-tscc');
module.exports = {
    output: {
        dir: '.' // output.dir option will be provided by the plugin, but
                 // rollup currently requires something to be present in order to
                 // work properly.
    },
    // ...
    plugins: [
        tscc({
            /* Contents of spec JSON */
            // or,
            specFile: "path_to_spec_file"
        })
    ]
};
```
The plugin will control the `input` option and `output.dir`, `output.entryFileNames` option.
It does not transpile TS to JS, one has to provide another plugin manually, such as [rollup-plugin-typescript2](https://github.com/ezolenko/rollup-plugin-typescript2).
Then you can use the normal `rollup` command.

### Tscc spec files

```js
{
    modules, /* required */
    external,
    prefix,
    compilerFlags,
    debug
}
```

#### `modules`

```jsonc
    "modules": {
        "index: "index.ts",
        "dependent_a": {
            "entry": "dependent_a_entry_file.ts",
            "dependencies": [ "index" ],
            "extraSources": [ "css_renaming_map.js" ]
        }
    }
```
`modules` option is a key-value pair of module name and module's specification. If a specification only consists of a entry file name, it can simply be a string representing the entry file's path, which is sufficient for most of build situation where no code splitting is applied. In general, module's specification consists of `entry`, `dependencies`, and `extraSources`. `dependencies` is an array of module names that this module depends on. It can be omitted if empty. `extraSources` is an array of file names, which are not included in the Typescript project but still needed to be provided to the closure compiler, such as css renaming maps generated by [Closure Stylesheets](https://github.com/google/closure-stylesheets). It can be omitted if empty. A module's name is an identifier to be used as a output chunk's name. To control the output directory, use `prefix` option.

#### `external`
```jsonㅊ
{
    "external": {
        "react": "React",
        "react-dom": "ReactDOM",
    }
}
```

It is identical to the [`output.global` option](https://rollupjs.org/guide/en#core-functionality) of rollup. It is a key-value pair, where key is a module name as used in `import ... from 'module_name'` statement, and value is a name of a global variable which this imported value will refer to.

#### `prefix`

```jsonc
    "prefix": "dist/"
    // or,
    "prefix": { "rollup": "dev/", "cc": "dist/" }
```
It is a name that will be prepended to the output chunk's name. It is prepended _as is_, which means that if no trailing path separator was provided, it will modify the output file's name. If it is a relative path starting from the current directory ("."), it will be resolved relative to the spec file's location. Otherwise, any relative path will be resolved relative to the current working directory, and absolute paths are used as is. 

#### `compilerFlags`

```jsonc
    "compilerFlags": {
        "assume_function_wrapper": true,
        "rewrite_polyfills": true,
        "language_out": "ECMASCRIPT_2015",
        "variable_renaming_report": "out/report.map"
    }
```
It is a key-value pair of flags to be passed to the closure compiler. Keys are literally [closure compiler options](https://github.com/google/closure-compiler/wiki/Flags-and-Options) minus the leading `--`. flags which accepts multiple values can be represented as an array of values. TSCC sets default values for many flags, in particular, the compilation works even without the `compilerOptions` key in the spec. Any values provided here will override default flags. TSCC will treat these values as opaque data. 

#### `debug`

This is a boolean value. When it is enabled, it will write intermediate Tsickle output to a temporary directory (`.tscc_temp`), and print arguments used to call closure compiler.

### Importing external libraries from NPM

Best practice is to provide them as a separate script tag instead of bundling it together, as such libraries do not in general safe to be compiled by Closure Compiler. Declare them as external modules in the spec file, and import them like you would usually do. Then you can benefit from IDE's type checking functionality while tscc can lookup their type definitions and include them as closure compiler's externs.

### Things to know

Although TSCC tries to hide CC specifics as much as it can, some knowledge over it is required:
 - Read the [official documentation](https://developers.google.com/closure/compiler/) in order to get used to some notions used.
 - Not all code works directly with closure compiler (even if it is well-annotated). Read about [compiler assumptions](https://github.com/google/closure-compiler/wiki/Compiler-Assumptions) from their wiki; Basically, you should not use some dynamic nature of JS (the bad part!). Below are some common situations.
   - Do not access an object's property with a string literal, as closure compiler won't try to rename it. If you access `foo.bar` in your code and also do `foo["bar"]` at another part of the code, closure compiler may rename `foo.bar` to something like `foo.a` whereas the latter to `foo.bar`, so it will break the code.
   - Circular references of Javascript modules are not allowed.
   - Output module spec must have a single root module, making it a connected tree.[Ref](https://stackoverflow.com/questions/10395810/how-do-i-split-my-javascript-into-modules-using-googles-closure-compiler/10401030#10401030)
 - Tsickle [officially states](https://github.com/angular/tsickle#warning-work-in-progress) that it is still in experimental phase, and there are some caveats.
   - Tsickle does not support annotation of all typescript types. In most of cases, closure compiler is still able to guess unknown types so it does not break the output code, 
   - It does not support indexed properties, in particular, any `declare`d properties together with indexed properties won't be preserved by the compiler.
     ```
     declare interface Mixed {
         will_not_be_preserved:boolean
         [key:string]:boolean
     }
     ```
   - TS `namespace`s are not converted to something like those in closure library, so it does not benefit from closure compiler's property flattening. (Apparently google internally prevents use of [namespaces](https://github.com/angular/tsickle/issues/713#issuecomment-358806943).)
 - Some objects are present in Typescript but not in closure compiler, so sometimes you may need to provide externs to those manually.
 
## Motivation

This project came out from an experience I have had with developing several Javascript software, both as a frontend project and browser extension, userscripts injected into client's browsers. In many cases "content script" are `eval`ed, so the source holds a string form of a JS code, so there was a rather strong motivation for squizing bundle size as much as one can in order to reduce client's memory footprint. Closure tools, albeit not "trendy", was the best tool for it -- the compiler is simply the best, Closure Templates directly compiles into JS and required runtime libraries are extremely small, and Closure Stylesheets provides class name shortening. However, incorporating all of these and at the same time providing an alternative build for debugging required a lot of work due to lack of support and community tooling.

On the other hand, there is a work (ABC, Angular BuildTools Convergence, or Angular Bazel Closure-compiler) going on from the side of Angular to incorporate Closure compiler into its build tooling, which is actually tsickle's main application. However, one has to use bazel which are uncommon to JS development, and angular is much like an another language than Typescript, it can't be used for community outside Angular. 
 
TSCC is meant to provide a framework-agnostic tooling that can be used to bridge this gap.

## Milestones

 - Add unit tests.
 - Provide an ergonomic API for using JS files which are already closure-annotated together with transpiled TS files. This will enable usage with Closure Library.
 - Provide `tscc-templates` and `tscc-css` modules that use Closure Templates and Closure Stylesheets, so that they can imported to TS sources like webpack.
 - Sourcemap support
