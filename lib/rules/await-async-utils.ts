import { TSESTree } from '@typescript-eslint/experimental-utils';
import {
  findClosestCallExpressionNode,
  getFunctionName,
  getInnermostReturningFunction,
  getVariableReferences,
  isPromiseHandled,
} from '../node-utils';
import { createTestingLibraryRule } from '../create-testing-library-rule';

export const RULE_NAME = 'await-async-utils';
export type MessageIds = 'awaitAsyncUtil' | 'asyncUtilWrapper';
type Options = [];

export default createTestingLibraryRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce promises from async utils to be handled',
      category: 'Best Practices',
      recommended: 'warn',
    },
    messages: {
      awaitAsyncUtil: 'Promise returned from `{{ name }}` must be handled',
      asyncUtilWrapper:
        'Promise returned from {{ name }} wrapper over async util must be handled',
    },
    schema: [],
  },
  defaultOptions: [],

  create(context, _, helpers) {
    const functionWrappersNames: string[] = [];

    function detectAsyncUtilWrapper(node: TSESTree.Identifier) {
      const innerFunction = getInnermostReturningFunction(context, node);

      if (innerFunction) {
        functionWrappersNames.push(getFunctionName(innerFunction));
      }
    }

    return {
      'CallExpression Identifier'(node: TSESTree.Identifier) {
        if (helpers.isAsyncUtil(node)) {
          // detect async query used within wrapper function for later analysis
          detectAsyncUtilWrapper(node);

          const closestCallExpression = findClosestCallExpressionNode(
            node,
            true
          );

          if (!closestCallExpression || !closestCallExpression.parent) {
            return;
          }

          const references = getVariableReferences(
            context,
            closestCallExpression.parent
          );

          if (references && references.length === 0) {
            if (!isPromiseHandled(node)) {
              return context.report({
                node,
                messageId: 'awaitAsyncUtil',
                data: {
                  name: node.name,
                },
              });
            }
          } else {
            for (const reference of references) {
              const referenceNode = reference.identifier as TSESTree.Identifier;
              if (!isPromiseHandled(referenceNode)) {
                return context.report({
                  node,
                  messageId: 'awaitAsyncUtil',
                  data: {
                    name: node.name,
                  },
                });
              }
            }
          }
        } else if (functionWrappersNames.includes(node.name)) {
          // check async queries used within a wrapper previously detected
          if (!isPromiseHandled(node)) {
            return context.report({
              node,
              messageId: 'asyncUtilWrapper',
              data: { name: node.name },
            });
          }
        }
      },
    };
  },
});
