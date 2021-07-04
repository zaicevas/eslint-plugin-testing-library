import { TSESTree } from '@typescript-eslint/experimental-utils';

import { createTestingLibraryRule } from '../create-testing-library-rule';
import {
  getPropertyIdentifierNode,
  isArrowFunctionExpression,
  isCallExpression,
  isMemberExpression,
  isFunctionExpression,
  isExpressionStatement,
  isReturnStatement,
  isBlockStatement,
} from '../node-utils';

export const RULE_NAME = 'prefer-query-wait-disappearance';
export type MessageIds = 'preferQueryByDisappearance';

export default createTestingLibraryRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Suggest using `queryBy*` queries when waiting for disappearance',
      category: 'Possible Errors',
      recommendedConfig: {
        dom: false,
        angular: false,
        react: false,
        vue: false,
      },
    },
    messages: {
      preferQueryByDisappearance:
        'Prefer using queryBy* when waiting for disappearance',
    },
    schema: [],
  },
  defaultOptions: [],

  create(context, _, helpers) {
    function isWaitForElementToBeRemoved(node: TSESTree.CallExpression) {
      const identifierNode = getPropertyIdentifierNode(node);

      if (!identifierNode) {
        return false;
      }

      return helpers.isAsyncUtil(identifierNode, ['waitForElementToBeRemoved']);
    }

    function isReportableExpression(node: TSESTree.LeftHandSideExpression) {
      let argumentProperty;

      if (isMemberExpression(node)) {
        argumentProperty = getPropertyIdentifierNode(node.property);
      } else {
        argumentProperty = getPropertyIdentifierNode(node);
      }

      if (!argumentProperty) {
        return false;
      }

      return (
        helpers.isGetQueryVariant(argumentProperty) ||
        helpers.isFindQueryVariant(argumentProperty)
      );
    }

    function isNonCallbackViolation(node: TSESTree.CallExpressionArgument) {
      if (!isCallExpression(node)) {
        return false;
      }

      if (
        !isMemberExpression(node.callee) &&
        !getPropertyIdentifierNode(node.callee)
      ) {
        return false;
      }

      return isReportableExpression(node.callee);
    }

    function isReturnViolation(node: TSESTree.Statement) {
      if (!isReturnStatement(node) || !isCallExpression(node.argument)) {
        return false;
      }

      return isReportableExpression(node.argument.callee);
    }

    function isNonReturnViolation(node: TSESTree.Statement) {
      if (!isExpressionStatement(node) || !isCallExpression(node.expression)) {
        return false;
      }

      if (
        !isMemberExpression(node.expression.callee) &&
        !getPropertyIdentifierNode(node.expression.callee)
      ) {
        return false;
      }

      return isReportableExpression(node.expression.callee);
    }

    function isFunctionExpressionViolation(
      node: TSESTree.CallExpressionArgument
    ) {
      if (!isFunctionExpression(node)) {
        return false;
      }

      return node.body.body.some(
        (statement) =>
          isReturnViolation(statement) || isNonReturnViolation(statement)
      );
    }

    function isArrowFunctionBodyViolation(
      node: TSESTree.CallExpressionArgument
    ) {
      if (!isArrowFunctionExpression(node) || !isBlockStatement(node.body)) {
        return false;
      }

      return node.body.body.some(
        (statement) =>
          isReturnViolation(statement) || isNonReturnViolation(statement)
      );
    }

    function isArrowFunctionImplicitReturnViolation(
      node: TSESTree.CallExpressionArgument
    ) {
      if (!isArrowFunctionExpression(node) || !isCallExpression(node.body)) {
        return false;
      }

      if (
        !isMemberExpression(node.body.callee) &&
        !getPropertyIdentifierNode(node.body.callee)
      ) {
        return false;
      }

      return isReportableExpression(node.body.callee);
    }

    function isArrowFunctionViolation(node: TSESTree.CallExpressionArgument) {
      return (
        isArrowFunctionBodyViolation(node) ||
        isArrowFunctionImplicitReturnViolation(node)
      );
    }

    function check(node: TSESTree.CallExpression) {
      if (!isWaitForElementToBeRemoved(node)) {
        return;
      }

      const argumentNode = node.arguments[0];

      if (
        !isNonCallbackViolation(argumentNode) &&
        !isArrowFunctionViolation(argumentNode) &&
        !isFunctionExpressionViolation(argumentNode)
      ) {
        return;
      }

      context.report({
        node: argumentNode,
        messageId: 'preferQueryByDisappearance',
      });
    }

    return {
      CallExpression: check,
    };
  },
});
