/** Evaluate only the finite, side-effect-free expression forms used by authored descriptions. */
export function evaluateRule(node, values, functions) {
  switch (node?.type) {
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
      return node.value;
    case "NullLiteral":
      return null;
    case "Identifier":
      if (Object.hasOwn(values, node.value)) return values[node.value];
      if (Object.hasOwn(functions, node.value)) return functions[node.value];
      throw new Error(`Unknown description variable: ${node.value}`);
    case "MemberExpression": {
      const object = evaluateRule(node.object, values, functions);
      if (node.property?.type !== "Identifier" || !object || typeof object !== "object") break;
      return object[node.property.value];
    }
    case "ObjectExpression":
      return Object.fromEntries(
        node.properties.map((property) => {
          if (property.type === "Identifier")
            return [property.value, evaluateRule(property, values, functions)];
          if (property.type === "KeyValueProperty" && property.key?.type === "Identifier")
            return [property.key.value, evaluateRule(property.value, values, functions)];
          throw new Error("Unsupported description object property");
        }),
      );
    case "TemplateLiteral":
      return node.quasis
        .map(
          (part, index) =>
            (part.cooked ?? part.raw) +
            (index < node.expressions.length
              ? String(evaluateRule(node.expressions[index], values, functions))
              : ""),
        )
        .join("");
    case "ParenthesisExpression":
      return evaluateRule(node.expression, values, functions);
    case "ConditionalExpression":
      return evaluateRule(node.test, values, functions)
        ? evaluateRule(node.consequent, values, functions)
        : evaluateRule(node.alternate, values, functions);
    case "BinaryExpression": {
      const left = evaluateRule(node.left, values, functions);
      if (node.operator === "&&") return left && evaluateRule(node.right, values, functions);
      if (node.operator === "||") return left || evaluateRule(node.right, values, functions);
      const right = evaluateRule(node.right, values, functions);
      if (node.operator === "===") return left === right;
      if (node.operator === "+") return left + right;
      if (node.operator === "*") return left * right;
      break;
    }
    case "CallExpression": {
      const name = node.callee?.value;
      const args = node.arguments.map((arg) => evaluateRule(arg.expression, values, functions));
      if (node.callee?.type === "Identifier" && Object.hasOwn(functions, name))
        return functions[name](...args);
      if (
        node.callee?.type === "MemberExpression" &&
        node.callee.property?.value === "describe" &&
        Object.hasOwn(functions, "describe")
      )
        return functions.describe(evaluateRule(node.callee.object, values, functions), ...args);
      break;
    }
  }
  throw new Error(`Unsupported description expression: ${node?.type ?? "missing"}`);
}

/** Bind explicitly supplied data to a description function; never execute source. */
export function describeRule(fn, args, functions) {
  const values = {};
  for (const [index, parameter] of fn.params.entries()) {
    const pattern = parameter.type === "Parameter" ? parameter.pat : parameter;
    if (pattern.type === "Identifier") values[pattern.value] = args[index];
    else if (pattern.type === "AssignmentPattern" && pattern.left?.type === "Identifier")
      values[pattern.left.value] =
        args[index] === undefined ? evaluateRule(pattern.right, values, functions) : args[index];
    else if (pattern.type === "ObjectPattern") {
      for (const property of pattern.properties) {
        if (property.type !== "AssignmentPatternProperty" || property.value)
          throw new Error("Unsupported description parameter");
        values[property.key.value] = args[index][property.key.value];
      }
    } else throw new Error("Unsupported description parameter");
  }
  const execute = (statements) => {
    for (const statement of statements) {
      if (statement.type === "ReturnStatement")
        return { returned: true, value: evaluateRule(statement.argument, values, functions) };
      if (statement.type === "IfStatement") {
        const branch = evaluateRule(statement.test, values, functions)
          ? statement.consequent
          : statement.alternate;
        if (branch) {
          const result = execute(branch.type === "BlockStatement" ? branch.stmts : [branch]);
          if (result) return result;
        }
      } else if (statement.type === "ForOfStatement") {
        const declaration = statement.left?.declarations?.[0];
        const items = evaluateRule(statement.right, values, functions);
        if (
          statement.left?.type !== "VariableDeclaration" ||
          statement.left.declarations.length !== 1 ||
          declaration?.id?.type !== "Identifier" ||
          !Array.isArray(items)
        )
          throw new Error("Unsupported description loop");
        for (const item of items) {
          values[declaration.id.value] = item;
          const result = execute(
            statement.body.type === "BlockStatement" ? statement.body.stmts : [statement.body],
          );
          if (result) return result;
        }
      } else if (statement.type === "VariableDeclaration") {
        for (const declaration of statement.declarations) {
          if (declaration.id?.type !== "Identifier") throw new Error("Unsupported description declaration");
          values[declaration.id.value] = declaration.init
            ? evaluateRule(declaration.init, values, functions)
            : undefined;
        }
      } else if (
        statement.type === "ExpressionStatement" &&
        statement.expression?.type === "AssignmentExpression"
      ) {
        const assignment = statement.expression,
          name = assignment.left?.value;
        if (!Object.hasOwn(values, name) || !["=", "+=", "??="].includes(assignment.operator))
          throw new Error("Unsupported description assignment");
        if (assignment.operator !== "??=" || values[name] == null) {
          const next = evaluateRule(assignment.right, values, functions);
          values[name] = assignment.operator === "+=" ? values[name] + next : next;
        }
      } else throw new Error(`Unsupported description statement: ${statement.type}`);
    }
    return null;
  };
  if (fn.body?.type === "BlockStatement" || fn.body?.type === "FunctionBody") {
    const result = execute(fn.body.stmts);
    if (!result?.returned) throw new Error("Description has no return");
    return result.value;
  }
  return evaluateRule(fn.body, values, functions);
}
