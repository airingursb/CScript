const path = require('path');
import typescript from '@rollup/plugin-typescript'
import { terser } from "rollup-plugin-terser";
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';

const resolveFile = function (filePath) {
    return path.join(__dirname, '..', filePath);
};

module.exports = [
    {
        input: resolveFile('src/index.ts'),
        plugins: [
            commonjs(),
            typescript({ tsconfig: './tsconfig.json' }),
            babel({
                exclude: 'node_modules/**',
                extensions: ['.js', '.jsx', '.ts', '.tsx'],
                babelHelpers: 'runtime',
                plugins: [
                    '@babel/plugin-transform-runtime'
                ],
                presets: ['@babel/env']
            }),
            terser(),
        ],
        output: [
            {
                file: resolveFile('dist/index.js'),
                format: 'umd',
                name: 'cscript@1',
                sourcemap: true,
            },
        ],
    },
    // {
    //     input: resolveFile('src/index.ts'),
    //     output: [
    //         {
    //             format: 'es',
    //             sourcemap: true,
    //             dir: 'es',
    //             preserveModules: true, // indicate not create a single-file
    //             preserveModulesRoot: 'src', // optional but useful to create a more plain folder structure
    //         },
    //     ],
    //     plugins: [typescript({ tsconfig: './tsconfig.json' }), buble()],
    // },
];
