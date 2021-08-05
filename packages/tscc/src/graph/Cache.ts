import fs = require('fs');

const fsp = fs.promises;

export class Cache<T> {
	private cache: {
		[key: string]: {
			content: T,
			mtime: number
		}
	}
	private dirty = false;
	constructor(
		private cacheFilePath: string
	) {
		try {
			this.cache = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
		} catch (e) {
			fs.writeFileSync(cacheFilePath, '{}');
			this.cache = {};
		}
	}
	get(key: string): T {
		return this.cache[key] && this.cache[key].content;
	}
	getMtime(key: string): number {
		return this.cache[key] && this.cache[key].mtime;
	}
	put(key: string, content: T, mtime: number) {
		this.dirty = true;
		this.cache[key] = {content, mtime};
	}
	remove(key: string) {
		delete this.cache[key];
	}
	async commit() {
		if (!this.dirty) return;
		await fsp.writeFile(this.cacheFilePath, JSON.stringify(this.cache));
	}
}

export class FSCacheAccessor<T> {
	constructor(
		private cache: Cache<T>,
		private dataFactory: (path: string) => Promise<T>
	) {}
	async getFileData(path: string) {
		let stat: fs.Stats;
		try {
			stat = await fsp.stat(path);
		} catch (e) {
			this.cache.remove(path);
			throw new FSCacheAccessError(`${path}: ${e.code}`);
		}
		if (!stat.isFile()) {
			this.cache.remove(path);
			throw new FSCacheAccessError(`${path}: not a file`);
		}
		let cacheMtime = this.cache.getMtime(path);
		if (!cacheMtime || stat.mtimeMs > cacheMtime) {
			let content = await this.dataFactory(path);
			this.cache.put(path, content, stat.mtimeMs);
			return content;
		}
		return this.cache.get(path);
	}
	async updateCache() {
		await this.cache.commit();
	}
}

export class FSCacheAccessError extends Error {}

