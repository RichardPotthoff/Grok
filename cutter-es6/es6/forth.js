export class JSForthBridge {
  constructor() {
    this.stack = [];
    this.dictionary = {};
    this.uiRegistry = {};
  }

  // Register a tool instance by reading its metadata
  registerTool(name, funcReference) {
    const metadata = funcReference.forthMetadata;
    if (!metadata) {
      throw new Error(`Function ${name} is missing @ForthTool metadata!`);
    }

    this.dictionary[name] = funcReference;
    this.uiRegistry[name] = metadata; // Expose this to your UI Form Generator
  }

  run(forthString) {
    // Regex splits tokens by space, preserving quoted strings
    const tokens = forthString.trim().match(/(?:"[^"]*"|\S+)/g) || [];

    for (const token of tokens) {
      if (this.dictionary[token]) {
        const action = this.dictionary[token];
        const metadata = this.uiRegistry[token];

        // Pop items off the stack for Forth (Last-In, First-Out, so we reverse)
        const args = [];
        for (let i = 0; i < metadata.argCount; i++) {
          args.push(this.stack.pop());
        }
        args.reverse();

        // Execute the native JavaScript function using the stack values
        action(...args);
      } else {
        // Push data onto the stack
        if (token.startsWith('"') && token.endsWith('"')) {
          this.stack.push(token.slice(1, -1)); // Strip quotes
        } else {
          const num = Number(token);
          this.stack.push(isNaN(num) ? token : num);
        }
      }
    }
  }
}
