/**
 * Cursor IDE Themes with full color definitions and syntax highlighting
 *
 * These themes are extracted from the official Cursor IDE and include
 * both UI colors and tokenColors for syntax highlighting.
 */

import type { VSCodeFullTheme } from "../atoms"

/**
 * Cursor Dark theme colors and syntax highlighting
 * Official Cursor IDE dark theme (Anysphere)
 */
export const CURSOR_DARK: VSCodeFullTheme = {
  id: "cursor-dark",
  name: "Cursor Dark",
  type: "dark",
  source: "builtin",
  colors: {
    "editor.background": "#181818",
    "editor.foreground": "#E4E4E4EB",
    foreground: "#E4E4E4EB",
    "sideBar.background": "#141414",
    "sideBar.foreground": "#E4E4E48D",
    "sideBar.border": "#E4E4E413",
    "activityBar.background": "#141414",
    "activityBar.foreground": "#E4E4E48D",
    "activityBarBadge.background": "#88C0D0",
    "activityBarBadge.foreground": "#141414",
    "panel.background": "#141414",
    "panel.border": "#E4E4E413",
    "tab.activeBackground": "#181818",
    "tab.inactiveBackground": "#242424",
    "tab.inactiveForeground": "#E4E4E442",
    "tab.activeForeground": "#E4E4E4EB",
    "tab.border": "#E4E4E413",
    "editorGroupHeader.tabsBackground": "#141414",
    "dropdown.background": "#181818",
    "dropdown.foreground": "#E4E4E4EB",
    "dropdown.border": "#E4E4E413",
    "input.background": "#E4E4E40A",
    "input.border": "#E4E4E413",
    "input.foreground": "#E4E4E4EB",
    "input.placeholderForeground": "#E4E4E45E",
    focusBorder: "#E4E4E426",
    "textLink.foreground": "#81A1C1",
    "textLink.activeForeground": "#87A6C4",
    "list.activeSelectionBackground": "#E4E4E41E",
    "list.activeSelectionForeground": "#E4E4E4EB",
    "list.hoverBackground": "#E4E4E411",
    "list.hoverForeground": "#E4E4E4EB",
    "list.focusBackground": "#E4E4E41E",
    "list.focusForeground": "#E4E4E4EB",
    "list.inactiveSelectionBackground": "#E4E4E411",
    "list.inactiveSelectionForeground": "#E4E4E4EB",
    "list.highlightForeground": "#88C0D0",
    "list.errorForeground": "#FC6B83",
    "list.warningForeground": "#F1B467",
    "editor.selectionBackground": "#40404099",
    "editor.selectionHighlightBackground": "#404040CC",
    "editor.wordHighlightBackground": "#E4E4E41E",
    "editor.wordHighlightStrongBackground": "#E4E4E430",
    "editor.findMatchBackground": "#88C0D066",
    "editor.findMatchHighlightBackground": "#88C0D044",
    "editor.lineHighlightBackground": "#262626",
    "editorLineNumber.foreground": "#E4E4E442",
    "editorLineNumber.activeForeground": "#E4E4E4EB",
    "editorCursor.foreground": "#E4E4E4EB",
    "editorBracketMatch.background": "#E4E4E41E",
    "editorIndentGuide.background1": "#E4E4E413",
    "editorIndentGuide.activeBackground1": "#E4E4E430",
    "editorRuler.foreground": "#E4E4E442",
    "editorGutter.background": "#181818",
    "editorGutter.addedBackground": "#3FA266",
    "editorGutter.modifiedBackground": "#D2943E",
    "editorGutter.deletedBackground": "#E34671",
    "editorSuggestWidget.background": "#141414",
    "editorSuggestWidget.border": "#E4E4E413",
    "editorSuggestWidget.foreground": "#E4E4E4EB",
    "editorSuggestWidget.selectedBackground": "#343434",
    "editorHoverWidget.background": "#181818",
    "editorHoverWidget.border": "#E4E4E413",
    "editorHoverWidget.foreground": "#E4E4E4EB",
    "editorWidget.background": "#141414",
    "editorWidget.resizeBorder": "#E4E4E426",
    "editorCodeLens.foreground": "#E4E4E442",
    "editorInlayHint.foreground": "#E4E4E442",
    "editorInlayHint.background": "#00000000",
    "peekView.border": "#E4E4E442",
    "peekViewEditor.background": "#141414",
    "peekViewResult.background": "#141414",
    "peekViewTitle.background": "#242424",
    "peekViewEditor.matchHighlightBackground": "#88C0D044",
    "peekViewResult.matchHighlightBackground": "#88C0D044",
    "diffEditor.insertedTextBackground": "#3FA26622",
    "diffEditor.insertedLineBackground": "#3FA26633",
    "diffEditor.removedTextBackground": "#B8004922",
    "diffEditor.removedLineBackground": "#B8004933",
    "statusBar.background": "#141414",
    "statusBar.foreground": "#E4E4E45E",
    "statusBar.border": "#E4E4E413",
    "statusBar.debuggingBackground": "#E4E4E41C",
    "statusBar.debuggingForeground": "#E4E4E4EB",
    "statusBarItem.activeBackground": "#E4E4E41E",
    "statusBarItem.hoverBackground": "#E4E4E411",
    "titleBar.activeBackground": "#141414",
    "titleBar.activeForeground": "#E4E4E484",
    "titleBar.inactiveBackground": "#141414",
    "titleBar.inactiveForeground": "#E4E4E45E",
    "titleBar.border": "#E4E4E413",
    "menu.background": "#141414",
    "menu.foreground": "#E4E4E4EB",
    "menu.separatorBackground": "#E4E4E413",
    "menu.border": "#E4E4E413",
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#E4E4E411",
    "scrollbarSlider.hoverBackground": "#E4E4E41E",
    "scrollbarSlider.activeBackground": "#E4E4E41E",
    "minimap.background": "#181818",
    "minimap.findMatchHighlight": "#88C0D044",
    "minimap.selectionHighlight": "#E4E4E411",
    "minimapGutter.addedBackground": "#3FA266",
    "minimapGutter.modifiedBackground": "#D2943E",
    "minimapGutter.deletedBackground": "#E34671",
    "gitDecoration.addedResourceForeground": "#70B489",
    "gitDecoration.modifiedResourceForeground": "#F1B467",
    "gitDecoration.deletedResourceForeground": "#FC6B83",
    "gitDecoration.untrackedResourceForeground": "#88C0D0",
    "gitDecoration.ignoredResourceForeground": "#E4E4E45E",
    "notificationLink.foreground": "#88C0D0",
    "notifications.background": "#141414",
    "notifications.foreground": "#E4E4E4EB",
    "progressBar.background": "#3FA266",
    descriptionForeground: "#E4E4E48D",
    errorForeground: "#E34671",
    "button.background": "#81A1C1",
    "button.foreground": "#191c22",
    "button.hoverBackground": "#87A6C4",
    "button.secondaryBackground": "#626262",
    "button.secondaryForeground": "#E4E4E4EB",
    "button.secondaryHoverBackground": "#818181",
    // Terminal colors
    "terminal.background": "#141414",
    "terminal.foreground": "#E4E4E4EB",
    "terminal.ansiBlack": "#242424",
    "terminal.ansiRed": "#FC6B83",
    "terminal.ansiGreen": "#3FA266",
    "terminal.ansiYellow": "#D2943E",
    "terminal.ansiBlue": "#81A1C1",
    "terminal.ansiMagenta": "#B48EAD",
    "terminal.ansiCyan": "#88C0D0",
    "terminal.ansiWhite": "#E4E4E4",
    "terminal.ansiBrightBlack": "#E4E4E442",
    "terminal.ansiBrightRed": "#FC6B83",
    "terminal.ansiBrightGreen": "#70B489",
    "terminal.ansiBrightYellow": "#F1B467",
    "terminal.ansiBrightBlue": "#87A6C4",
    "terminal.ansiBrightMagenta": "#B48EAD",
    "terminal.ansiBrightCyan": "#88C0D0",
    "terminal.ansiBrightWhite": "#E4E4E4",
    "terminalCursor.foreground": "#E4E4E4EB",
    "terminalCursor.background": "#141414",
  },
  tokenColors: [
    { scope: "emphasis", settings: { fontStyle: "italic" } },
    { scope: "strong", settings: { fontStyle: "bold" } },
    {
      scope:
        "comment, punctuation.definition.comment, comment.line.double-slash, comment.block.documentation",
      settings: { fontStyle: "italic", foreground: "#E4E4E45E" },
    },
    {
      scope:
        "string, punctuation.definition.string.begin, punctuation.definition.string.end",
      settings: { foreground: "#e394dc" },
    },
    {
      scope: "variable.parameter.function",
      settings: { foreground: "#d6d6dd" },
    },
    { scope: "constant.numeric", settings: { foreground: "#ebc88d" } },
    { scope: "constant.language", settings: { foreground: "#82d2ce" } },
    {
      scope: "constant.character, constant.character.escape",
      settings: { foreground: "#d6d6dd" },
    },
    { scope: "constant.other.color", settings: { foreground: "#ebc88d" } },
    { scope: "constant.other.symbol", settings: { foreground: "#d6d6dd" } },
    { scope: "keyword", settings: { foreground: "#82D2CE" } },
    { scope: "keyword.control", settings: { foreground: "#82D2CE" } },
    { scope: "keyword.operator", settings: { foreground: "#d6d6dd" } },
    {
      scope: "keyword.operator.assignment.compound",
      settings: { foreground: "#82D2CE" },
    },
    { scope: "keyword.operator.logical", settings: { foreground: "#d6d6dd" } },
    {
      scope:
        "keyword.operator.new, keyword.operator.expression.typeof, keyword.operator.expression.instanceof, keyword.operator.expression.keyof, keyword.operator.expression.of, keyword.operator.expression.in, keyword.operator.expression.delete, keyword.operator.expression.void, keyword.operator.ternary, keyword.operator.optional",
      settings: { foreground: "#82D2CE" },
    },
    { scope: "storage, token.storage", settings: { foreground: "#82d2ce" } },
    { scope: "storage.type", settings: { foreground: "#82d2ce" } },
    {
      scope: "storage.modifier.reference, storage.modifier.pointer",
      settings: { foreground: "#CCCCCC" },
    },
    {
      scope:
        "entity.name.function, meta.require, support.function, variable.function",
      settings: { foreground: "#efb080" },
    },
    { scope: "entity.name.type", settings: { foreground: "#efb080" } },
    {
      scope: "entity.name.type.namespace",
      settings: { foreground: "#efb080" },
    },
    {
      scope:
        "entity.name.class, variable.other.class.js, variable.other.class.ts",
      settings: { foreground: "#efb080" },
    },
    {
      scope: "entity.other.inherited-class",
      settings: { foreground: "#efb080" },
    },
    { scope: "entity.name.tag", settings: { foreground: "#87c3ff" } },
    {
      scope: "entity.other.attribute-name",
      settings: { foreground: "#aaa0fa" },
    },
    {
      scope: "entity.other.attribute-name.id",
      settings: { foreground: "#aaa0fa" },
    },
    {
      scope: "entity.other.attribute-name.class.css",
      settings: { foreground: "#f8c762" },
    },
    {
      scope: "support.class, entity.name.type.class",
      settings: { foreground: "#87c3ff" },
    },
    { scope: "support.function", settings: { foreground: "#efb080" } },
    { scope: "support.constant", settings: { foreground: "#f8c762" } },
    { scope: "support.type", settings: { foreground: "#efb080" } },
    {
      scope:
        "support.type.primitive.ts, support.type.builtin.ts, support.type.primitive.tsx, support.type.builtin.tsx",
      settings: { foreground: "#82D2CE" },
    },
    {
      scope:
        "support.variable.property, variable.other.property, variable.other.property.ts, meta.definition.property.ts",
      settings: { foreground: "#AAA0FA" },
    },
    { scope: "variable, variable.c", settings: { foreground: "#d6d6dd" } },
    { scope: "variable.other.readwrite", settings: { foreground: "#87C3FF" } },
    { scope: "variable.other.constant", settings: { foreground: "#AAA0FA" } },
    { scope: "variable.language", settings: { foreground: "#CC7C8A" } },
    {
      scope:
        "variable.parameter.function.js, variable.parameter.function.python, variable.parameter.function.language.python",
      settings: { foreground: "#f8c762" },
    },
    { scope: "meta.property-name.css", settings: { foreground: "#87c3ff" } },
    { scope: "meta.property-value.css", settings: { foreground: "#e394dc" } },
    { scope: "meta.tag", settings: { foreground: "#fad075" } },
    {
      scope: "meta.function-call.generic.python",
      settings: { foreground: "#aaa0fa" },
    },
    {
      scope: "punctuation.definition.tag",
      settings: { foreground: "#A4A4A4" },
    },
    {
      scope: "punctuation.separator.delimiter",
      settings: { foreground: "#d6d6dd" },
    },
    {
      scope:
        "punctuation.definition.template-expression.begin, punctuation.definition.template-expression.end, punctuation.section.embedded",
      settings: { foreground: "#82D2CE" },
    },
    {
      scope:
        "punctuation.definition.decorator.python, entity.name.function.decorator.python, meta.function.decorator.python",
      settings: { foreground: "#a8cc7c" },
    },
    { scope: "string.regexp", settings: { foreground: "#d6d6dd" } },
    {
      scope: "string.quoted.binary.single.python",
      settings: { foreground: "#a8cc7c" },
    },
    {
      scope: "support.type.property-name.json",
      settings: { foreground: "#82d2ce" },
    },
    {
      scope:
        "source.json meta.structure.dictionary.json > value.json > string.quoted.json, source.json meta.structure.array.json > value.json > string.quoted.json",
      settings: { foreground: "#e394dc" },
    },
    { scope: "markup.heading", settings: { foreground: "#d6d6dd" } },
    {
      scope:
        "markup.heading punctuation.definition.heading, entity.name.section",
      settings: { foreground: "#aaa0fa" },
    },
    { scope: "markup.bold, todo.bold", settings: { foreground: "#f8c762" } },
    {
      scope: "markup.italic, punctuation.definition.italic, todo.emphasis",
      settings: { foreground: "#82D2CE" },
    },
    {
      scope: "markup.inline.raw.markdown, markup.inline.raw.string.markdown",
      settings: { foreground: "#e394dc" },
    },
    {
      scope:
        "markup.underline.link.markdown, markup.underline.link.image.markdown",
      settings: { foreground: "#82D2CE" },
    },
    { scope: "markup.quote.markdown", settings: { foreground: "#E4E4E45E" } },
    {
      scope:
        "punctuation.definition.list.begin.markdown, punctuation.definition.list.markdown, beginning.punctuation.definition.list.markdown",
      settings: { foreground: "#d6d6dd" },
    },
    { scope: "keyword.other.unit", settings: { foreground: "#ebc88d" } },
    {
      scope:
        "invalid.illegal, invalid.broken, invalid.deprecated, invalid.unimplemented",
      settings: { foreground: "#d6d6dd" },
    },
    { scope: "token.info-token", settings: { foreground: "#aaa0fa" } },
    { scope: "token.warn-token", settings: { foreground: "#f8c762" } },
    { scope: "token.error-token", settings: { foreground: "#F14C4C" } },
    { scope: "token.debug-token", settings: { foreground: "#82D2CE" } },
    // Python
    { scope: "support.type.python", settings: { foreground: "#82d2ce" } },
    {
      scope: "variable.parameter.function.language.special.self.python",
      settings: { foreground: "#efb080" },
    },
    {
      scope: "support.variable.magic.python",
      settings: { foreground: "#d6d6dd" },
    },
    {
      scope: "constant.other.ellipsis.python",
      settings: { foreground: "#CCCCCC" },
    },
    {
      scope: "keyword.control.import.python, keyword.control.flow.python",
      settings: { fontStyle: "italic" },
    },
    // C/C++
    {
      scope: "constant.language.false.cpp, constant.language.true.cpp",
      settings: { foreground: "#82d2ce" },
    },
    {
      scope: "variable.language.this.cpp",
      settings: { foreground: "#82d2ce" },
    },
    { scope: "keyword.control.directive", settings: { foreground: "#a8cc7c" } },
    {
      scope: "keyword.control.directive.include.cpp",
      settings: { foreground: "#a8cc7c" },
    },
    {
      scope: "support.type.posix-reserved.c, support.type.posix-reserved.cpp",
      settings: { foreground: "#d6d6dd" },
    },
    {
      scope: "keyword.operator.sizeof.c, keyword.operator.sizeof.cpp",
      settings: { foreground: "#82D2CE" },
    },
    {
      scope: "punctuation.separator.c, punctuation.separator.cpp",
      settings: { foreground: "#82D2CE" },
    },
    // Rust
    {
      scope: "storage.modifier.lifetime.rust",
      settings: { foreground: "#d6d6dd" },
    },
    { scope: "entity.name.lifetime.rust", settings: { foreground: "#efb080" } },
    { scope: "variable.language.rust", settings: { foreground: "#d6d6dd" } },
    { scope: "support.function.std.rust", settings: { foreground: "#aaa0fa" } },
    {
      scope: "keyword.operator.sigil.rust",
      settings: { foreground: "#82D2CE" },
    },
    {
      scope: "support.constant.core.rust",
      settings: { foreground: "#f8c762" },
    },
    // TypeScript/JavaScript
    {
      scope: "entity.name.function.js, support.function.console.js",
      settings: { foreground: "#ebc88d" },
    },
    {
      scope: "support.type.object.console",
      settings: { foreground: "#d6d6dd" },
    },
    { scope: "support.constant.math", settings: { foreground: "#efb080" } },
    {
      scope: "support.constant.property.math",
      settings: { foreground: "#f8c762" },
    },
    {
      scope: "keyword.operator.expression.import",
      settings: { foreground: "#aaa0fa" },
    },
    {
      scope:
        "keyword.other.template.begin, keyword.other.template.end, keyword.other.substitution.begin, keyword.other.substitution.end",
      settings: { foreground: "#e394dc" },
    },
    { scope: "meta.template.expression", settings: { foreground: "#d6d6dd" } },
    // Java
    {
      scope: "storage.type.annotation.java, storage.type.object.array.java",
      settings: { foreground: "#efb080" },
    },
    { scope: "source.java", settings: { foreground: "#d6d6dd" } },
    {
      scope:
        "storage.modifier.import.java, storage.type.java, storage.type.generic.java",
      settings: { foreground: "#efb080" },
    },
    {
      scope: "keyword.operator.instanceof.java",
      settings: { foreground: "#82D2CE" },
    },
    { scope: "meta.method.java", settings: { foreground: "#aaa0fa" } },
    {
      scope: "meta.definition.variable.name.java",
      settings: { foreground: "#d6d6dd" },
    },
    // Go
    { scope: "entity.name.package.go", settings: { foreground: "#efb080" } },
    {
      scope: "keyword.operator.assignment.go",
      settings: { foreground: "#efb080" },
    },
    {
      scope: "keyword.operator.arithmetic.go, keyword.operator.address.go",
      settings: { foreground: "#82D2CE" },
    },
    // Vue
    {
      scope:
        "entity.name.tag.template, entity.name.tag.script, entity.name.tag.style",
      settings: { foreground: "#AAA0FA" },
    },
    // HTML
    { scope: "entity.name.tag.html", settings: { foreground: "#87c3ff" } },
    // YAML
    {
      scope: "punctuation.definition.block.sequence.item.yaml",
      settings: { foreground: "#d6d6dd" },
    },
    // Elixir
    {
      scope: "constant.language.symbol.elixir",
      settings: { foreground: "#d6d6dd" },
    },
    // Diff
    { scope: "markup.changed.diff", settings: { foreground: "#efb080" } },
    {
      scope:
        "meta.diff.header.from-file, meta.diff.header.to-file, punctuation.definition.from-file.diff, punctuation.definition.to-file.diff",
      settings: { foreground: "#aaa0fa" },
    },
    { scope: "markup.inserted.diff", settings: { foreground: "#e394dc" } },
    { scope: "markup.deleted.diff", settings: { foreground: "#d6d6dd" } },
    // PHP
    {
      scope:
        "support.other.namespace.use.php, support.other.namespace.use-as.php, support.other.namespace.php, entity.other.alias.php, meta.interface.php",
      settings: { foreground: "#efb080" },
    },
    {
      scope: "keyword.operator.error-control.php, keyword.operator.type.php",
      settings: { foreground: "#82D2CE" },
    },
    {
      scope:
        "storage.type.php, meta.other.type.phpdoc.php, keyword.other.type.php, keyword.other.array.phpdoc.php",
      settings: { foreground: "#efb080" },
    },
    {
      scope:
        "meta.function-call.php, meta.function-call.object.php, meta.function-call.static.php",
      settings: { foreground: "#aaa0fa" },
    },
    {
      scope:
        "support.constant.ext.php, support.constant.std.php, support.constant.core.php, support.constant.parser-token.php",
      settings: { foreground: "#f8c762" },
    },
    // CSS
    {
      scope:
        "keyword.operator.css, keyword.operator.scss, keyword.operator.less",
      settings: { foreground: "#d6d6dd" },
    },
    {
      scope:
        "support.constant.color.w3c-standard-color-name.css, support.constant.color.w3c-standard-color-name.scss",
      settings: { foreground: "#f8c762" },
    },
    {
      scope: "punctuation.separator.list.comma.css",
      settings: { foreground: "#d6d6dd" },
    },
    // C#
    { scope: "storage.type.cs", settings: { foreground: "#efb080" } },
    {
      scope: "entity.name.variable.local.cs",
      settings: { foreground: "#d6d6dd" },
    },
    {
      scope:
        "entity.name.label.cs, entity.name.scope-resolution.function.call, entity.name.scope-resolution.function.definition",
      settings: { foreground: "#efb080" },
    },
    // Ruby
    {
      scope: "constant.language.symbol.ruby",
      settings: { foreground: "#d6d6dd" },
    },
    // Haskell
    {
      scope: "variable.other.generic-type.haskell",
      settings: { foreground: "#82D2CE" },
    },
    { scope: "storage.type.haskell", settings: { foreground: "#f8c762" } },
    // RegExp
    {
      scope: "keyword.operator.quantifier.regexp",
      settings: { foreground: "#f8c762" },
    },
    // Misc
    { scope: "support.constant.edge", settings: { foreground: "#82D2CE" } },
    {
      scope:
        "entity.name.type.module, support.module.node, support.type.object.module",
      settings: { foreground: "#efb080" },
    },
  ],
  semanticHighlighting: true,
  semanticTokenColors: {
    enumMember: { foreground: "#d6d6dd" },
    "variable.constant": { foreground: "#82D2CE" },
    "variable.defaultLibrary": { foreground: "#d6d6dd" },
    "method.declaration": { foreground: "#efb080", fontStyle: "bold" },
    "function.declaration": { foreground: "#efb080", fontStyle: "bold" },
    function: "#ebc88d",
    "function.builtin": "#82d2ce",
    "class.builtin": "#82d2ce",
    "class.declaration:python": "#87c3ff",
    "class:python": { foreground: "#ebc88d" },
    "*.decorator:python": { foreground: "#a8cc7c" },
    "method:python": { foreground: "#ebc88d" },
    selfParameter: "#cc7c8a",
    macro: "#a8cc7c",
    "namespace:cpp": "#87c3ff",
    "type:cpp": "#87c3ff",
    "type:c": "#87c3ff",
    "variable.global:cpp": "#a8cc7c",
    "variable.global:c": "#a8cc7c",
    "property:cpp": "#AAA0FA",
    "property:c": "#AAA0FA",
    "property.declaration:cpp": "#AAA0FA",
    "property.declaration:c": "#AAA0FA",
    "function:cpp": { foreground: "#E4E4E4EB", fontStyle: "bold" },
    "function:c": { foreground: "#E4E4E4EB", fontStyle: "bold" },
    "method:cpp": { foreground: "#87c3ff" },
    "variable:javascript": "#CCCCCC",
    "support.variable.property": "#AAA0FA",
    "builtinConstant.readonly.builtin:python": "#82d2ce",
  },
}

/**
 * Cursor Light theme colors and syntax highlighting
 * Official Cursor IDE light theme
 */
export const CURSOR_LIGHT: VSCodeFullTheme = {
  id: "cursor-light",
  name: "Cursor Light",
  type: "light",
  source: "builtin",
  colors: {
    "editor.background": "#FCFCFC",
    "editor.foreground": "#141414EB",
    foreground: "#141414EB",
    "sideBar.background": "#F3F3F3",
    "sideBar.foreground": "#141414AD",
    "sideBar.border": "#14141413",
    "activityBar.background": "#F3F3F3",
    "activityBar.foreground": "#141414AD",
    "activityBarBadge.background": "#206595",
    "activityBarBadge.foreground": "#F3F3F3",
    "panel.background": "#F3F3F3",
    "panel.border": "#14141413",
    "tab.activeBackground": "#FCFCFC",
    "tab.inactiveBackground": "#F3F3F3",
    "tab.inactiveForeground": "#141414AD",
    "tab.activeForeground": "#141414EB",
    "tab.border": "#1414141C",
    "editorGroupHeader.tabsBackground": "#F3F3F3",
    "dropdown.background": "#FCFCFC",
    "dropdown.foreground": "#141414EB",
    "dropdown.border": "#14141413",
    "input.background": "#FCFCFC",
    "input.border": "#14141426",
    "input.foreground": "#141414EB",
    "input.placeholderForeground": "#1414147A",
    focusBorder: "#14141426",
    "textLink.foreground": "#3C7CAB",
    "textLink.activeForeground": "#3C7CAB",
    "list.activeSelectionBackground": "#14141411",
    "list.activeSelectionForeground": "#141414EB",
    "list.hoverBackground": "#14141411",
    "list.hoverForeground": "#141414EB",
    "list.focusBackground": "#1414141E",
    "list.focusForeground": "#141414EB",
    "list.inactiveSelectionBackground": "#14141411",
    "list.inactiveSelectionForeground": "#141414EB",
    "list.highlightForeground": "#6F9BA6",
    "list.errorForeground": "#CF2D56",
    "list.warningForeground": "#C08532",
    "editor.selectionBackground": "#1414141E",
    "editor.selectionHighlightBackground": "#14141411",
    "editor.wordHighlightBackground": "#1414141E",
    "editor.wordHighlightStrongBackground": "#1414140A",
    "editor.findMatchBackground": "#6F9BA65C",
    "editor.findMatchHighlightBackground": "#6F9BA62E",
    "editor.lineHighlightBackground": "#EDEDED",
    "editorLineNumber.foreground": "#1414147A",
    "editorLineNumber.activeForeground": "#141414AD",
    "editorCursor.foreground": "#141414EB",
    "editorBracketMatch.background": "#1414141E",
    "editorIndentGuide.background1": "#14141413",
    "editorIndentGuide.activeBackground1": "#14141426",
    "editorRuler.foreground": "#14141426",
    "editorGutter.background": "#FCFCFC",
    "editorGutter.addedBackground": "#1F8A65",
    "editorGutter.modifiedBackground": "#C08532",
    "editorGutter.deletedBackground": "#CF2D56",
    "editorSuggestWidget.background": "#F3F3F3",
    "editorSuggestWidget.border": "#14141413",
    "editorSuggestWidget.foreground": "#141414AD",
    "editorSuggestWidget.selectedBackground": "#14141411",
    "editorHoverWidget.background": "#FCFCFC",
    "editorHoverWidget.border": "#1414141C",
    "editorHoverWidget.foreground": "#141414EB",
    "editorWidget.background": "#F3F3F3",
    "editorWidget.resizeBorder": "#14141426",
    "editorCodeLens.foreground": "#141414AD",
    "editorInlayHint.foreground": "#141414AD",
    "editorInlayHint.background": "#FCFCFC00",
    "diffEditor.insertedTextBackground": "#1F8A6524",
    "diffEditor.insertedLineBackground": "#1F8A651F",
    "diffEditor.removedTextBackground": "#CF2D561F",
    "diffEditor.removedLineBackground": "#CF2D5614",
    "statusBar.background": "#F3F3F3",
    "statusBar.foreground": "#1414147A",
    "statusBar.border": "#14141413",
    "statusBarItem.activeBackground": "#1414141E",
    "statusBarItem.hoverBackground": "#14141411",
    "titleBar.activeBackground": "#F3F3F3",
    "titleBar.activeForeground": "#141414AD",
    "titleBar.inactiveBackground": "#F3F3F3",
    "titleBar.inactiveForeground": "#1414147A",
    "menu.background": "#F3F3F3",
    "menu.foreground": "#141414AD",
    "menu.separatorBackground": "#14141413",
    "scrollbar.shadow": "#14141411",
    "scrollbarSlider.background": "#1414141E",
    "scrollbarSlider.hoverBackground": "#14141430",
    "scrollbarSlider.activeBackground": "#14141430",
    "gitDecoration.addedResourceForeground": "#1F8A65",
    "gitDecoration.modifiedResourceForeground": "#C08532",
    "gitDecoration.deletedResourceForeground": "#CF2D56",
    "gitDecoration.untrackedResourceForeground": "#4C7F8C",
    "gitDecoration.ignoredResourceForeground": "#1414147A",
    "notificationLink.foreground": "#6F9BA6",
    "notifications.background": "#F3F3F3",
    "notifications.foreground": "#141414EB",
    "progressBar.background": "#1F8A65",
    descriptionForeground: "#141414AD",
    errorForeground: "#CF2D56",
    "button.background": "#3C7CAB",
    "button.foreground": "#FCFCFC",
    "button.hoverBackground": "#055180",
    "button.secondaryBackground": "#1414141E",
    "button.secondaryForeground": "#141414EB",
    "button.secondaryHoverBackground": "#14141430",
    // Terminal colors
    "terminal.background": "#F3F3F3",
    "terminal.foreground": "#141414EB",
    "terminal.ansiBlack": "#141414EB",
    "terminal.ansiRed": "#CF2D56",
    "terminal.ansiGreen": "#1F8A65",
    "terminal.ansiYellow": "#A16900",
    "terminal.ansiBlue": "#3C7CAB",
    "terminal.ansiMagenta": "#B8448B",
    "terminal.ansiCyan": "#4C7F8C",
    "terminal.ansiWhite": "#FCFCFC",
    "terminal.ansiBrightBlack": "#141414AD",
    "terminal.ansiBrightRed": "#E75E78",
    "terminal.ansiBrightGreen": "#55A583",
    "terminal.ansiBrightYellow": "#C08532",
    "terminal.ansiBrightBlue": "#6299C3",
    "terminal.ansiBrightMagenta": "#D06BA6",
    "terminal.ansiBrightCyan": "#6F9BA6",
    "terminal.ansiBrightWhite": "#FFFFFF",
  },
  tokenColors: [
    { scope: "emphasis", settings: { fontStyle: "italic" } },
    { scope: "strong", settings: { fontStyle: "bold" } },
    {
      scope: "comment, punctuation.definition.comment",
      settings: { fontStyle: "italic", foreground: "#1414147A" },
    },
    {
      scope:
        "string, punctuation.definition.string.begin, punctuation.definition.string.end",
      settings: { foreground: "#9E94D5" },
    },
    {
      scope: "variable.parameter.function",
      settings: { foreground: "#141414EB" },
    },
    { scope: "constant.numeric", settings: { foreground: "#6F9BA6" } },
    { scope: "constant.language", settings: { foreground: "#6F9BA6" } },
    {
      scope: "constant.character, constant.character.escape",
      settings: { foreground: "#141414AD" },
    },
    { scope: "constant.other.color", settings: { foreground: "#6F9BA6" } },
    { scope: "keyword", settings: { foreground: "#206595" } },
    { scope: "keyword.control", settings: { foreground: "#206595" } },
    { scope: "keyword.operator", settings: { foreground: "#141414EB" } },
    {
      scope:
        "keyword.operator.new, keyword.operator.expression.typeof, keyword.operator.expression.instanceof, keyword.operator.expression.keyof, keyword.operator.expression.of, keyword.operator.expression.in, keyword.operator.expression.delete, keyword.operator.expression.void, keyword.operator.ternary, keyword.operator.optional",
      settings: { foreground: "#6F9BA6" },
    },
    { scope: "storage, token.storage", settings: { foreground: "#206595" } },
    { scope: "storage.type", settings: { foreground: "#206595" } },
    {
      scope:
        "entity.name.function, meta.require, support.function, variable.function",
      settings: { foreground: "#6049B3" },
    },
    { scope: "entity.name.type", settings: { foreground: "#B3003F" } },
    { scope: "entity.name.class", settings: { foreground: "#B3003F" } },
    {
      scope: "entity.other.inherited-class",
      settings: { foreground: "#B3003F" },
    },
    { scope: "entity.name.tag", settings: { foreground: "#B3003F" } },
    {
      scope: "entity.other.attribute-name",
      settings: { foreground: "#6049B3" },
    },
    {
      scope: "entity.other.attribute-name.id",
      settings: { foreground: "#6049B3" },
    },
    {
      scope: "entity.other.attribute-name.class.css",
      settings: { foreground: "#C08532" },
    },
    {
      scope: "support.class, entity.name.type.class",
      settings: { foreground: "#B3003F" },
    },
    { scope: "support.function", settings: { foreground: "#6049B3" } },
    { scope: "support.constant", settings: { foreground: "#6F9BA6" } },
    { scope: "support.type", settings: { foreground: "#6F9BA6" } },
    {
      scope:
        "support.type.primitive.ts, support.type.builtin.ts, support.type.primitive.tsx, support.type.builtin.tsx",
      settings: { foreground: "#206595" },
    },
    {
      scope: "support.variable.property, variable.other.property",
      settings: { foreground: "#6049B3" },
    },
    { scope: "variable", settings: { foreground: "#141414EB" } },
    { scope: "variable.other.constant", settings: { foreground: "#6F9BA6" } },
    { scope: "variable.language", settings: { foreground: "#B8448B" } },
    {
      scope:
        "variable.parameter.function.python, variable.parameter.function.language.python",
      settings: { foreground: "#DB704B" },
    },
    {
      scope: "meta.property-name.css, support.type.property-name.css",
      settings: { foreground: "#1F8A65" },
    },
    { scope: "meta.tag", settings: { foreground: "#C08532" } },
    {
      scope: "meta.function-call.generic.python",
      settings: { foreground: "#6049B3" },
    },
    {
      scope: "punctuation.definition.tag",
      settings: { foreground: "#141414AD" },
    },
    {
      scope: "punctuation.separator.delimiter",
      settings: { foreground: "#141414EB" },
    },
    {
      scope:
        "punctuation.definition.template-expression.begin, punctuation.definition.template-expression.end, punctuation.section.embedded",
      settings: { foreground: "#6F9BA6" },
    },
    {
      scope:
        "punctuation.definition.decorator.python, entity.name.function.decorator.python, meta.function.decorator.python",
      settings: { foreground: "#1F8A65" },
    },
    { scope: "string.regexp", settings: { foreground: "#141414EB" } },
    {
      scope: "string.quoted.binary.single.python",
      settings: { foreground: "#1F8A65" },
    },
    {
      scope: "support.type.property-name.json",
      settings: { foreground: "#1F8A65" },
    },
    {
      scope:
        "source.json meta.structure.dictionary.json > value.json > string.quoted.json, source.json meta.structure.array.json > value.json > string.quoted.json",
      settings: { foreground: "#9E94D5" },
    },
    { scope: "markup.heading", settings: { foreground: "#206595" } },
    {
      scope:
        "entity.name.section.markdown, punctuation.definition.heading.markdown, markup.heading.setext",
      settings: { foreground: "#141414EB" },
    },
    { scope: "markup.quote", settings: { foreground: "#141414AD" } },
    { scope: "markup.bold", settings: { fontStyle: "bold" } },
    { scope: "markup.italic", settings: { fontStyle: "italic" } },
    { scope: "markup.underline", settings: { fontStyle: "underline" } },
    {
      scope: "markup.strikethrough, punctuation.definition.strikethrough",
      settings: { foreground: "#1414147A", fontStyle: "strikethrough" },
    },
    { scope: "markup.inline.raw", settings: { foreground: "#1F8A65" } },
    {
      scope:
        "markup.underline.link.markdown, markup.underline.link.image.markdown",
      settings: { foreground: "#141414AD" },
    },
    {
      scope:
        "punctuation.definition.list.begin.markdown, punctuation.definition.list.markdown",
      settings: { foreground: "#141414AD" },
    },
    {
      scope:
        "string.other.link.title.markdown, string.other.link.description.markdown",
      settings: { foreground: "#141414AD" },
    },
    { scope: "keyword.other.unit", settings: { foreground: "#6F9BA6" } },
    {
      scope:
        "markup.deleted, meta.diff.header.from-file, punctuation.definition.deleted",
      settings: { foreground: "#B3003F" },
    },
    {
      scope:
        "markup.inserted, meta.diff.header.to-file, punctuation.definition.inserted",
      settings: { foreground: "#1F8A65" },
    },
    {
      scope: "markup.changed, punctuation.definition.changed",
      settings: { foreground: "#DB704B" },
    },
    {
      scope: "markup.ignored, markup.untracked",
      settings: { foreground: "#1414147A" },
    },
    { scope: "meta.diff.range", settings: { foreground: "#6049B3" } },
    { scope: "meta.diff.header", settings: { foreground: "#206595" } },
    {
      scope:
        "invalid.broken, invalid.deprecated, invalid.illegal, invalid.unimplemented",
      settings: { fontStyle: "italic", foreground: "#B3003F" },
    },
    { scope: "token.info-token", settings: { foreground: "#6F9BA6" } },
    { scope: "token.warn-token", settings: { foreground: "#C08532" } },
    { scope: "token.error-token", settings: { foreground: "#CF2D56" } },
    { scope: "token.debug-token", settings: { foreground: "#6049B3" } },
    // Python
    { scope: "support.type.python", settings: { foreground: "#6F9BA6" } },
    {
      scope: "variable.parameter.function.language.special.self.python",
      settings: { foreground: "#B8448B" },
    },
    {
      scope: "keyword.control.import.python, keyword.control.flow.python",
      settings: { fontStyle: "italic" },
    },
    // C/C++
    {
      scope:
        "storage.type.c, storage.type.cpp, support.type.posix-reserved.c, support.type.posix-reserved.cpp",
      settings: { foreground: "#206595" },
    },
    {
      scope: "constant.language.false.cpp, constant.language.true.cpp",
      settings: { foreground: "#6F9BA6" },
    },
    {
      scope: "variable.language.this.cpp",
      settings: { foreground: "#6F9BA6" },
    },
    {
      scope: "keyword.control.directive.include.cpp",
      settings: { foreground: "#1F8A65" },
    },
    {
      scope: "punctuation.separator.c, punctuation.separator.cpp",
      settings: { foreground: "#6F9BA6" },
    },
    // TypeScript/JavaScript
    {
      scope:
        "keyword.other.template.begin, keyword.other.template.end, keyword.other.substitution.begin, keyword.other.substitution.end",
      settings: { foreground: "#9E94D5" },
    },
    // Java
    {
      scope:
        "storage.modifier.package, storage.modifier.import, storage.type.java",
      settings: { foreground: "#141414EB" },
    },
    { scope: "variable.parameter.java", settings: { foreground: "#141414EB" } },
    {
      scope: "storage.modifier.import.java",
      settings: { foreground: "#B3003F" },
    },
    {
      scope: "storage.type.annotation.java, storage.type.object.array.java",
      settings: { foreground: "#206595" },
    },
    { scope: "storage.type.java", settings: { foreground: "#206595" } },
    {
      scope:
        "storage.modifier.import.java, storage.type.java, storage.type.generic.java",
      settings: { foreground: "#B3003F" },
    },
    // Go
    { scope: "entity.name.package.go", settings: { foreground: "#B3003F" } },
    // Vue
    {
      scope:
        "entity.name.tag.template, entity.name.tag.script, entity.name.tag.style",
      settings: { foreground: "#6049B3" },
    },
    // YAML
    {
      scope: "punctuation.definition.block.sequence.item.yaml",
      settings: { foreground: "#141414EB" },
    },
    // Elixir
    {
      scope: "constant.language.symbol.elixir",
      settings: { foreground: "#141414EB" },
    },
    // Misc
    {
      scope: "constant.character.escape",
      settings: { foreground: "#141414AD" },
    },
    {
      scope:
        "punctuation.section.embedded.begin, punctuation.section.embedded.end",
      settings: { foreground: "#6F9BA6" },
    },
  ],
}

/**
 * Cursor Dark Midnight theme colors and syntax highlighting
 * Official Cursor IDE dark midnight theme (Nord-inspired)
 */
export const CURSOR_MIDNIGHT: VSCodeFullTheme = {
  id: "cursor-midnight",
  name: "Cursor Midnight",
  type: "dark",
  source: "builtin",
  colors: {
    "editor.background": "#1e2127",
    "editor.foreground": "#7b88a1",
    foreground: "#7b88a1",
    "sideBar.background": "#191c22",
    "sideBar.foreground": "#7c818e",
    "sideBar.border": "#ffffff0d",
    "activityBar.background": "#191c22",
    "activityBar.foreground": "#7b88a1",
    "activityBarBadge.background": "#88c0d0",
    "activityBarBadge.foreground": "#1d2128",
    "panel.background": "#191c22",
    "panel.border": "#ffffff0d",
    "tab.activeBackground": "#1e2127",
    "tab.inactiveBackground": "#191c22",
    "tab.inactiveForeground": "#4b5163",
    "tab.activeForeground": "#d8dee9",
    "tab.border": "#ffffff0d",
    "editorGroupHeader.tabsBackground": "#191c22",
    "dropdown.background": "#191c22",
    "dropdown.foreground": "#d8dee9",
    "dropdown.border": "#272c36",
    "input.background": "#272c3655",
    "input.border": "#272c36",
    "input.foreground": "#d8dee9",
    "input.placeholderForeground": "#d8dee999",
    focusBorder: "#00000000",
    "textLink.foreground": "#8fbcbb",
    "textLink.activeForeground": "#8fbcbb",
    "list.activeSelectionBackground": "#21242b",
    "list.activeSelectionForeground": "#eceff4",
    "list.hoverBackground": "#272c3699",
    "list.hoverForeground": "#eceff4",
    "list.focusBackground": "#434c5e",
    "list.focusForeground": "#d8dee9",
    "list.inactiveSelectionBackground": "#21242b",
    "list.inactiveSelectionForeground": "#eceff4",
    "list.highlightForeground": "#88c0d0",
    "list.errorForeground": "#bf616a",
    "list.warningForeground": "#ebcb8b",
    "editor.selectionBackground": "#434c5e99",
    "editor.selectionHighlightBackground": "#434c5ecc",
    "editor.wordHighlightBackground": "#81a1c166",
    "editor.wordHighlightStrongBackground": "#81a1c199",
    "editor.findMatchBackground": "#88c0d066",
    "editor.findMatchHighlightBackground": "#88c0d033",
    "editor.lineHighlightBackground": "#434c5e33",
    "editor.lineHighlightBorder": "#272930",
    "editorLineNumber.foreground": "#4c566a",
    "editorLineNumber.activeForeground": "#687692",
    "editorCursor.foreground": "#d8dee9",
    "editorBracketMatch.background": "#191c2200",
    "editorBracketMatch.border": "#88c0d055",
    "editorIndentGuide.background": "#434c5eb3",
    "editorIndentGuide.activeBackground": "#4c566a",
    "editorRuler.foreground": "#434c5e",
    "editorGutter.background": "#1e2127",
    "editorGutter.addedBackground": "#a3be8c",
    "editorGutter.modifiedBackground": "#ebcb8b",
    "editorGutter.deletedBackground": "#bf616a",
    "editorSuggestWidget.background": "#191c22",
    "editorSuggestWidget.border": "#272c36",
    "editorSuggestWidget.foreground": "#d8dee9",
    "editorSuggestWidget.selectedBackground": "#434c5e",
    "editorHoverWidget.background": "#20242c",
    "editorHoverWidget.border": "#272c36",
    "editorWidget.background": "#191c22",
    "editorWidget.resizeBorder": "#88c0d0",
    "editorCodeLens.foreground": "#4c566a",
    "editorInlayHint.foreground": "#4c566a",
    "editorInlayHint.background": "#00000000",
    "peekView.border": "#4c566a",
    "peekViewEditor.background": "#191c22",
    "peekViewResult.background": "#191c22",
    "peekViewTitle.background": "#272c36",
    "peekViewEditor.matchHighlightBackground": "#88c0d0cc",
    "peekViewResult.matchHighlightBackground": "#88c0d0cc",
    "peekViewResult.fileForeground": "#88c0d0",
    "peekViewTitleLabel.foreground": "#88c0d0",
    "diffEditor.insertedTextBackground": "#a3be8c22",
    "diffEditor.removedTextBackground": "#bf616a22",
    "statusBar.background": "#191c22",
    "statusBar.foreground": "#4b5163",
    "statusBar.border": "#ffffff0d",
    "statusBar.debuggingBackground": "#434c5e",
    "statusBar.debuggingForeground": "#d8dee9",
    "statusBarItem.activeBackground": "#4c566a",
    "statusBarItem.hoverBackground": "#434c5e",
    "titleBar.activeBackground": "#191c22",
    "titleBar.activeForeground": "#4b5163",
    "titleBar.inactiveBackground": "#191c22",
    "titleBar.inactiveForeground": "#7b88a199",
    "titleBar.border": "#ffffff0d",
    "menu.background": "#191c22",
    "menu.foreground": "#7b88a1",
    "menu.separatorBackground": "#7b88a1",
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#434c5e55",
    "scrollbarSlider.hoverBackground": "#434c5e55",
    "scrollbarSlider.activeBackground": "#434c5e55",
    "gitDecoration.addedResourceForeground": "#a3be8c",
    "gitDecoration.modifiedResourceForeground": "#ebcb8b",
    "gitDecoration.deletedResourceForeground": "#bf616a",
    "gitDecoration.untrackedResourceForeground": "#88c0d0",
    "gitDecoration.ignoredResourceForeground": "#4b5163",
    "notificationLink.foreground": "#88c0d0",
    "notifications.background": "#191c22",
    "notifications.foreground": "#d8dee9",
    "progressBar.background": "#88c0d0",
    descriptionForeground: "#7b88a1",
    errorForeground: "#bf616a",
    "button.background": "#88c0d0",
    "button.foreground": "#191c22",
    "button.hoverBackground": "#98d5e7",
    "button.secondaryBackground": "#434c5e",
    "button.secondaryForeground": "#d8dee9",
    "button.secondaryHoverBackground": "#4c566a",
    // Terminal colors
    "terminal.background": "#191c22",
    "terminal.foreground": "#d8dee9",
    "terminal.ansiBlack": "#272c36",
    "terminal.ansiRed": "#bf616a",
    "terminal.ansiGreen": "#a3be8c",
    "terminal.ansiYellow": "#ebcb8b",
    "terminal.ansiBlue": "#81a1c1",
    "terminal.ansiMagenta": "#7d7c9b",
    "terminal.ansiCyan": "#88c0d0",
    "terminal.ansiWhite": "#e5e9f0",
    "terminal.ansiBrightBlack": "#4c566a",
    "terminal.ansiBrightRed": "#bf616a",
    "terminal.ansiBrightGreen": "#a3be8c",
    "terminal.ansiBrightYellow": "#ebcb8b",
    "terminal.ansiBrightBlue": "#81a1c1",
    "terminal.ansiBrightMagenta": "#b48ead",
    "terminal.ansiBrightCyan": "#8fbcbb",
    "terminal.ansiBrightWhite": "#eceff4",
    "terminalCursor.foreground": "#8fbcbb",
    "terminalCursor.background": "#8fbcbb22",
  },
  tokenColors: [
    { scope: "emphasis", settings: { fontStyle: "italic" } },
    { scope: "strong", settings: { fontStyle: "bold" } },
    {
      scope: "comment",
      settings: { foreground: "#8597BCA6", fontStyle: "italic" },
    },
    { scope: "constant.character", settings: { foreground: "#EBCB8B" } },
    { scope: "constant.character.escape", settings: { foreground: "#EBCB8B" } },
    { scope: "constant.language", settings: { foreground: "#81A1C1" } },
    { scope: "constant.numeric", settings: { foreground: "#B48EAD" } },
    { scope: "constant.regexp", settings: { foreground: "#EBCB8B" } },
    { scope: "entity.name.class", settings: { foreground: "#8FBCBB" } },
    { scope: "entity.name.function", settings: { foreground: "#88C0D0" } },
    { scope: "entity.name.tag", settings: { foreground: "#81A1C1" } },
    { scope: "entity.name.type", settings: { foreground: "#8FBCBB" } },
    {
      scope: "entity.other.attribute-name",
      settings: { foreground: "#8FBCBB" },
    },
    {
      scope: "entity.other.inherited-class",
      settings: { foreground: "#8FBCBB" },
    },
    { scope: "invalid.broken", settings: { foreground: "#BF616A" } },
    { scope: "invalid.deprecated", settings: { foreground: "#D08770" } },
    { scope: "invalid.illegal", settings: { foreground: "#BF616A" } },
    { scope: "invalid.unimplemented", settings: { foreground: "#D08770" } },
    { scope: "keyword", settings: { foreground: "#81A1C1" } },
    { scope: "keyword.control", settings: { foreground: "#81A1C1" } },
    { scope: "keyword.operator", settings: { foreground: "#81A1C1" } },
    { scope: "keyword.other", settings: { foreground: "#8FBCBB" } },
    { scope: "keyword.other.unit", settings: { foreground: "#B48EAD" } },
    { scope: "meta.diff.header", settings: { foreground: "#8FBCBB" } },
    { scope: "punctuation", settings: { foreground: "#ECEFF4" } },
    {
      scope: "punctuation.definition.tag",
      settings: { foreground: "#81A1C1" },
    },
    {
      scope: "punctuation.definition.template-expression",
      settings: { foreground: "#5E81AC" },
    },
    { scope: "storage", settings: { foreground: "#81A1C1" } },
    { scope: "storage.modifier", settings: { foreground: "#81A1C1" } },
    { scope: "storage.type", settings: { foreground: "#81A1C1" } },
    { scope: "string", settings: { foreground: "#A3BE8C" } },
    { scope: "string.regexp", settings: { foreground: "#EBCB8B" } },
    { scope: "support.class", settings: { foreground: "#8FBCBB" } },
    { scope: "support.constant", settings: { foreground: "#81A1C1" } },
    { scope: "support.function", settings: { foreground: "#88C0D0" } },
    {
      scope: "support.function.construct",
      settings: { foreground: "#81A1C1" },
    },
    { scope: "support.type", settings: { foreground: "#8FBCBB" } },
    { scope: "support.type.exception", settings: { foreground: "#8FBCBB" } },
    { scope: "token.debug-token", settings: { foreground: "#B48EAD" } },
    { scope: "token.error-token", settings: { foreground: "#BF616A" } },
    { scope: "token.info-token", settings: { foreground: "#88C0D0" } },
    { scope: "token.warn-token", settings: { foreground: "#EBCB8B" } },
    { scope: "variable.other", settings: { foreground: "#D8DEE9" } },
    { scope: "variable.language", settings: { foreground: "#81A1C1" } },
    { scope: "variable.parameter", settings: { foreground: "#D8DEE9" } },
    // Language-specific
    {
      scope: "punctuation.separator.pointer-access.c",
      settings: { foreground: "#81A1C1" },
    },
    {
      scope:
        "source.c meta.preprocessor.include, source.c string.quoted.other.lt-gt.include",
      settings: { foreground: "#8FBCBB" },
    },
    {
      scope:
        "source.cpp keyword.control.directive.conditional, source.cpp punctuation.definition.directive, source.c keyword.control.directive.conditional, source.c punctuation.definition.directive",
      settings: { foreground: "#5E81AC", fontStyle: "bold" },
    },
    {
      scope: "source.css constant.other.color.rgb-value",
      settings: { foreground: "#B48EAD" },
    },
    {
      scope: "source.css meta.property-value",
      settings: { foreground: "#88C0D0" },
    },
    {
      scope:
        "source.css keyword.control.at-rule.media, source.css keyword.control.at-rule.media punctuation.definition.keyword",
      settings: { foreground: "#D08770" },
    },
    {
      scope: "source.css punctuation.definition.keyword",
      settings: { foreground: "#81A1C1" },
    },
    {
      scope: "source.css support.type.property-name",
      settings: { foreground: "#D8DEE9" },
    },
    {
      scope: "source.go constant.other.placeholder.go",
      settings: { foreground: "#EBCB8B" },
    },
    {
      scope:
        "source.java comment.block.documentation.javadoc punctuation.definition.entity.html",
      settings: { foreground: "#81A1C1" },
    },
    {
      scope: "source.java constant.other",
      settings: { foreground: "#D8DEE9" },
    },
    {
      scope: "source.java keyword.other.documentation",
      settings: { foreground: "#8FBCBB" },
    },
    {
      scope: "source.java meta.method-call meta.method",
      settings: { foreground: "#88C0D0" },
    },
    {
      scope:
        "source.java storage.modifier.import, source.java storage.modifier.package",
      settings: { foreground: "#8FBCBB" },
    },
    { scope: "source.java storage.type", settings: { foreground: "#8FBCBB" } },
    {
      scope: "source.java storage.type.annotation",
      settings: { foreground: "#D08770" },
    },
    {
      scope:
        "source.java storage.type.generic, source.java storage.type.primitive",
      settings: { foreground: "#81A1C1" },
    },
    {
      scope:
        "source.js punctuation.decorator, source.js meta.decorator variable.other.readwrite, source.js meta.decorator entity.name.function",
      settings: { foreground: "#D08770" },
    },
    {
      scope: "source.js meta.object-literal.key",
      settings: { foreground: "#88C0D0" },
    },
    {
      scope: "source.js storage.type.class.jsdoc",
      settings: { foreground: "#8FBCBB" },
    },
    {
      scope:
        "source.js string.template punctuation.definition.template-expression",
      settings: { foreground: "#5E81AC" },
    },
    {
      scope: "source.js support.type.primitive",
      settings: { foreground: "#81A1C1" },
    },
    {
      scope: "variable.language.this.js",
      settings: { foreground: "#B48EAD", fontStyle: "italic" },
    },
    {
      scope: "meta.tag.js entity.name.tag.js support.class.component.js",
      settings: { foreground: "#81A1C1" },
    },
    {
      scope: "text.html.basic constant.character.entity.html",
      settings: { foreground: "#EBCB8B" },
    },
    {
      scope: "text.html.basic constant.other.inline-data",
      settings: { foreground: "#D08770", fontStyle: "italic" },
    },
    {
      scope: "text.html.basic meta.tag.sgml.doctype",
      settings: { foreground: "#5E81AC" },
    },
    {
      scope: "text.html.basic punctuation.definition.entity",
      settings: { foreground: "#81A1C1" },
    },
    {
      scope: "text.html.markdown markup.fenced_code.block",
      settings: { foreground: "#7B88A1" },
    },
    {
      scope:
        "text.html.markdown markup.fenced_code.block punctuation.definition",
      settings: { foreground: "#D8DEE9" },
    },
    {
      scope: "fenced_code.block.language",
      settings: { foreground: "#D8DEE9" },
    },
    { scope: "markup.heading", settings: { foreground: "#88C0D0" } },
    {
      scope:
        "text.html.markdown markup.inline.raw, text.html.markdown markup.inline.raw punctuation.definition.raw",
      settings: { foreground: "#8FBCBB" },
    },
    {
      scope: "text.html.markdown markup.italic",
      settings: { fontStyle: "italic" },
    },
    {
      scope: "text.html.markdown markup.underline.link",
      settings: { fontStyle: "underline" },
    },
    {
      scope: "text.html.markdown beginning.punctuation.definition.list",
      settings: { foreground: "#81A1C1" },
    },
    {
      scope: "text.html.markdown beginning.punctuation.definition.quote",
      settings: { foreground: "#8FBCBB" },
    },
    {
      scope: "text.html.markdown markup.quote",
      settings: { foreground: "#4C566A", fontStyle: "italic" },
    },
    {
      scope: "text.html.markdown punctuation.definition.heading",
      settings: { foreground: "#81A1C1" },
    },
    {
      scope:
        "text.html.markdown punctuation.definition.constant, text.html.markdown punctuation.definition.string",
      settings: { foreground: "#81A1C1" },
    },
    {
      scope:
        "text.html.markdown constant.other.reference.link, text.html.markdown string.other.link.description, text.html.markdown string.other.link.title",
      settings: { foreground: "#88C0D0" },
    },
    {
      scope:
        "source.php meta.function-call, source.php meta.function-call.object",
      settings: { foreground: "#88C0D0" },
    },
    {
      scope:
        "source.python entity.name.function.decorator, source.python meta.function.decorator support.type",
      settings: { foreground: "#D08770" },
    },
    {
      scope:
        "source.python meta.function-call, source.python meta.function-call.generic",
      settings: { foreground: "#88C0D0" },
    },
    {
      scope: "source.python support.type",
      settings: { foreground: "#88C0D0" },
    },
    {
      scope: "source.python variable.parameter.function.language",
      settings: { foreground: "#D8DEE9" },
    },
    {
      scope:
        "source.python meta.function.parameters variable.parameter.function.language.special.self",
      settings: { foreground: "#81A1C1" },
    },
    {
      scope:
        "source.css.scss punctuation.definition.interpolation.begin.bracket.curly, source.css.scss punctuation.definition.interpolation.end.bracket.curly",
      settings: { foreground: "#81A1C1" },
    },
    {
      scope: "source.css.scss variable.interpolation",
      settings: { foreground: "#D8DEE9", fontStyle: "italic" },
    },
    {
      scope:
        "source.ts punctuation.decorator, source.ts meta.decorator variable.other.readwrite, source.ts meta.decorator entity.name.function, source.tsx punctuation.decorator, source.tsx meta.decorator variable.other.readwrite, source.tsx meta.decorator entity.name.function",
      settings: { foreground: "#D08770" },
    },
    {
      scope:
        "source.ts meta.object-literal.key, source.tsx meta.object-literal.key",
      settings: { foreground: "#D8DEE9" },
    },
    {
      scope:
        "source.ts meta.object-literal.key entity.name.function, source.tsx meta.object-literal.key entity.name.function",
      settings: { foreground: "#88C0D0" },
    },
    {
      scope:
        "source.ts support.class, source.ts support.type, source.ts entity.name.type, source.ts entity.name.class, source.tsx support.class, source.tsx support.type, source.tsx entity.name.type, source.tsx entity.name.class",
      settings: { foreground: "#8FBCBB" },
    },
    {
      scope:
        "source.ts support.constant.math, source.ts support.constant.dom, source.ts support.constant.json, source.tsx support.constant.math, source.tsx support.constant.dom, source.tsx support.constant.json",
      settings: { foreground: "#8FBCBB" },
    },
    {
      scope: "source.ts support.variable, source.tsx support.variable",
      settings: { foreground: "#D8DEE9" },
    },
    {
      scope: "text.xml entity.name.tag.namespace",
      settings: { foreground: "#8FBCBB" },
    },
    {
      scope: "text.xml keyword.other.doctype",
      settings: { foreground: "#5E81AC" },
    },
    {
      scope: "text.xml meta.tag.preprocessor entity.name.tag",
      settings: { foreground: "#5E81AC" },
    },
    {
      scope:
        "text.xml string.unquoted.cdata, text.xml string.unquoted.cdata punctuation.definition.string",
      settings: { foreground: "#D08770", fontStyle: "italic" },
    },
    {
      scope: "source.yaml entity.name.tag",
      settings: { foreground: "#8FBCBB" },
    },
  ],
}
