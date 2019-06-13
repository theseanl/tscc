.PHONY: fetch_tslib clean fetch_closure_lib

all: $(shell find dist) src/closure_library_deps.json fetch_tslib

dist/%.js: src/%.ts
	tsc;

src/closure_library_deps.json: ../../node_modules/google-closure-library/package.json dist/DepsSorter.js
	node ./script/generate_closure_deps.js

fetch_tslib:
	svn export https://github.com/angular/tsickle/trunk/third_party/tslib third_party/tsickle/third_party/tslib --force

fetch_closure_lib:
	wget --no-check-certificate --content-disposition \
		https://raw.githubusercontent.com/google/closure-library/master/closure/goog/base.js \
		-O third_party/closure_library/base.js
	wget --no-check-certificate --content-disposition \
		https://raw.githubusercontent.com/google/closure-library/master/closure/goog/reflect/reflect.js \
		-O third_party/closure_library/reflect.js

local_install: $(shell find dist) 
	yarn global add file:${CURDIR}

clean:
	sudo rm -rf dist

