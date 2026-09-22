export function transpileTypeScriptToForthTool(tsCodeString) {
  // Regex to match a standard TypeScript function structure:
  // function name(param: type, param2: type) { ... }
  const funcRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*:\s*\w*\s*\{([\s\S]*)\}/;
  const match = tsCodeString.match(funcRegex);

  if (!match) {
    throw new Error("Could not parse function. Ensure standard syntax: function name(a: type, b: type) { ... }");
  }

  const funcName = match[1];
  const rawParams = match[2];
  const funcBody = match[3];

  const cleanParams = [];
  const types = [];
  const hints = [];

  // Parse parameters, splitting them by commas
  if (rawParams.trim().length > 0) {
    const paramsArray = rawParams.split(',');
    for (let p of paramsArray) {
      // Split 'radius: number' into ['radius', 'number']
      const [pName, pType] = p.split(':').map(s => s.trim());
      
      cleanParams.push(pName);
      types.push(pType || 'any'); // Fallback if no type listed
      hints.push(pName.replace(/([A-Z])/g, ' \$1').replace(/^./, str => str.toUpperCase())); // E.g., 'fillColor' -> 'Fill Color'
    }
  }

  // Re-assemble into clean, executable browser JavaScript code
  const cleanJsCode = `
    function ${funcName}(${cleanParams.join(', ')}) {
      ${funcBody}
    }
    // Return the function with metadata attached
    ${funcName}.forthMetadata = {
      types: ${JSON.stringify(types)},
      hints: ${JSON.stringify(hints)},
      argCount: ${types.length}
    };
    return ${funcName};
  `;

  // Dynamically evaluate and construct the live JavaScript function object
  return {
    name: funcName,
    executableFunction: new Function(cleanJsCode)()
  };
}
