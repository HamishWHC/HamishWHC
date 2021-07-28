import path from "path";
import fs from "fs";
import * as esbuild from "esbuild"
import { fileURLToPath } from 'url';

/** @type {(options: {out: string}) => import("@sveltejs/kit").Adapter} */
export const adapter = ({out}) => ({
    name: 'adapter-aws-lambda-handler',
    async adapt({utils, config}) {
        const files = fileURLToPath(new URL('./lambda', import.meta.url));
        utils.copy(files, '.svelte-kit/lambda');

        const esbuildOptions = {
            entryPoints: ['.svelte-kit/lambda/lambda.js'],
            outfile: path.join(out, 'lambda/index.js'),
            bundle: true,
            external: Object.keys(JSON.parse(fs.readFileSync('package.json', 'utf8')).dependencies || {}),
            format: 'cjs',
            platform: 'node',
            target: 'node14',
            inject: [path.join(files, 'shims.js')],
            define: {
                esbuild_app_dir: '"' + config.kit.appDir + '"'
            }
        }

        await esbuild.build(esbuildOptions)

        const staticPath = path.join(out, 'static')
        utils.copy_client_files(staticPath)
        utils.copy_static_files(staticPath)

        await utils.prerender({
            dest: staticPath
        });
    }
})