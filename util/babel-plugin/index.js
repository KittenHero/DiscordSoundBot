module.exports = (babel, options) => {
  const { types: t, template } = babel;
  options = options || {};
  const scopes = [];
  const isAmbiguousRequire = (path) => {
    const node = path.node;
    const arg = node.arguments[0];
    return (
      t.isIdentifier(node.callee, { name: "require" }) &&
      node.arguments.length === 1 &&
      !t.isStringLiteral(arg)
    );
  };
  const asyncBlock = template(`{(async () => BODY)();}`);
  const dummyReturn = template(`const ID = {};`);
  const asyncImport = template(
    `async () => await import(ARG).then(m => m.default)`
  );
  const returnDummy = template(`return ID;`);
  const assignDummy = template(`Object.assign(ID, EXP);`);
  const enter = (path) => {
    scopes.push({ path, requires: [], returns: [] });
  };
  const exit = () => {
    const { path: block, requires, returns } = scopes.pop();

    if (!requires.length) return;
    requires.forEach((p) =>
      p.replaceWith(asyncImport({ ARG: p.node.arguments[0] }).expression.body)
    );

    const blockContext = block.getFunctionParent();
    if (blockContext && blockContext.node.async) return;
    block.replaceWith(asyncBlock({ BODY: block.node }));

    if (returns.length) {
      const returnID = block.scope.generateUidIdentifier("returnValue");
      returns.forEach((p) =>
        p
          .get("argument")
          .replaceWith(assignDummy({ ID: returnID, EXP: p.node.argument }))
      );
      block.unshiftContainer("body", dummyReturn({ ID: returnID }));
      block.pushContainer("body", returnDummy({ ID: returnID }));
    }
  };

  const addToScopeIf = ({ prop, cond }) => (path) => {
    const scope = scopes.pop();
    scopes.push(scope);
    const { [prop]: paths } = scope;
    if (cond(paths, path)) {
      paths.push(path);
    }
  };

  return {
    visitor: {
      Program: { enter, exit },
      BlockStatement: { enter, exit },
      ReturnStatement: addToScopeIf({
        prop: "returns",
        cond: (paths, path) => !paths.includes(path),
      }),
      CallExpression: addToScopeIf({
        prop: "requires",
        cond: (paths, path) =>
          !paths.includes(path) && isAmbiguousRequire(path),
      }),
    },
  };
};
