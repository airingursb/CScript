module.exports = {
    extends: [],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        sourceType: 'module',
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json']
    },
    plugins: ['@typescript-eslint', 'prettier', 'simple-import-sort'],
    rules: {
        complexity: [
            'error',
            {
                max: 20
            },
        ],
        'simple-import-sort/imports': 'warn',
        'simple-import-sort/exports': 'warn',
    },
}