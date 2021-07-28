import {createRequire} from 'module';
export {fetch, Response, Request, Headers} from '@sveltejs/kit/install-fetch';

// Object.defineProperty(globalThis, 'require', {
//     enumerable: true,
//     value: createRequire(import.meta.url)
// });