.PHONY: fetch_tslib clean fetch_closure_lib

all: $(shell find dist) fetch_tslib

dist/%.js: src/%.ts
	tsc;

WGET=wget --no-check-certificate --content-disposition
GH_USER_CONTENT=https://raw.githubusercontent.com/
THIRD_PARTY=third_party/

fetch_tslib:
	svn export https://github.com/angular/tsickle/trunk/${THIRD_PARTY}tslib ${THIRD_PARTY}tsickle/third_party/tslib --force



fetch_closure_lib:
	${WGET} ${GH_USER_CONTENT}google/closure-library/master/closure/goog/base.js \
		-O ${THIRD_PARTY}closure_library/base.js
	${WGET} ${GH_USER_CONTENT}google/closure-library/master/closure/goog/reflect/reflect.js \
		-O ${THIRD_PARTY}closure_library/reflect.js

local_install: $(shell find dist) 
	npm i -g .

clean:
	sudo rm -rf dist

