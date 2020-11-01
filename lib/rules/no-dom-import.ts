import {
  AST_NODE_TYPES,
  TSESTree,
} from '@typescript-eslint/experimental-utils';
import { isIdentifier, isLiteral } from '../node-utils';
import { createTestingLibraryRule } from '../create-testing-library-rule';

export const RULE_NAME = 'no-dom-import';
export type MessageIds = 'noDomImport' | 'noDomImportFramework';
type Options = [string];

const DOM_TESTING_LIBRARY_MODULES = [
  'dom-testing-library',
  '@testing-library/dom',
];

export default createTestingLibraryRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow importing from DOM Testing Library',
      category: 'Best Practices',
      recommended: false,
    },
    messages: {
      noDomImport:
        'import from DOM Testing Library is restricted, import from corresponding Testing Library framework instead',
      noDomImportFramework:
        'import from DOM Testing Library is restricted, import from {{module}} instead',
    },
    fixable: 'code',
    schema: [
      {
        type: 'string',
      },
    ],
  },
  defaultOptions: [''],

  create(context, [framework], helpers) {
    function report(
      node: TSESTree.ImportDeclaration | TSESTree.Identifier,
      moduleName: string
    ) {
      if (framework) {
        const isRequire = isIdentifier(node) && node.name === 'require';
        const correctModuleName = moduleName.replace('dom', framework);
        context.report({
          node,
          messageId: 'noDomImportFramework',
          data: {
            module: correctModuleName,
          },
          fix(fixer) {
            if (isRequire) {
              const callExpression = node.parent as TSESTree.CallExpression;
              const name = callExpression.arguments[0] as TSESTree.Literal;

              // Replace the module name with the raw module name as we can't predict which punctuation the user is going to use
              return fixer.replaceText(
                name,
                name.raw.replace(moduleName, correctModuleName)
              );
            } else {
              const importDeclaration = node as TSESTree.ImportDeclaration;
              const name = importDeclaration.source;
              return fixer.replaceText(
                name,
                name.raw.replace(moduleName, correctModuleName)
              );
            }
          },
        });
      } else {
        context.report({
          node,
          messageId: 'noDomImport',
        });
      }
    }

    return {
      'Program:exit'() {
        const importNode = helpers.getTestingLibraryImportNode();

        if (!importNode) {
          return;
        }

        // import node of shape: import { foo } from 'bar'
        if (importNode.type === AST_NODE_TYPES.ImportDeclaration) {
          const domModuleName = DOM_TESTING_LIBRARY_MODULES.find(
            (module) => module === importNode.source.value
          );

          domModuleName && report(importNode, domModuleName);
        }

        // import node of shape: const { foo } = require('bar')
        if (importNode.type === AST_NODE_TYPES.CallExpression) {
          const literalNodeDomModuleName = importNode.arguments.find(
            (arg) =>
              isLiteral(arg) &&
              typeof arg.value === 'string' &&
              DOM_TESTING_LIBRARY_MODULES.includes(arg.value)
          ) as TSESTree.Literal;

          literalNodeDomModuleName &&
            report(
              importNode.callee as TSESTree.Identifier,
              literalNodeDomModuleName.value as string
            );
        }
      },
    };
  },
});
