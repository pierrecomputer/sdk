#!/usr/bin/env node
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import childProcess, { execFile } from "node:child_process";
import path, { delimiter, dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import fs, { createWriteStream, readFileSync, realpathSync, statSync } from "node:fs";
import process$1 from "node:process";
import { promisify, stripVTControlCharacters } from "node:util";
import { access, chmod, mkdir, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { homedir, hostname } from "node:os";
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

// \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod, mod.exports), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) {
				__defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
		}
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();

// ../../../node_modules/.pnpm/commander@15.0.0/node_modules/commander/lib/error.js
/**
* CommanderError class
*/
var CommanderError = class extends Error {
	/**
	* Constructs the CommanderError class
	* @param {number} exitCode suggested exit code which could be used with process.exit
	* @param {string} code an id string representing the error
	* @param {string} message human-readable description of the error
	*/
	constructor(exitCode, code, message) {
		super(message);
		Error.captureStackTrace(this, this.constructor);
		this.name = this.constructor.name;
		this.code = code;
		this.exitCode = exitCode;
		this.nestedError = void 0;
	}
};
/**
* InvalidArgumentError class
*/
var InvalidArgumentError = class extends CommanderError {
	/**
	* Constructs the InvalidArgumentError class
	* @param {string} [message] explanation of why argument is invalid
	*/
	constructor(message) {
		super(1, "commander.invalidArgument", message);
		Error.captureStackTrace(this, this.constructor);
		this.name = this.constructor.name;
	}
};

// ../../../node_modules/.pnpm/commander@15.0.0/node_modules/commander/lib/argument.js
var Argument = class {
	/**
	* Initialize a new command argument with the given name and description.
	* The default is that the argument is required, and you can explicitly
	* indicate this with <> around the name. Put [] around the name for an optional argument.
	*
	* @param {string} name
	* @param {string} [description]
	*/
	constructor(name, description) {
		this.description = description || "";
		this.variadic = false;
		this.parseArg = void 0;
		this.defaultValue = void 0;
		this.defaultValueDescription = void 0;
		this.argChoices = void 0;
		switch (name[0]) {
			case "<":
				this.required = true;
				this._name = name.slice(1, -1);
				break;
			case "[":
				this.required = false;
				this._name = name.slice(1, -1);
				break;
			default:
				this.required = true;
				this._name = name;
		}
		if (this._name.endsWith("...")) {
			this.variadic = true;
			this._name = this._name.slice(0, -3);
		}
	}
	/**
	* Return argument name.
	*
	* @return {string}
	*/
	name() {
		return this._name;
	}
	/**
	* @package
	*/
	_collectValue(value, previous) {
		if (previous === this.defaultValue || !Array.isArray(previous)) return [value];
		previous.push(value);
		return previous;
	}
	/**
	* Set the default value, and optionally supply the description to be displayed in the help.
	*
	* @param {*} value
	* @param {string} [description]
	* @return {Argument}
	*/
	default(value, description) {
		this.defaultValue = value;
		this.defaultValueDescription = description;
		return this;
	}
	/**
	* Set the custom handler for processing CLI command arguments into argument values.
	*
	* @param {Function} [fn]
	* @return {Argument}
	*/
	argParser(fn) {
		this.parseArg = fn;
		return this;
	}
	/**
	* Only allow argument value to be one of choices.
	*
	* @param {string[]} values
	* @return {Argument}
	*/
	choices(values) {
		this.argChoices = values.slice();
		this.parseArg = (arg, previous) => {
			if (!this.argChoices.includes(arg)) throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
			if (this.variadic) return this._collectValue(arg, previous);
			return arg;
		};
		return this;
	}
	/**
	* Make argument required.
	*
	* @returns {Argument}
	*/
	argRequired() {
		this.required = true;
		return this;
	}
	/**
	* Make argument optional.
	*
	* @returns {Argument}
	*/
	argOptional() {
		this.required = false;
		return this;
	}
};
/**
* Takes an argument and returns its human readable equivalent for help usage.
*
* @param {Argument} arg
* @return {string}
* @private
*/
function humanReadableArgName(arg) {
	const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
	return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
}

// ../../../node_modules/.pnpm/commander@15.0.0/node_modules/commander/lib/help.js
/**
* TypeScript import types for JSDoc, used by Visual Studio Code IntelliSense and `npm run typescript-checkJS`
* https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html#import-types
* @typedef { import("./argument.js").Argument } Argument
* @typedef { import("./command.js").Command } Command
* @typedef { import("./option.js").Option } Option
*/
var Help = class {
	constructor() {
		this.helpWidth = void 0;
		this.minWidthToWrap = 40;
		this.sortSubcommands = false;
		this.sortOptions = false;
		this.showGlobalOptions = false;
	}
	/**
	* prepareContext is called by Commander after applying overrides from `Command.configureHelp()`
	* and just before calling `formatHelp()`.
	*
	* Commander just uses the helpWidth and the rest is provided for optional use by more complex subclasses.
	*
	* @param {{ error?: boolean, helpWidth?: number, outputHasColors?: boolean }} contextOptions
	*/
	prepareContext(contextOptions) {
		this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
	}
	/**
	* Get an array of the visible subcommands. Includes a placeholder for the implicit help command, if there is one.
	*
	* @param {Command} cmd
	* @returns {Command[]}
	*/
	visibleCommands(cmd) {
		const visibleCommands = cmd.commands.filter((cmd) => !cmd._hidden);
		const helpCommand = cmd._getHelpCommand();
		if (helpCommand && !helpCommand._hidden) visibleCommands.push(helpCommand);
		if (this.sortSubcommands) visibleCommands.sort((a, b) => {
			return a.name().localeCompare(b.name());
		});
		return visibleCommands;
	}
	/**
	* Compare options for sort.
	*
	* @param {Option} a
	* @param {Option} b
	* @returns {number}
	*/
	compareOptions(a, b) {
		const getSortKey = (option) => {
			return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
		};
		return getSortKey(a).localeCompare(getSortKey(b));
	}
	/**
	* Get an array of the visible options. Includes a placeholder for the implicit help option, if there is one.
	*
	* @param {Command} cmd
	* @returns {Option[]}
	*/
	visibleOptions(cmd) {
		const visibleOptions = cmd.options.filter((option) => !option.hidden);
		const helpOption = cmd._getHelpOption();
		if (helpOption && !helpOption.hidden) {
			const removeShort = helpOption.short && cmd._findOption(helpOption.short);
			const removeLong = helpOption.long && cmd._findOption(helpOption.long);
			if (!removeShort && !removeLong) visibleOptions.push(helpOption);
			else if (helpOption.long && !removeLong) visibleOptions.push(cmd.createOption(helpOption.long, helpOption.description));
			else if (helpOption.short && !removeShort) visibleOptions.push(cmd.createOption(helpOption.short, helpOption.description));
		}
		if (this.sortOptions) visibleOptions.sort(this.compareOptions);
		return visibleOptions;
	}
	/**
	* Get an array of the visible global options. (Not including help.)
	*
	* @param {Command} cmd
	* @returns {Option[]}
	*/
	visibleGlobalOptions(cmd) {
		if (!this.showGlobalOptions) return [];
		const globalOptions = [];
		for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
			const visibleOptions = ancestorCmd.options.filter((option) => !option.hidden);
			globalOptions.push(...visibleOptions);
		}
		if (this.sortOptions) globalOptions.sort(this.compareOptions);
		return globalOptions;
	}
	/**
	* Get an array of the arguments if any have a description.
	*
	* @param {Command} cmd
	* @returns {Argument[]}
	*/
	visibleArguments(cmd) {
		if (cmd._argsDescription) cmd.registeredArguments.forEach((argument) => {
			argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
		});
		if (cmd.registeredArguments.find((argument) => argument.description)) return cmd.registeredArguments;
		return [];
	}
	/**
	* Get the command term to show in the list of subcommands.
	*
	* @param {Command} cmd
	* @returns {string}
	*/
	subcommandTerm(cmd) {
		const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
		return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + (args ? " " + args : "");
	}
	/**
	* Get the option term to show in the list of options.
	*
	* @param {Option} option
	* @returns {string}
	*/
	optionTerm(option) {
		return option.flags;
	}
	/**
	* Get the argument term to show in the list of arguments.
	*
	* @param {Argument} argument
	* @returns {string}
	*/
	argumentTerm(argument) {
		return argument.name();
	}
	/**
	* Get the longest command term length.
	*
	* @param {Command} cmd
	* @param {Help} helper
	* @returns {number}
	*/
	longestSubcommandTermLength(cmd, helper) {
		return helper.visibleCommands(cmd).reduce((max, command) => {
			return Math.max(max, this.displayWidth(helper.styleSubcommandTerm(helper.subcommandTerm(command))));
		}, 0);
	}
	/**
	* Get the longest option term length.
	*
	* @param {Command} cmd
	* @param {Help} helper
	* @returns {number}
	*/
	longestOptionTermLength(cmd, helper) {
		return helper.visibleOptions(cmd).reduce((max, option) => {
			return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
		}, 0);
	}
	/**
	* Get the longest global option term length.
	*
	* @param {Command} cmd
	* @param {Help} helper
	* @returns {number}
	*/
	longestGlobalOptionTermLength(cmd, helper) {
		return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
			return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
		}, 0);
	}
	/**
	* Get the longest argument term length.
	*
	* @param {Command} cmd
	* @param {Help} helper
	* @returns {number}
	*/
	longestArgumentTermLength(cmd, helper) {
		return helper.visibleArguments(cmd).reduce((max, argument) => {
			return Math.max(max, this.displayWidth(helper.styleArgumentTerm(helper.argumentTerm(argument))));
		}, 0);
	}
	/**
	* Get the command usage to be displayed at the top of the built-in help.
	*
	* @param {Command} cmd
	* @returns {string}
	*/
	commandUsage(cmd) {
		let cmdName = cmd._name;
		if (cmd._aliases[0]) cmdName = cmdName + "|" + cmd._aliases[0];
		let ancestorCmdNames = "";
		for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
		return ancestorCmdNames + cmdName + " " + cmd.usage();
	}
	/**
	* Get the description for the command.
	*
	* @param {Command} cmd
	* @returns {string}
	*/
	commandDescription(cmd) {
		return cmd.description();
	}
	/**
	* Get the subcommand summary to show in the list of subcommands.
	* (Fallback to description for backwards compatibility.)
	*
	* @param {Command} cmd
	* @returns {string}
	*/
	subcommandDescription(cmd) {
		return cmd.summary() || cmd.description();
	}
	/**
	* Get the option description to show in the list of options.
	*
	* @param {Option} option
	* @return {string}
	*/
	optionDescription(option) {
		const extraInfo = [];
		if (option.argChoices) extraInfo.push(`choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
		if (option.defaultValue !== void 0) {
			if (option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean") extraInfo.push(`default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`);
		}
		if (option.presetArg !== void 0 && option.optional) extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
		if (option.envVar !== void 0) extraInfo.push(`env: ${option.envVar}`);
		if (extraInfo.length > 0) {
			const extraDescription = `(${extraInfo.join(", ")})`;
			if (option.description) return `${option.description} ${extraDescription}`;
			return extraDescription;
		}
		return option.description;
	}
	/**
	* Get the argument description to show in the list of arguments.
	*
	* @param {Argument} argument
	* @return {string}
	*/
	argumentDescription(argument) {
		const extraInfo = [];
		if (argument.argChoices) extraInfo.push(`choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
		if (argument.defaultValue !== void 0) extraInfo.push(`default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`);
		if (extraInfo.length > 0) {
			const extraDescription = `(${extraInfo.join(", ")})`;
			if (argument.description) return `${argument.description} ${extraDescription}`;
			return extraDescription;
		}
		return argument.description;
	}
	/**
	* Format a list of items, given a heading and an array of formatted items.
	*
	* @param {string} heading
	* @param {string[]} items
	* @param {Help} helper
	* @returns string[]
	*/
	formatItemList(heading, items, helper) {
		if (items.length === 0) return [];
		return [
			helper.styleTitle(heading),
			...items,
			""
		];
	}
	/**
	* Group items by their help group heading.
	*
	* @param {Command[] | Option[]} unsortedItems
	* @param {Command[] | Option[]} visibleItems
	* @param {Function} getGroup
	* @returns {Map<string, Command[] | Option[]>}
	*/
	groupItems(unsortedItems, visibleItems, getGroup) {
		const result = /* @__PURE__ */ new Map();
		unsortedItems.forEach((item) => {
			const group = getGroup(item);
			if (!result.has(group)) result.set(group, []);
		});
		visibleItems.forEach((item) => {
			const group = getGroup(item);
			if (!result.has(group)) result.set(group, []);
			result.get(group).push(item);
		});
		return result;
	}
	/**
	* Generate the built-in help text.
	*
	* @param {Command} cmd
	* @param {Help} helper
	* @returns {string}
	*/
	formatHelp(cmd, helper) {
		const termWidth = helper.padWidth(cmd, helper);
		const helpWidth = helper.helpWidth ?? 80;
		function callFormatItem(term, description) {
			return helper.formatItem(term, termWidth, description, helper);
		}
		let output = [`${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`, ""];
		const commandDescription = helper.commandDescription(cmd);
		if (commandDescription.length > 0) output = output.concat([helper.boxWrap(helper.styleCommandDescription(commandDescription), helpWidth), ""]);
		const argumentList = helper.visibleArguments(cmd).map((argument) => {
			return callFormatItem(helper.styleArgumentTerm(helper.argumentTerm(argument)), helper.styleArgumentDescription(helper.argumentDescription(argument)));
		});
		output = output.concat(this.formatItemList("Arguments:", argumentList, helper));
		this.groupItems(cmd.options, helper.visibleOptions(cmd), (option) => option.helpGroupHeading ?? "Options:").forEach((options, group) => {
			const optionList = options.map((option) => {
				return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
			});
			output = output.concat(this.formatItemList(group, optionList, helper));
		});
		if (helper.showGlobalOptions) {
			const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
				return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
			});
			output = output.concat(this.formatItemList("Global Options:", globalOptionList, helper));
		}
		this.groupItems(cmd.commands, helper.visibleCommands(cmd), (sub) => sub.helpGroup() || "Commands:").forEach((commands, group) => {
			const commandList = commands.map((sub) => {
				return callFormatItem(helper.styleSubcommandTerm(helper.subcommandTerm(sub)), helper.styleSubcommandDescription(helper.subcommandDescription(sub)));
			});
			output = output.concat(this.formatItemList(group, commandList, helper));
		});
		return output.join("\n");
	}
	/**
	* Return display width of string, ignoring ANSI escape sequences. Used in padding and wrapping calculations.
	*
	* @param {string} str
	* @returns {number}
	*/
	displayWidth(str) {
		return stripVTControlCharacters(str).length;
	}
	/**
	* Style the title for displaying in the help. Called with 'Usage:', 'Options:', etc.
	*
	* @param {string} str
	* @returns {string}
	*/
	styleTitle(str) {
		return str;
	}
	styleUsage(str) {
		return str.split(" ").map((word) => {
			if (word === "[options]") return this.styleOptionText(word);
			if (word === "[command]") return this.styleSubcommandText(word);
			if (word[0] === "[" || word[0] === "<") return this.styleArgumentText(word);
			return this.styleCommandText(word);
		}).join(" ");
	}
	styleCommandDescription(str) {
		return this.styleDescriptionText(str);
	}
	styleOptionDescription(str) {
		return this.styleDescriptionText(str);
	}
	styleSubcommandDescription(str) {
		return this.styleDescriptionText(str);
	}
	styleArgumentDescription(str) {
		return this.styleDescriptionText(str);
	}
	styleDescriptionText(str) {
		return str;
	}
	styleOptionTerm(str) {
		return this.styleOptionText(str);
	}
	styleSubcommandTerm(str) {
		return str.split(" ").map((word) => {
			if (word === "[options]") return this.styleOptionText(word);
			if (word[0] === "[" || word[0] === "<") return this.styleArgumentText(word);
			return this.styleSubcommandText(word);
		}).join(" ");
	}
	styleArgumentTerm(str) {
		return this.styleArgumentText(str);
	}
	styleOptionText(str) {
		return str;
	}
	styleArgumentText(str) {
		return str;
	}
	styleSubcommandText(str) {
		return str;
	}
	styleCommandText(str) {
		return str;
	}
	/**
	* Calculate the pad width from the maximum term length.
	*
	* @param {Command} cmd
	* @param {Help} helper
	* @returns {number}
	*/
	padWidth(cmd, helper) {
		return Math.max(helper.longestOptionTermLength(cmd, helper), helper.longestGlobalOptionTermLength(cmd, helper), helper.longestSubcommandTermLength(cmd, helper), helper.longestArgumentTermLength(cmd, helper));
	}
	/**
	* Detect manually wrapped and indented strings by checking for line break followed by whitespace.
	*
	* @param {string} str
	* @returns {boolean}
	*/
	preformatted(str) {
		return /\n[^\S\r\n]/.test(str);
	}
	/**
	* Format the "item", which consists of a term and description. Pad the term and wrap the description, indenting the following lines.
	*
	* So "TTT", 5, "DDD DDDD DD DDD" might be formatted for this.helpWidth=17 like so:
	*   TTT  DDD DDDD
	*        DD DDD
	*
	* @param {string} term
	* @param {number} termWidth
	* @param {string} description
	* @param {Help} helper
	* @returns {string}
	*/
	formatItem(term, termWidth, description, helper) {
		const itemIndent = 2;
		const itemIndentStr = " ".repeat(itemIndent);
		if (!description) return itemIndentStr + term;
		const paddedTerm = term.padEnd(termWidth + term.length - helper.displayWidth(term));
		const spacerWidth = 2;
		const remainingWidth = (this.helpWidth ?? 80) - termWidth - spacerWidth - itemIndent;
		let formattedDescription;
		if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) formattedDescription = description;
		else formattedDescription = helper.boxWrap(description, remainingWidth).replace(/\n/g, "\n" + " ".repeat(termWidth + spacerWidth));
		return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `\n${itemIndentStr}`);
	}
	/**
	* Wrap a string at whitespace, preserving existing line breaks.
	* Wrapping is skipped if the width is less than `minWidthToWrap`.
	*
	* @param {string} str
	* @param {number} width
	* @returns {string}
	*/
	boxWrap(str, width) {
		if (width < this.minWidthToWrap) return str;
		const rawLines = str.split(/\r\n|\n/);
		const chunkPattern = /[\s]*[^\s]+/g;
		const wrappedLines = [];
		rawLines.forEach((line) => {
			const chunks = line.match(chunkPattern);
			if (chunks === null) {
				wrappedLines.push("");
				return;
			}
			let sumChunks = [chunks.shift()];
			let sumWidth = this.displayWidth(sumChunks[0]);
			chunks.forEach((chunk) => {
				const visibleWidth = this.displayWidth(chunk);
				if (sumWidth + visibleWidth <= width) {
					sumChunks.push(chunk);
					sumWidth += visibleWidth;
					return;
				}
				wrappedLines.push(sumChunks.join(""));
				const nextChunk = chunk.trimStart();
				sumChunks = [nextChunk];
				sumWidth = this.displayWidth(nextChunk);
			});
			wrappedLines.push(sumChunks.join(""));
		});
		return wrappedLines.join("\n");
	}
};

// ../../../node_modules/.pnpm/commander@15.0.0/node_modules/commander/lib/option.js
var Option = class {
	/**
	* Initialize a new `Option` with the given `flags` and `description`.
	*
	* @param {string} flags
	* @param {string} [description]
	*/
	constructor(flags, description) {
		this.flags = flags;
		this.description = description || "";
		this.required = flags.includes("<");
		this.optional = flags.includes("[");
		this.variadic = /\w\.\.\.[>\]]$/.test(flags);
		this.mandatory = false;
		const optionFlags = splitOptionFlags(flags);
		this.short = optionFlags.shortFlag;
		this.long = optionFlags.longFlag;
		this.negate = false;
		if (this.long) this.negate = this.long.startsWith("--no-");
		this.defaultValue = void 0;
		this.defaultValueDescription = void 0;
		this.presetArg = void 0;
		this.envVar = void 0;
		this.parseArg = void 0;
		this.hidden = false;
		this.argChoices = void 0;
		this.conflictsWith = [];
		this.implied = void 0;
		this.helpGroupHeading = void 0;
	}
	/**
	* Set the default value, and optionally supply the description to be displayed in the help.
	*
	* @param {*} value
	* @param {string} [description]
	* @return {Option}
	*/
	default(value, description) {
		this.defaultValue = value;
		this.defaultValueDescription = description;
		return this;
	}
	/**
	* Preset to use when option used without option-argument, especially optional but also boolean and negated.
	* The custom processing (parseArg) is called.
	*
	* @example
	* new Option('--color').default('GREYSCALE').preset('RGB');
	* new Option('--donate [amount]').preset('20').argParser(parseFloat);
	*
	* @param {*} arg
	* @return {Option}
	*/
	preset(arg) {
		this.presetArg = arg;
		return this;
	}
	/**
	* Add option name(s) that conflict with this option.
	* An error will be displayed if conflicting options are found during parsing.
	*
	* @example
	* new Option('--rgb').conflicts('cmyk');
	* new Option('--js').conflicts(['ts', 'jsx']);
	*
	* @param {(string | string[])} names
	* @return {Option}
	*/
	conflicts(names) {
		this.conflictsWith = this.conflictsWith.concat(names);
		return this;
	}
	/**
	* Specify implied option values for when this option is set and the implied options are not.
	*
	* The custom processing (parseArg) is not called on the implied values.
	*
	* @example
	* program
	*   .addOption(new Option('--log', 'write logging information to file'))
	*   .addOption(new Option('--trace', 'log extra details').implies({ log: 'trace.txt' }));
	*
	* @param {object} impliedOptionValues
	* @return {Option}
	*/
	implies(impliedOptionValues) {
		let newImplied = impliedOptionValues;
		if (typeof impliedOptionValues === "string") newImplied = { [impliedOptionValues]: true };
		this.implied = Object.assign(this.implied || {}, newImplied);
		return this;
	}
	/**
	* Set environment variable to check for option value.
	*
	* An environment variable is only used if when processed the current option value is
	* undefined, or the source of the current value is 'default' or 'config' or 'env'.
	*
	* @param {string} name
	* @return {Option}
	*/
	env(name) {
		this.envVar = name;
		return this;
	}
	/**
	* Set the custom handler for processing CLI option arguments into option values.
	*
	* @param {Function} [fn]
	* @return {Option}
	*/
	argParser(fn) {
		this.parseArg = fn;
		return this;
	}
	/**
	* Whether the option is mandatory and must have a value after parsing.
	*
	* @param {boolean} [mandatory=true]
	* @return {Option}
	*/
	makeOptionMandatory(mandatory = true) {
		this.mandatory = !!mandatory;
		return this;
	}
	/**
	* Hide option in help.
	*
	* @param {boolean} [hide=true]
	* @return {Option}
	*/
	hideHelp(hide = true) {
		this.hidden = !!hide;
		return this;
	}
	/**
	* @package
	*/
	_collectValue(value, previous) {
		if (previous === this.defaultValue || !Array.isArray(previous)) return [value];
		previous.push(value);
		return previous;
	}
	/**
	* Only allow option value to be one of choices.
	*
	* @param {string[]} values
	* @return {Option}
	*/
	choices(values) {
		this.argChoices = values.slice();
		this.parseArg = (arg, previous) => {
			if (!this.argChoices.includes(arg)) throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
			if (this.variadic) return this._collectValue(arg, previous);
			return arg;
		};
		return this;
	}
	/**
	* Return option name.
	*
	* @return {string}
	*/
	name() {
		if (this.long) return this.long.replace(/^--/, "");
		return this.short.replace(/^-/, "");
	}
	/**
	* Return option name, in a camelcase format that can be used
	* as an object attribute key.
	*
	* @return {string}
	*/
	attributeName() {
		if (this.negate) return camelcase(this.name().replace(/^no-/, ""));
		return camelcase(this.name());
	}
	/**
	* Set the help group heading.
	*
	* @param {string} heading
	* @return {Option}
	*/
	helpGroup(heading) {
		this.helpGroupHeading = heading;
		return this;
	}
	/**
	* Check if `arg` matches the short or long flag.
	*
	* @param {string} arg
	* @return {boolean}
	* @package
	*/
	is(arg) {
		return this.short === arg || this.long === arg;
	}
	/**
	* Return whether a boolean option.
	*
	* Options are one of boolean, negated, required argument, or optional argument.
	*
	* @return {boolean}
	* @package
	*/
	isBoolean() {
		return !this.required && !this.optional && !this.negate;
	}
};
/**
* This class is to make it easier to work with dual options, without changing the existing
* implementation. We support separate dual options for separate positive and negative options,
* like `--build` and `--no-build`, which share a single option value. This works nicely for some
* use cases, but is tricky for others where we want separate behaviours despite
* the single shared option value.
*/
var DualOptions = class {
	/**
	* @param {Option[]} options
	*/
	constructor(options) {
		this.positiveOptions = /* @__PURE__ */ new Map();
		this.negativeOptions = /* @__PURE__ */ new Map();
		this.dualOptions = /* @__PURE__ */ new Set();
		options.forEach((option) => {
			if (option.negate) this.negativeOptions.set(option.attributeName(), option);
			else this.positiveOptions.set(option.attributeName(), option);
		});
		this.negativeOptions.forEach((value, key) => {
			if (this.positiveOptions.has(key)) this.dualOptions.add(key);
		});
	}
	/**
	* Did the value come from the option, and not from possible matching dual option?
	*
	* @param {*} value
	* @param {Option} option
	* @returns {boolean}
	*/
	valueFromOption(value, option) {
		const optionKey = option.attributeName();
		if (!this.dualOptions.has(optionKey)) return true;
		const preset = this.negativeOptions.get(optionKey).presetArg;
		const negativeValue = preset !== void 0 ? preset : false;
		return option.negate === (negativeValue === value);
	}
};
/**
* Convert string from kebab-case to camelCase.
*
* @param {string} str
* @return {string}
* @private
*/
function camelcase(str) {
	return str.split("-").reduce((str, word) => {
		return str + word[0].toUpperCase() + word.slice(1);
	});
}
/**
* Split the short and long flag out of something like '-m,--mixed <value>'
*
* @private
*/
function splitOptionFlags(flags) {
	let shortFlag;
	let longFlag;
	const shortFlagExp = /^-[^-]$/;
	const longFlagExp = /^--[^-]/;
	const flagParts = flags.split(/[ |,]+/).concat("guard");
	if (shortFlagExp.test(flagParts[0])) shortFlag = flagParts.shift();
	if (longFlagExp.test(flagParts[0])) longFlag = flagParts.shift();
	if (!shortFlag && shortFlagExp.test(flagParts[0])) shortFlag = flagParts.shift();
	if (!shortFlag && longFlagExp.test(flagParts[0])) {
		shortFlag = longFlag;
		longFlag = flagParts.shift();
	}
	if (flagParts[0].startsWith("-")) {
		const unsupportedFlag = flagParts[0];
		const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
		if (/^-[^-][^-]/.test(unsupportedFlag)) throw new Error(`${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`);
		if (shortFlagExp.test(unsupportedFlag)) throw new Error(`${baseError}
- too many short flags`);
		if (longFlagExp.test(unsupportedFlag)) throw new Error(`${baseError}
- too many long flags`);
		throw new Error(`${baseError}
- unrecognised flag format`);
	}
	if (shortFlag === void 0 && longFlag === void 0) throw new Error(`option creation failed due to no flags found in '${flags}'.`);
	return {
		shortFlag,
		longFlag
	};
}

// ../../../node_modules/.pnpm/commander@15.0.0/node_modules/commander/lib/suggestSimilar.js
const maxDistance = 3;
function editDistance(a, b) {
	if (Math.abs(a.length - b.length) > maxDistance) return Math.max(a.length, b.length);
	const d = [];
	for (let i = 0; i <= a.length; i++) d[i] = [i];
	for (let j = 0; j <= b.length; j++) d[0][j] = j;
	for (let j = 1; j <= b.length; j++) for (let i = 1; i <= a.length; i++) {
		let cost;
		if (a[i - 1] === b[j - 1]) cost = 0;
		else cost = 1;
		d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
		if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
	}
	return d[a.length][b.length];
}
/**
* Find close matches, restricted to same number of edits.
*
* @param {string} word
* @param {string[]} candidates
* @returns {string}
*/
function suggestSimilar(word, candidates) {
	if (!candidates || candidates.length === 0) return "";
	candidates = Array.from(new Set(candidates));
	const searchingOptions = word.startsWith("--");
	if (searchingOptions) {
		word = word.slice(2);
		candidates = candidates.map((candidate) => candidate.slice(2));
	}
	let similar = [];
	let bestDistance = maxDistance;
	const minSimilarity = .4;
	candidates.forEach((candidate) => {
		if (candidate.length <= 1) return;
		const distance = editDistance(word, candidate);
		const length = Math.max(word.length, candidate.length);
		if ((length - distance) / length > minSimilarity) {
			if (distance < bestDistance) {
				bestDistance = distance;
				similar = [candidate];
			} else if (distance === bestDistance) similar.push(candidate);
		}
	});
	similar.sort((a, b) => a.localeCompare(b));
	if (searchingOptions) similar = similar.map((candidate) => `--${candidate}`);
	if (similar.length > 1) return `\n(Did you mean one of ${similar.join(", ")}?)`;
	if (similar.length === 1) return `\n(Did you mean ${similar[0]}?)`;
	return "";
}

// ../../../node_modules/.pnpm/commander@15.0.0/node_modules/commander/lib/command.js
var Command = class Command extends EventEmitter {
	/**
	* Initialize a new `Command`.
	*
	* @param {string} [name]
	*/
	constructor(name) {
		super();
		/** @type {Command[]} */
		this.commands = [];
		/** @type {Option[]} */
		this.options = [];
		this.parent = null;
		this._allowUnknownOption = false;
		this._allowExcessArguments = false;
		/** @type {Argument[]} */
		this.registeredArguments = [];
		this._args = this.registeredArguments;
		/** @type {string[]} */
		this.args = [];
		this.rawArgs = [];
		this.processedArgs = [];
		this._scriptPath = null;
		this._name = name || "";
		this._optionValues = {};
		this._optionValueSources = {};
		this._storeOptionsAsProperties = false;
		this._actionHandler = null;
		this._executableHandler = false;
		this._executableFile = null;
		this._executableDir = null;
		this._defaultCommandName = null;
		this._exitCallback = null;
		this._aliases = [];
		this._combineFlagAndOptionalValue = true;
		this._description = "";
		this._summary = "";
		this._argsDescription = void 0;
		this._enablePositionalOptions = false;
		this._passThroughOptions = false;
		this._lifeCycleHooks = {};
		/** @type {(boolean | string)} */
		this._showHelpAfterError = false;
		this._showSuggestionAfterError = true;
		this._savedState = null;
		this._outputConfiguration = {
			writeOut: (str) => process$1.stdout.write(str),
			writeErr: (str) => process$1.stderr.write(str),
			outputError: (str, write) => write(str),
			getOutHelpWidth: () => process$1.stdout.isTTY ? process$1.stdout.columns : void 0,
			getErrHelpWidth: () => process$1.stderr.isTTY ? process$1.stderr.columns : void 0,
			getOutHasColors: () => useColor() ?? (process$1.stdout.isTTY && process$1.stdout.hasColors?.()),
			getErrHasColors: () => useColor() ?? (process$1.stderr.isTTY && process$1.stderr.hasColors?.()),
			stripColor: (str) => stripVTControlCharacters(str)
		};
		this._hidden = false;
		/** @type {(Option | null | undefined)} */
		this._helpOption = void 0;
		this._addImplicitHelpCommand = void 0;
		/** @type {Command} */
		this._helpCommand = void 0;
		this._helpConfiguration = {};
		/** @type {string | undefined} */
		this._helpGroupHeading = void 0;
		/** @type {string | undefined} */
		this._defaultCommandGroup = void 0;
		/** @type {string | undefined} */
		this._defaultOptionGroup = void 0;
	}
	/**
	* Copy settings that are useful to have in common across root command and subcommands.
	*
	* (Used internally when adding a command using `.command()` so subcommands inherit parent settings.)
	*
	* @param {Command} sourceCommand
	* @return {Command} `this` command for chaining
	*/
	copyInheritedSettings(sourceCommand) {
		this._outputConfiguration = sourceCommand._outputConfiguration;
		this._helpOption = sourceCommand._helpOption;
		this._helpCommand = sourceCommand._helpCommand;
		this._helpConfiguration = sourceCommand._helpConfiguration;
		this._exitCallback = sourceCommand._exitCallback;
		this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
		this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
		this._allowExcessArguments = sourceCommand._allowExcessArguments;
		this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
		this._showHelpAfterError = sourceCommand._showHelpAfterError;
		this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
		return this;
	}
	/**
	* @returns {Command[]}
	* @private
	*/
	_getCommandAndAncestors() {
		const result = [];
		for (let command = this; command; command = command.parent) result.push(command);
		return result;
	}
	/**
	* Define a command.
	*
	* There are two styles of command: pay attention to where to put the description.
	*
	* @example
	* // Command implemented using action handler (description is supplied separately to `.command`)
	* program
	*   .command('clone <source> [destination]')
	*   .description('clone a repository into a newly created directory')
	*   .action((source, destination) => {
	*     console.log('clone command called');
	*   });
	*
	* // Command implemented using separate executable file (description is second parameter to `.command`)
	* program
	*   .command('start <service>', 'start named service')
	*   .command('stop [service]', 'stop named service, or all if no name supplied');
	*
	* @param {string} nameAndArgs - command name and arguments, args are `<required>` or `[optional]` and last may also be `variadic...`
	* @param {(object | string)} [actionOptsOrExecDesc] - configuration options (for action), or description (for executable)
	* @param {object} [execOpts] - configuration options (for executable)
	* @return {Command} returns new command for action handler, or `this` for executable command
	*/
	command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
		let desc = actionOptsOrExecDesc;
		let opts = execOpts;
		if (typeof desc === "object" && desc !== null) {
			opts = desc;
			desc = null;
		}
		opts = opts || {};
		const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
		const cmd = this.createCommand(name);
		if (desc) {
			cmd.description(desc);
			cmd._executableHandler = true;
		}
		if (opts.isDefault) this._defaultCommandName = cmd._name;
		cmd._hidden = !!(opts.noHelp || opts.hidden);
		cmd._executableFile = opts.executableFile || null;
		if (args) cmd.arguments(args);
		this._registerCommand(cmd);
		cmd.parent = this;
		cmd.copyInheritedSettings(this);
		if (desc) return this;
		return cmd;
	}
	/**
	* Factory routine to create a new unattached command.
	*
	* See .command() for creating an attached subcommand, which uses this routine to
	* create the command. You can override createCommand to customise subcommands.
	*
	* @param {string} [name]
	* @return {Command} new command
	*/
	createCommand(name) {
		return new Command(name);
	}
	/**
	* You can customise the help with a subclass of Help by overriding createHelp,
	* or by overriding Help properties using configureHelp().
	*
	* @return {Help}
	*/
	createHelp() {
		return Object.assign(new Help(), this.configureHelp());
	}
	/**
	* You can customise the help by overriding Help properties using configureHelp(),
	* or with a subclass of Help by overriding createHelp().
	*
	* @param {object} [configuration] - configuration options
	* @return {(Command | object)} `this` command for chaining, or stored configuration
	*/
	configureHelp(configuration) {
		if (configuration === void 0) return this._helpConfiguration;
		this._helpConfiguration = configuration;
		return this;
	}
	/**
	* The default output goes to stdout and stderr. You can customise this for special
	* applications. You can also customise the display of errors by overriding outputError.
	*
	* The configuration properties are all functions:
	*
	*     // change how output being written, defaults to stdout and stderr
	*     writeOut(str)
	*     writeErr(str)
	*     // change how output being written for errors, defaults to writeErr
	*     outputError(str, write) // used for displaying errors and not used for displaying help
	*     // specify width for wrapping help
	*     getOutHelpWidth()
	*     getErrHelpWidth()
	*     // color support, currently only used with Help
	*     getOutHasColors()
	*     getErrHasColors()
	*     stripColor() // used to remove ANSI escape codes if output does not have colors
	*
	* @param {object} [configuration] - configuration options
	* @return {(Command | object)} `this` command for chaining, or stored configuration
	*/
	configureOutput(configuration) {
		if (configuration === void 0) return this._outputConfiguration;
		this._outputConfiguration = {
			...this._outputConfiguration,
			...configuration
		};
		return this;
	}
	/**
	* Display the help or a custom message after an error occurs.
	*
	* @param {(boolean|string)} [displayHelp]
	* @return {Command} `this` command for chaining
	*/
	showHelpAfterError(displayHelp = true) {
		if (typeof displayHelp !== "string") displayHelp = !!displayHelp;
		this._showHelpAfterError = displayHelp;
		return this;
	}
	/**
	* Display suggestion of similar commands for unknown commands, or options for unknown options.
	*
	* @param {boolean} [displaySuggestion]
	* @return {Command} `this` command for chaining
	*/
	showSuggestionAfterError(displaySuggestion = true) {
		this._showSuggestionAfterError = !!displaySuggestion;
		return this;
	}
	/**
	* Add a prepared subcommand.
	*
	* See .command() for creating an attached subcommand which inherits settings from its parent.
	*
	* @param {Command} cmd - new subcommand
	* @param {object} [opts] - configuration options
	* @return {Command} `this` command for chaining
	*/
	addCommand(cmd, opts) {
		if (!cmd._name) throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
		opts = opts || {};
		if (opts.isDefault) this._defaultCommandName = cmd._name;
		if (opts.noHelp || opts.hidden) cmd._hidden = true;
		this._registerCommand(cmd);
		cmd.parent = this;
		cmd._checkForBrokenPassThrough();
		return this;
	}
	/**
	* Factory routine to create a new unattached argument.
	*
	* See .argument() for creating an attached argument, which uses this routine to
	* create the argument. You can override createArgument to return a custom argument.
	*
	* @param {string} name
	* @param {string} [description]
	* @return {Argument} new argument
	*/
	createArgument(name, description) {
		return new Argument(name, description);
	}
	/**
	* Define argument syntax for command.
	*
	* The default is that the argument is required, and you can explicitly
	* indicate this with <> around the name. Put [] around the name for an optional argument.
	*
	* @example
	* program.argument('<input-file>');
	* program.argument('[output-file]');
	*
	* @param {string} name
	* @param {string} [description]
	* @param {(Function|*)} [parseArg] - custom argument processing function or default value
	* @param {*} [defaultValue]
	* @return {Command} `this` command for chaining
	*/
	argument(name, description, parseArg, defaultValue) {
		const argument = this.createArgument(name, description);
		if (typeof parseArg === "function") argument.default(defaultValue).argParser(parseArg);
		else argument.default(parseArg);
		this.addArgument(argument);
		return this;
	}
	/**
	* Define argument syntax for command, adding multiple at once (without descriptions).
	*
	* See also .argument().
	*
	* @example
	* program.arguments('<cmd> [env]');
	*
	* @param {string} names
	* @return {Command} `this` command for chaining
	*/
	arguments(names) {
		names.trim().split(/ +/).forEach((detail) => {
			this.argument(detail);
		});
		return this;
	}
	/**
	* Define argument syntax for command, adding a prepared argument.
	*
	* @param {Argument} argument
	* @return {Command} `this` command for chaining
	*/
	addArgument(argument) {
		const previousArgument = this.registeredArguments.slice(-1)[0];
		if (previousArgument?.variadic) throw new Error(`only the last argument can be variadic '${previousArgument.name()}'`);
		if (argument.required && argument.defaultValue !== void 0 && argument.parseArg === void 0) throw new Error(`a default value for a required argument is never used: '${argument.name()}'`);
		this.registeredArguments.push(argument);
		return this;
	}
	/**
	* Customise or override default help command. By default a help command is automatically added if your command has subcommands.
	*
	* @example
	*    program.helpCommand('help [cmd]');
	*    program.helpCommand('help [cmd]', 'show help');
	*    program.helpCommand(false); // suppress default help command
	*    program.helpCommand(true); // add help command even if no subcommands
	*
	* @param {string|boolean} enableOrNameAndArgs - enable with custom name and/or arguments, or boolean to override whether added
	* @param {string} [description] - custom description
	* @return {Command} `this` command for chaining
	*/
	helpCommand(enableOrNameAndArgs, description) {
		if (typeof enableOrNameAndArgs === "boolean") {
			this._addImplicitHelpCommand = enableOrNameAndArgs;
			if (enableOrNameAndArgs && this._defaultCommandGroup) this._initCommandGroup(this._getHelpCommand());
			return this;
		}
		const [, helpName, helpArgs] = (enableOrNameAndArgs ?? "help [command]").match(/([^ ]+) *(.*)/);
		const helpDescription = description ?? "display help for command";
		const helpCommand = this.createCommand(helpName);
		helpCommand.helpOption(false);
		if (helpArgs) helpCommand.arguments(helpArgs);
		if (helpDescription) helpCommand.description(helpDescription);
		this._addImplicitHelpCommand = true;
		this._helpCommand = helpCommand;
		if (enableOrNameAndArgs || description) this._initCommandGroup(helpCommand);
		return this;
	}
	/**
	* Add prepared custom help command.
	*
	* @param {(Command|string|boolean)} helpCommand - custom help command, or deprecated enableOrNameAndArgs as for `.helpCommand()`
	* @param {string} [deprecatedDescription] - deprecated custom description used with custom name only
	* @return {Command} `this` command for chaining
	*/
	addHelpCommand(helpCommand, deprecatedDescription) {
		if (typeof helpCommand !== "object") {
			this.helpCommand(helpCommand, deprecatedDescription);
			return this;
		}
		this._addImplicitHelpCommand = true;
		this._helpCommand = helpCommand;
		this._initCommandGroup(helpCommand);
		return this;
	}
	/**
	* Lazy create help command.
	*
	* @return {(Command|null)}
	* @package
	*/
	_getHelpCommand() {
		if (this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"))) {
			if (this._helpCommand === void 0) this.helpCommand(void 0, void 0);
			return this._helpCommand;
		}
		return null;
	}
	/**
	* Add hook for life cycle event.
	*
	* @param {string} event
	* @param {Function} listener
	* @return {Command} `this` command for chaining
	*/
	hook(event, listener) {
		const allowedValues = [
			"preSubcommand",
			"preAction",
			"postAction"
		];
		if (!allowedValues.includes(event)) throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
		if (this._lifeCycleHooks[event]) this._lifeCycleHooks[event].push(listener);
		else this._lifeCycleHooks[event] = [listener];
		return this;
	}
	/**
	* Register callback to use as replacement for calling process.exit.
	*
	* @param {Function} [fn] optional callback which will be passed a CommanderError, defaults to throwing
	* @return {Command} `this` command for chaining
	*/
	exitOverride(fn) {
		if (fn) this._exitCallback = fn;
		else this._exitCallback = (err) => {
			if (err.code !== "commander.executeSubCommandAsync") throw err;
		};
		return this;
	}
	/**
	* Call process.exit, and _exitCallback if defined.
	*
	* @param {number} exitCode exit code for using with process.exit
	* @param {string} code an id string representing the error
	* @param {string} message human-readable description of the error
	* @return never
	* @private
	*/
	_exit(exitCode, code, message) {
		if (this._exitCallback) this._exitCallback(new CommanderError(exitCode, code, message));
		process$1.exit(exitCode);
	}
	/**
	* Register callback `fn` for the command.
	*
	* @example
	* program
	*   .command('serve')
	*   .description('start service')
	*   .action(function() {
	*      // do work here
	*   });
	*
	* @param {Function} fn
	* @return {Command} `this` command for chaining
	*/
	action(fn) {
		const listener = (args) => {
			const expectedArgsCount = this.registeredArguments.length;
			const actionArgs = args.slice(0, expectedArgsCount);
			if (this._storeOptionsAsProperties) actionArgs[expectedArgsCount] = this;
			else actionArgs[expectedArgsCount] = this.opts();
			actionArgs.push(this);
			return fn.apply(this, actionArgs);
		};
		this._actionHandler = listener;
		return this;
	}
	/**
	* Factory routine to create a new unattached option.
	*
	* See .option() for creating an attached option, which uses this routine to
	* create the option. You can override createOption to return a custom option.
	*
	* @param {string} flags
	* @param {string} [description]
	* @return {Option} new option
	*/
	createOption(flags, description) {
		return new Option(flags, description);
	}
	/**
	* Wrap parseArgs to catch 'commander.invalidArgument'.
	*
	* @param {(Option | Argument)} target
	* @param {string} value
	* @param {*} previous
	* @param {string} invalidArgumentMessage
	* @private
	*/
	_callParseArg(target, value, previous, invalidArgumentMessage) {
		try {
			return target.parseArg(value, previous);
		} catch (err) {
			if (err.code === "commander.invalidArgument") {
				const message = `${invalidArgumentMessage} ${err.message}`;
				this.error(message, {
					exitCode: err.exitCode,
					code: err.code
				});
			}
			throw err;
		}
	}
	/**
	* Check for option flag conflicts.
	* Register option if no conflicts found, or throw on conflict.
	*
	* @param {Option} option
	* @private
	*/
	_registerOption(option) {
		const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
		if (matchingOption) {
			const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
			throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
		}
		this._initOptionGroup(option);
		this.options.push(option);
	}
	/**
	* Check for command name and alias conflicts with existing commands.
	* Register command if no conflicts found, or throw on conflict.
	*
	* @param {Command} command
	* @private
	*/
	_registerCommand(command) {
		const knownBy = (cmd) => {
			return [cmd.name()].concat(cmd.aliases());
		};
		const alreadyUsed = knownBy(command).find((name) => this._findCommand(name));
		if (alreadyUsed) {
			const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
			const newCmd = knownBy(command).join("|");
			throw new Error(`cannot add command '${newCmd}' as already have command '${existingCmd}'`);
		}
		this._initCommandGroup(command);
		this.commands.push(command);
	}
	/**
	* Add an option.
	*
	* @param {Option} option
	* @return {Command} `this` command for chaining
	*/
	addOption(option) {
		this._registerOption(option);
		const oname = option.name();
		const name = option.attributeName();
		if (option.defaultValue !== void 0) this.setOptionValueWithSource(name, option.defaultValue, "default");
		const handleOptionValue = (val, invalidValueMessage, valueSource) => {
			if (val == null && option.presetArg !== void 0) val = option.presetArg;
			const oldValue = this.getOptionValue(name);
			if (val !== null && option.parseArg) val = this._callParseArg(option, val, oldValue, invalidValueMessage);
			else if (val !== null && option.variadic) val = option._collectValue(val, oldValue);
			if (val == null) {
				if (option.negate) val = false;
				else if (option.isBoolean() || option.optional) val = true;
				else val = "";
			}
			this.setOptionValueWithSource(name, val, valueSource);
		};
		this.on("option:" + oname, (val) => {
			const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
			handleOptionValue(val, invalidValueMessage, "cli");
		});
		if (option.envVar) this.on("optionEnv:" + oname, (val) => {
			const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
			handleOptionValue(val, invalidValueMessage, "env");
		});
		return this;
	}
	/**
	* Internal implementation shared by .option() and .requiredOption()
	*
	* @return {Command} `this` command for chaining
	* @private
	*/
	_optionEx(config, flags, description, fn, defaultValue) {
		if (typeof flags === "object" && flags instanceof Option) throw new Error("To add an Option object use addOption() instead of option() or requiredOption()");
		const option = this.createOption(flags, description);
		option.makeOptionMandatory(!!config.mandatory);
		if (typeof fn === "function") option.default(defaultValue).argParser(fn);
		else if (fn instanceof RegExp) {
			const regex = fn;
			fn = (val, def) => {
				const m = regex.exec(val);
				return m ? m[0] : def;
			};
			option.default(defaultValue).argParser(fn);
		} else option.default(fn);
		return this.addOption(option);
	}
	/**
	* Define option with `flags`, `description`, and optional argument parsing function or `defaultValue` or both.
	*
	* The `flags` string contains the short and/or long flags, separated by comma, a pipe or space. A required
	* option-argument is indicated by `<>` and an optional option-argument by `[]`.
	*
	* See the README for more details, and see also addOption() and requiredOption().
	*
	* @example
	* program
	*     .option('-p, --pepper', 'add pepper')
	*     .option('--pt, --pizza-type <TYPE>', 'type of pizza') // required option-argument
	*     .option('-c, --cheese [CHEESE]', 'add extra cheese', 'mozzarella') // optional option-argument with default
	*     .option('-t, --tip <VALUE>', 'add tip to purchase cost', parseFloat) // custom parse function
	*
	* @param {string} flags
	* @param {string} [description]
	* @param {(Function|*)} [parseArg] - custom option processing function or default value
	* @param {*} [defaultValue]
	* @return {Command} `this` command for chaining
	*/
	option(flags, description, parseArg, defaultValue) {
		return this._optionEx({}, flags, description, parseArg, defaultValue);
	}
	/**
	* Add a required option which must have a value after parsing. This usually means
	* the option must be specified on the command line. (Otherwise the same as .option().)
	*
	* The `flags` string contains the short and/or long flags, separated by comma, a pipe or space.
	*
	* @param {string} flags
	* @param {string} [description]
	* @param {(Function|*)} [parseArg] - custom option processing function or default value
	* @param {*} [defaultValue]
	* @return {Command} `this` command for chaining
	*/
	requiredOption(flags, description, parseArg, defaultValue) {
		return this._optionEx({ mandatory: true }, flags, description, parseArg, defaultValue);
	}
	/**
	* Alter parsing of short flags with optional values.
	*
	* @example
	* // for `.option('-f,--flag [value]'):
	* program.combineFlagAndOptionalValue(true);  // `-f80` is treated like `--flag=80`, this is the default behaviour
	* program.combineFlagAndOptionalValue(false) // `-fb` is treated like `-f -b`
	*
	* @param {boolean} [combine] - if `true` or omitted, an optional value can be specified directly after the flag.
	* @return {Command} `this` command for chaining
	*/
	combineFlagAndOptionalValue(combine = true) {
		this._combineFlagAndOptionalValue = !!combine;
		return this;
	}
	/**
	* Allow unknown options on the command line.
	*
	* @param {boolean} [allowUnknown] - if `true` or omitted, no error will be thrown for unknown options.
	* @return {Command} `this` command for chaining
	*/
	allowUnknownOption(allowUnknown = true) {
		this._allowUnknownOption = !!allowUnknown;
		return this;
	}
	/**
	* Allow excess command-arguments on the command line. Pass false to make excess arguments an error.
	*
	* @param {boolean} [allowExcess] - if `true` or omitted, no error will be thrown for excess arguments.
	* @return {Command} `this` command for chaining
	*/
	allowExcessArguments(allowExcess = true) {
		this._allowExcessArguments = !!allowExcess;
		return this;
	}
	/**
	* Enable positional options. Positional means global options are specified before subcommands which lets
	* subcommands reuse the same option names, and also enables subcommands to turn on passThroughOptions.
	* The default behaviour is non-positional and global options may appear anywhere on the command line.
	*
	* @param {boolean} [positional]
	* @return {Command} `this` command for chaining
	*/
	enablePositionalOptions(positional = true) {
		this._enablePositionalOptions = !!positional;
		return this;
	}
	/**
	* Pass through options that come after command-arguments rather than treat them as command-options,
	* so actual command-options come before command-arguments. Turning this on for a subcommand requires
	* positional options to have been enabled on the program (parent commands).
	* The default behaviour is non-positional and options may appear before or after command-arguments.
	*
	* @param {boolean} [passThrough] for unknown options.
	* @return {Command} `this` command for chaining
	*/
	passThroughOptions(passThrough = true) {
		this._passThroughOptions = !!passThrough;
		this._checkForBrokenPassThrough();
		return this;
	}
	/**
	* @private
	*/
	_checkForBrokenPassThrough() {
		if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) throw new Error(`passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`);
	}
	/**
	* Whether to store option values as properties on command object,
	* or store separately (specify false). In both cases the option values can be accessed using .opts().
	*
	* @param {boolean} [storeAsProperties=true]
	* @return {Command} `this` command for chaining
	*/
	storeOptionsAsProperties(storeAsProperties = true) {
		if (this.options.length) throw new Error("call .storeOptionsAsProperties() before adding options");
		if (Object.keys(this._optionValues).length) throw new Error("call .storeOptionsAsProperties() before setting option values");
		this._storeOptionsAsProperties = !!storeAsProperties;
		return this;
	}
	/**
	* Retrieve option value.
	*
	* @param {string} key
	* @return {object} value
	*/
	getOptionValue(key) {
		if (this._storeOptionsAsProperties) return this[key];
		return this._optionValues[key];
	}
	/**
	* Store option value.
	*
	* @param {string} key
	* @param {object} value
	* @return {Command} `this` command for chaining
	*/
	setOptionValue(key, value) {
		return this.setOptionValueWithSource(key, value, void 0);
	}
	/**
	* Store option value and where the value came from.
	*
	* @param {string} key
	* @param {object} value
	* @param {string} source - expected values are default/config/env/cli/implied
	* @return {Command} `this` command for chaining
	*/
	setOptionValueWithSource(key, value, source) {
		if (this._storeOptionsAsProperties) this[key] = value;
		else this._optionValues[key] = value;
		this._optionValueSources[key] = source;
		return this;
	}
	/**
	* Get source of option value.
	* Expected values are default | config | env | cli | implied
	*
	* @param {string} key
	* @return {string}
	*/
	getOptionValueSource(key) {
		return this._optionValueSources[key];
	}
	/**
	* Get source of option value. See also .optsWithGlobals().
	* Expected values are default | config | env | cli | implied
	*
	* @param {string} key
	* @return {string}
	*/
	getOptionValueSourceWithGlobals(key) {
		let source;
		this._getCommandAndAncestors().forEach((cmd) => {
			if (cmd.getOptionValueSource(key) !== void 0) source = cmd.getOptionValueSource(key);
		});
		return source;
	}
	/**
	* Get user arguments from implied or explicit arguments.
	* Side-effects: set _scriptPath if args included script. Used for default program name, and subcommand searches.
	*
	* @private
	*/
	_prepareUserArgs(argv, parseOptions) {
		if (argv !== void 0 && !Array.isArray(argv)) throw new Error("first parameter to parse must be array or undefined");
		parseOptions = parseOptions || {};
		if (argv === void 0 && parseOptions.from === void 0) {
			if (process$1.versions?.electron) parseOptions.from = "electron";
			const execArgv = process$1.execArgv ?? [];
			if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) parseOptions.from = "eval";
		}
		if (argv === void 0) argv = process$1.argv;
		this.rawArgs = argv.slice();
		let userArgs;
		switch (parseOptions.from) {
			case void 0:
			case "node":
				this._scriptPath = argv[1];
				userArgs = argv.slice(2);
				break;
			case "electron":
				if (process$1.defaultApp) {
					this._scriptPath = argv[1];
					userArgs = argv.slice(2);
				} else userArgs = argv.slice(1);
				break;
			case "user":
				userArgs = argv.slice(0);
				break;
			case "eval":
				userArgs = argv.slice(1);
				break;
			default: throw new Error(`unexpected parse option { from: '${parseOptions.from}' }`);
		}
		if (!this._name && this._scriptPath) this.nameFromFilename(this._scriptPath);
		this._name = this._name || "program";
		return userArgs;
	}
	/**
	* Parse `argv`, setting options and invoking commands when defined.
	*
	* Use parseAsync instead of parse if any of your action handlers are async.
	*
	* Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
	*
	* Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
	* - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
	* - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
	* - `'user'`: just user arguments
	*
	* @example
	* program.parse(); // parse process.argv and auto-detect electron and special node flags
	* program.parse(process.argv); // assume argv[0] is app and argv[1] is script
	* program.parse(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
	*
	* @param {string[]} [argv] - optional, defaults to process.argv
	* @param {object} [parseOptions] - optionally specify style of options with from: node/user/electron
	* @param {string} [parseOptions.from] - where the args are from: 'node', 'user', 'electron'
	* @return {Command} `this` command for chaining
	*/
	parse(argv, parseOptions) {
		this._prepareForParse();
		const userArgs = this._prepareUserArgs(argv, parseOptions);
		this._parseCommand([], userArgs);
		return this;
	}
	/**
	* Parse `argv`, setting options and invoking commands when defined.
	*
	* Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
	*
	* Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
	* - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
	* - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
	* - `'user'`: just user arguments
	*
	* @example
	* await program.parseAsync(); // parse process.argv and auto-detect electron and special node flags
	* await program.parseAsync(process.argv); // assume argv[0] is app and argv[1] is script
	* await program.parseAsync(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
	*
	* @param {string[]} [argv]
	* @param {object} [parseOptions]
	* @param {string} parseOptions.from - where the args are from: 'node', 'user', 'electron'
	* @return {Promise}
	*/
	async parseAsync(argv, parseOptions) {
		this._prepareForParse();
		const userArgs = this._prepareUserArgs(argv, parseOptions);
		await this._parseCommand([], userArgs);
		return this;
	}
	_prepareForParse() {
		if (this._savedState === null) {
			this.options.filter((option) => option.negate && option.defaultValue === void 0 && this.getOptionValue(option.attributeName()) === void 0).forEach((option) => {
				const positiveLongFlag = option.long.replace(/^--no-/, "--");
				if (!this._findOption(positiveLongFlag)) this.setOptionValueWithSource(option.attributeName(), true, "default");
			});
			this.saveStateBeforeParse();
		} else this.restoreStateBeforeParse();
	}
	/**
	* Called the first time parse is called to save state and allow a restore before subsequent calls to parse.
	* Not usually called directly, but available for subclasses to save their custom state.
	*
	* This is called in a lazy way. Only commands used in parsing chain will have state saved.
	*/
	saveStateBeforeParse() {
		this._savedState = {
			_name: this._name,
			_optionValues: { ...this._optionValues },
			_optionValueSources: { ...this._optionValueSources }
		};
	}
	/**
	* Restore state before parse for calls after the first.
	* Not usually called directly, but available for subclasses to save their custom state.
	*
	* This is called in a lazy way. Only commands used in parsing chain will have state restored.
	*/
	restoreStateBeforeParse() {
		if (this._storeOptionsAsProperties) throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
		this._name = this._savedState._name;
		this._scriptPath = null;
		this.rawArgs = [];
		this._optionValues = { ...this._savedState._optionValues };
		this._optionValueSources = { ...this._savedState._optionValueSources };
		this.args = [];
		this.processedArgs = [];
	}
	/**
	* Throw if expected executable is missing. Add lots of help for author.
	*
	* @param {string} executableFile
	* @param {string} executableDir
	* @param {string} subcommandName
	*/
	_checkForMissingExecutable(executableFile, executableDir, subcommandName) {
		if (fs.existsSync(executableFile)) return;
		const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory"}`;
		throw new Error(executableMissing);
	}
	/**
	* Execute a sub-command executable.
	*
	* @private
	*/
	_executeSubCommand(subcommand, args) {
		args = args.slice();
		const sourceExt = [
			".js",
			".ts",
			".tsx",
			".mjs",
			".cjs"
		];
		function findFile(baseDir, baseName) {
			const localBin = path.resolve(baseDir, baseName);
			if (fs.existsSync(localBin)) return localBin;
			if (sourceExt.includes(path.extname(baseName))) return void 0;
			const foundExt = sourceExt.find((ext) => fs.existsSync(`${localBin}${ext}`));
			if (foundExt) return `${localBin}${foundExt}`;
		}
		this._checkForMissingMandatoryOptions();
		this._checkForConflictingOptions();
		let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
		let executableDir = this._executableDir || "";
		if (this._scriptPath) {
			let resolvedScriptPath;
			try {
				resolvedScriptPath = fs.realpathSync(this._scriptPath);
			} catch {
				resolvedScriptPath = this._scriptPath;
			}
			executableDir = path.resolve(path.dirname(resolvedScriptPath), executableDir);
		}
		if (executableDir) {
			let localFile = findFile(executableDir, executableFile);
			if (!localFile && !subcommand._executableFile && this._scriptPath) {
				const legacyName = path.basename(this._scriptPath, path.extname(this._scriptPath));
				if (legacyName !== this._name) localFile = findFile(executableDir, `${legacyName}-${subcommand._name}`);
			}
			executableFile = localFile || executableFile;
		}
		const launchWithNode = sourceExt.includes(path.extname(executableFile));
		let proc;
		if (process$1.platform !== "win32") {
			if (launchWithNode) {
				args.unshift(executableFile);
				args = incrementNodeInspectorPort(process$1.execArgv).concat(args);
				proc = childProcess.spawn(process$1.argv[0], args, { stdio: "inherit" });
			} else proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
		} else {
			this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
			args.unshift(executableFile);
			args = incrementNodeInspectorPort(process$1.execArgv).concat(args);
			proc = childProcess.spawn(process$1.execPath, args, { stdio: "inherit" });
		}
		if (!proc.killed) [
			"SIGUSR1",
			"SIGUSR2",
			"SIGTERM",
			"SIGINT",
			"SIGHUP"
		].forEach((signal) => {
			process$1.on(signal, () => {
				if (proc.killed === false && proc.exitCode === null) proc.kill(signal);
			});
		});
		const exitCallback = this._exitCallback;
		proc.on("close", (code) => {
			code = code ?? 1;
			if (!exitCallback) process$1.exit(code);
			else exitCallback(new CommanderError(code, "commander.executeSubCommandAsync", "(close)"));
		});
		proc.on("error", (err) => {
			if (err.code === "ENOENT") this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
			else if (err.code === "EACCES") throw new Error(`'${executableFile}' not executable`);
			if (!exitCallback) process$1.exit(1);
			else {
				const wrappedError = new CommanderError(1, "commander.executeSubCommandAsync", "(error)");
				wrappedError.nestedError = err;
				exitCallback(wrappedError);
			}
		});
		this.runningCommand = proc;
	}
	/**
	* @private
	*/
	_dispatchSubcommand(commandName, operands, unknown) {
		const subCommand = this._findCommand(commandName);
		if (!subCommand) this.help({ error: true });
		subCommand._prepareForParse();
		let promiseChain;
		promiseChain = this._chainOrCallSubCommandHook(promiseChain, subCommand, "preSubcommand");
		promiseChain = this._chainOrCall(promiseChain, () => {
			if (subCommand._executableHandler) this._executeSubCommand(subCommand, operands.concat(unknown));
			else return subCommand._parseCommand(operands, unknown);
		});
		return promiseChain;
	}
	/**
	* Invoke help directly if possible, or dispatch if necessary.
	* e.g. help foo
	*
	* @private
	*/
	_dispatchHelpCommand(subcommandName) {
		if (!subcommandName) this.help();
		const subCommand = this._findCommand(subcommandName);
		if (subCommand && !subCommand._executableHandler) subCommand.help();
		return this._dispatchSubcommand(subcommandName, [], [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]);
	}
	/**
	* Check this.args against expected this.registeredArguments.
	*
	* @private
	*/
	_checkNumberOfArguments() {
		this.registeredArguments.forEach((arg, i) => {
			if (arg.required && this.args[i] == null) this.missingArgument(arg.name());
		});
		if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) return;
		if (this.args.length > this.registeredArguments.length) this._excessArguments(this.args);
	}
	/**
	* Process this.args using this.registeredArguments and save as this.processedArgs!
	*
	* @private
	*/
	_processArguments() {
		const myParseArg = (argument, value, previous) => {
			let parsedValue = value;
			if (value !== null && argument.parseArg) {
				const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
				parsedValue = this._callParseArg(argument, value, previous, invalidValueMessage);
			}
			return parsedValue;
		};
		this._checkNumberOfArguments();
		const processedArgs = [];
		this.registeredArguments.forEach((declaredArg, index) => {
			let value = declaredArg.defaultValue;
			if (declaredArg.variadic) {
				if (index < this.args.length) {
					value = this.args.slice(index);
					if (declaredArg.parseArg) value = value.reduce((processed, v) => {
						return myParseArg(declaredArg, v, processed);
					}, declaredArg.defaultValue);
				} else if (value === void 0) value = [];
			} else if (index < this.args.length) {
				value = this.args[index];
				if (declaredArg.parseArg) value = myParseArg(declaredArg, value, declaredArg.defaultValue);
			}
			processedArgs[index] = value;
		});
		this.processedArgs = processedArgs;
	}
	/**
	* Once we have a promise we chain, but call synchronously until then.
	*
	* @param {(Promise|undefined)} promise
	* @param {Function} fn
	* @return {(Promise|undefined)}
	* @private
	*/
	_chainOrCall(promise, fn) {
		if (promise?.then && typeof promise.then === "function") return promise.then(() => fn());
		return fn();
	}
	/**
	*
	* @param {(Promise|undefined)} promise
	* @param {string} event
	* @return {(Promise|undefined)}
	* @private
	*/
	_chainOrCallHooks(promise, event) {
		let result = promise;
		const hooks = [];
		this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== void 0).forEach((hookedCommand) => {
			hookedCommand._lifeCycleHooks[event].forEach((callback) => {
				hooks.push({
					hookedCommand,
					callback
				});
			});
		});
		if (event === "postAction") hooks.reverse();
		hooks.forEach((hookDetail) => {
			result = this._chainOrCall(result, () => {
				return hookDetail.callback(hookDetail.hookedCommand, this);
			});
		});
		return result;
	}
	/**
	*
	* @param {(Promise|undefined)} promise
	* @param {Command} subCommand
	* @param {string} event
	* @return {(Promise|undefined)}
	* @private
	*/
	_chainOrCallSubCommandHook(promise, subCommand, event) {
		let result = promise;
		if (this._lifeCycleHooks[event] !== void 0) this._lifeCycleHooks[event].forEach((hook) => {
			result = this._chainOrCall(result, () => {
				return hook(this, subCommand);
			});
		});
		return result;
	}
	/**
	* Process arguments in context of this command.
	* Returns action result, in case it is a promise.
	*
	* @private
	*/
	_parseCommand(operands, unknown) {
		const parsed = this.parseOptions(unknown);
		this._parseOptionsEnv();
		this._parseOptionsImplied();
		operands = operands.concat(parsed.operands);
		unknown = parsed.unknown;
		this.args = operands.concat(unknown);
		if (operands && this._findCommand(operands[0])) return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
		if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) return this._dispatchHelpCommand(operands[1]);
		if (this._defaultCommandName) {
			this._outputHelpIfRequested(unknown);
			return this._dispatchSubcommand(this._defaultCommandName, operands, unknown);
		}
		if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) this.help({ error: true });
		this._outputHelpIfRequested(parsed.unknown);
		this._checkForMissingMandatoryOptions();
		this._checkForConflictingOptions();
		const checkForUnknownOptions = () => {
			if (parsed.unknown.length > 0) this.unknownOption(parsed.unknown[0]);
		};
		const commandEvent = `command:${this.name()}`;
		if (this._actionHandler) {
			checkForUnknownOptions();
			this._processArguments();
			let promiseChain;
			promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
			promiseChain = this._chainOrCall(promiseChain, () => this._actionHandler(this.processedArgs));
			if (this.parent) promiseChain = this._chainOrCall(promiseChain, () => {
				this.parent.emit(commandEvent, operands, unknown);
			});
			promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
			return promiseChain;
		}
		if (this.parent?.listenerCount(commandEvent)) {
			checkForUnknownOptions();
			this._processArguments();
			this.parent.emit(commandEvent, operands, unknown);
		} else if (operands.length) {
			if (this._findCommand("*")) return this._dispatchSubcommand("*", operands, unknown);
			if (this.listenerCount("command:*")) this.emit("command:*", operands, unknown);
			else if (this.commands.length) this.unknownCommand();
			else {
				checkForUnknownOptions();
				this._processArguments();
			}
		} else if (this.commands.length) {
			checkForUnknownOptions();
			this.help({ error: true });
		} else {
			checkForUnknownOptions();
			this._processArguments();
		}
	}
	/**
	* Find matching command.
	*
	* @private
	* @return {Command | undefined}
	*/
	_findCommand(name) {
		if (!name) return void 0;
		return this.commands.find((cmd) => cmd._name === name || cmd._aliases.includes(name));
	}
	/**
	* Return an option matching `arg` if any.
	*
	* @param {string} arg
	* @return {Option}
	* @package
	*/
	_findOption(arg) {
		return this.options.find((option) => option.is(arg));
	}
	/**
	* Display an error message if a mandatory option does not have a value.
	* Called after checking for help flags in leaf subcommand.
	*
	* @private
	*/
	_checkForMissingMandatoryOptions() {
		this._getCommandAndAncestors().forEach((cmd) => {
			cmd.options.forEach((anOption) => {
				if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === void 0) cmd.missingMandatoryOptionValue(anOption);
			});
		});
	}
	/**
	* Display an error message if conflicting options are used together in this.
	*
	* @private
	*/
	_checkForConflictingLocalOptions() {
		const definedNonDefaultOptions = this.options.filter((option) => {
			const optionKey = option.attributeName();
			if (this.getOptionValue(optionKey) === void 0) return false;
			return this.getOptionValueSource(optionKey) !== "default";
		});
		definedNonDefaultOptions.filter((option) => option.conflictsWith.length > 0).forEach((option) => {
			const conflictingAndDefined = definedNonDefaultOptions.find((defined) => option.conflictsWith.includes(defined.attributeName()));
			if (conflictingAndDefined) this._conflictingOption(option, conflictingAndDefined);
		});
	}
	/**
	* Display an error message if conflicting options are used together.
	* Called after checking for help flags in leaf subcommand.
	*
	* @private
	*/
	_checkForConflictingOptions() {
		this._getCommandAndAncestors().forEach((cmd) => {
			cmd._checkForConflictingLocalOptions();
		});
	}
	/**
	* Parse options from `argv` removing known options,
	* and return argv split into operands and unknown arguments.
	*
	* Side effects: modifies command by storing options. Does not reset state if called again.
	*
	* Examples:
	*
	*     argv => operands, unknown
	*     --known kkk op => [op], []
	*     op --known kkk => [op], []
	*     sub --unknown uuu op => [sub], [--unknown uuu op]
	*     sub -- --unknown uuu op => [sub --unknown uuu op], []
	*
	* @param {string[]} args
	* @return {{operands: string[], unknown: string[]}}
	*/
	parseOptions(args) {
		const operands = [];
		const unknown = [];
		let dest = operands;
		function maybeOption(arg) {
			return arg.length > 1 && arg[0] === "-";
		}
		const negativeNumberArg = (arg) => {
			if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg)) return false;
			return !this._getCommandAndAncestors().some((cmd) => cmd.options.map((opt) => opt.short).some((short) => /^-\d$/.test(short)));
		};
		let activeVariadicOption = null;
		let activeGroup = null;
		let i = 0;
		while (i < args.length || activeGroup) {
			const arg = activeGroup ?? args[i++];
			activeGroup = null;
			if (arg === "--") {
				if (dest === unknown) dest.push(arg);
				dest.push(...args.slice(i));
				break;
			}
			if (activeVariadicOption && (!maybeOption(arg) || negativeNumberArg(arg))) {
				this.emit(`option:${activeVariadicOption.name()}`, arg);
				continue;
			}
			activeVariadicOption = null;
			if (maybeOption(arg)) {
				const option = this._findOption(arg);
				if (option) {
					if (option.required) {
						const value = args[i++];
						if (value === void 0) this.optionMissingArgument(option);
						this.emit(`option:${option.name()}`, value);
					} else if (option.optional) {
						let value = null;
						if (i < args.length && (!maybeOption(args[i]) || negativeNumberArg(args[i]))) value = args[i++];
						this.emit(`option:${option.name()}`, value);
					} else this.emit(`option:${option.name()}`);
					activeVariadicOption = option.variadic ? option : null;
					continue;
				}
			}
			if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
				const option = this._findOption(`-${arg[1]}`);
				if (option) {
					if (option.required || option.optional && this._combineFlagAndOptionalValue) this.emit(`option:${option.name()}`, arg.slice(2));
					else {
						this.emit(`option:${option.name()}`);
						activeGroup = `-${arg.slice(2)}`;
					}
					continue;
				}
			}
			if (/^--[^=]+=/.test(arg)) {
				const index = arg.indexOf("=");
				const option = this._findOption(arg.slice(0, index));
				if (option && (option.required || option.optional)) {
					this.emit(`option:${option.name()}`, arg.slice(index + 1));
					continue;
				}
			}
			if (dest === operands && maybeOption(arg) && !(this.commands.length === 0 && negativeNumberArg(arg))) dest = unknown;
			if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
				if (this._findCommand(arg)) {
					operands.push(arg);
					unknown.push(...args.slice(i));
					break;
				} else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
					operands.push(arg, ...args.slice(i));
					break;
				} else if (this._defaultCommandName) {
					unknown.push(arg, ...args.slice(i));
					break;
				}
			}
			if (this._passThroughOptions) {
				dest.push(arg, ...args.slice(i));
				break;
			}
			dest.push(arg);
		}
		return {
			operands,
			unknown
		};
	}
	/**
	* Return an object containing local option values as key-value pairs.
	*
	* @return {object}
	*/
	opts() {
		if (this._storeOptionsAsProperties) {
			const result = {};
			const len = this.options.length;
			for (let i = 0; i < len; i++) {
				const key = this.options[i].attributeName();
				result[key] = key === this._versionOptionName ? this._version : this[key];
			}
			return result;
		}
		return this._optionValues;
	}
	/**
	* Return an object containing merged local and global option values as key-value pairs.
	*
	* @return {object}
	*/
	optsWithGlobals() {
		return this._getCommandAndAncestors().reduce((combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()), {});
	}
	/**
	* Display error message and exit (or call exitOverride).
	*
	* @param {string} message
	* @param {object} [errorOptions]
	* @param {string} [errorOptions.code] - an id string representing the error
	* @param {number} [errorOptions.exitCode] - used with process.exit
	*/
	error(message, errorOptions) {
		this._outputConfiguration.outputError(`${message}\n`, this._outputConfiguration.writeErr);
		if (typeof this._showHelpAfterError === "string") this._outputConfiguration.writeErr(`${this._showHelpAfterError}\n`);
		else if (this._showHelpAfterError) {
			this._outputConfiguration.writeErr("\n");
			this.outputHelp({ error: true });
		}
		const config = errorOptions || {};
		const exitCode = config.exitCode || 1;
		const code = config.code || "commander.error";
		this._exit(exitCode, code, message);
	}
	/**
	* Apply any option related environment variables, if option does
	* not have a value from cli or client code.
	*
	* @private
	*/
	_parseOptionsEnv() {
		this.options.forEach((option) => {
			if (option.envVar && option.envVar in process$1.env) {
				const optionKey = option.attributeName();
				if (this.getOptionValue(optionKey) === void 0 || [
					"default",
					"config",
					"env"
				].includes(this.getOptionValueSource(optionKey))) {
					if (option.required || option.optional) this.emit(`optionEnv:${option.name()}`, process$1.env[option.envVar]);
					else this.emit(`optionEnv:${option.name()}`);
				}
			}
		});
	}
	/**
	* Apply any implied option values, if option is undefined or default value.
	*
	* @private
	*/
	_parseOptionsImplied() {
		const dualHelper = new DualOptions(this.options);
		const hasCustomOptionValue = (optionKey) => {
			return this.getOptionValue(optionKey) !== void 0 && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
		};
		this.options.filter((option) => option.implied !== void 0 && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(this.getOptionValue(option.attributeName()), option)).forEach((option) => {
			Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
				this.setOptionValueWithSource(impliedKey, option.implied[impliedKey], "implied");
			});
		});
	}
	/**
	* Argument `name` is missing.
	*
	* @param {string} name
	* @private
	*/
	missingArgument(name) {
		const message = `error: missing required argument '${name}'`;
		this.error(message, { code: "commander.missingArgument" });
	}
	/**
	* `Option` is missing an argument.
	*
	* @param {Option} option
	* @private
	*/
	optionMissingArgument(option) {
		const message = `error: option '${option.flags}' argument missing`;
		this.error(message, { code: "commander.optionMissingArgument" });
	}
	/**
	* `Option` does not have a value, and is a mandatory option.
	*
	* @param {Option} option
	* @private
	*/
	missingMandatoryOptionValue(option) {
		const message = `error: required option '${option.flags}' not specified`;
		this.error(message, { code: "commander.missingMandatoryOptionValue" });
	}
	/**
	* `Option` conflicts with another option.
	*
	* @param {Option} option
	* @param {Option} conflictingOption
	* @private
	*/
	_conflictingOption(option, conflictingOption) {
		const findBestOptionFromValue = (option) => {
			const optionKey = option.attributeName();
			const optionValue = this.getOptionValue(optionKey);
			const negativeOption = this.options.find((target) => target.negate && optionKey === target.attributeName());
			const positiveOption = this.options.find((target) => !target.negate && optionKey === target.attributeName());
			if (negativeOption && (negativeOption.presetArg === void 0 && optionValue === false || negativeOption.presetArg !== void 0 && optionValue === negativeOption.presetArg)) return negativeOption;
			return positiveOption || option;
		};
		const getErrorMessage = (option) => {
			const bestOption = findBestOptionFromValue(option);
			const optionKey = bestOption.attributeName();
			if (this.getOptionValueSource(optionKey) === "env") return `environment variable '${bestOption.envVar}'`;
			return `option '${bestOption.flags}'`;
		};
		const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
		this.error(message, { code: "commander.conflictingOption" });
	}
	/**
	* Unknown option `flag`.
	*
	* @param {string} flag
	* @private
	*/
	unknownOption(flag) {
		if (this._allowUnknownOption) return;
		let suggestion = "";
		if (flag.startsWith("--") && this._showSuggestionAfterError) {
			let candidateFlags = [];
			let command = this;
			do {
				const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
				candidateFlags = candidateFlags.concat(moreFlags);
				command = command.parent;
			} while (command && !command._enablePositionalOptions);
			suggestion = suggestSimilar(flag, candidateFlags);
		}
		const message = `error: unknown option '${flag}'${suggestion}`;
		this.error(message, { code: "commander.unknownOption" });
	}
	/**
	* Excess arguments, more than expected.
	*
	* @param {string[]} receivedArgs
	* @private
	*/
	_excessArguments(receivedArgs) {
		if (this._allowExcessArguments) return;
		const expected = this.registeredArguments.length;
		const s = expected === 1 ? "" : "s";
		const received = receivedArgs.length;
		const message = `error: too many arguments${this.parent ? ` for '${this.name()}'` : ""}. Expected ${expected} argument${s} but got ${received}: ${receivedArgs.join(", ")}.`;
		this.error(message, { code: "commander.excessArguments" });
	}
	/**
	* Unknown command.
	*
	* @private
	*/
	unknownCommand() {
		const unknownName = this.args[0];
		let suggestion = "";
		if (this._showSuggestionAfterError) {
			const candidateNames = [];
			this.createHelp().visibleCommands(this).forEach((command) => {
				candidateNames.push(command.name());
				if (command.alias()) candidateNames.push(command.alias());
			});
			suggestion = suggestSimilar(unknownName, candidateNames);
		}
		const message = `error: unknown command '${unknownName}'${suggestion}`;
		this.error(message, { code: "commander.unknownCommand" });
	}
	/**
	* Get or set the program version.
	*
	* This method auto-registers the "-V, --version" option which will print the version number.
	*
	* You can optionally supply the flags and description to override the defaults.
	*
	* @param {string} [str]
	* @param {string} [flags]
	* @param {string} [description]
	* @return {(this | string | undefined)} `this` command for chaining, or version string if no arguments
	*/
	version(str, flags, description) {
		if (str === void 0) return this._version;
		this._version = str;
		flags = flags || "-V, --version";
		description = description || "output the version number";
		const versionOption = this.createOption(flags, description);
		this._versionOptionName = versionOption.attributeName();
		this._registerOption(versionOption);
		this.on("option:" + versionOption.name(), () => {
			this._outputConfiguration.writeOut(`${str}\n`);
			this._exit(0, "commander.version", str);
		});
		return this;
	}
	/**
	* Set the description.
	*
	* @param {string} [str]
	* @param {object} [argsDescription]
	* @return {(string|Command)}
	*/
	description(str, argsDescription) {
		if (str === void 0 && argsDescription === void 0) return this._description;
		this._description = str;
		if (argsDescription) this._argsDescription = argsDescription;
		return this;
	}
	/**
	* Set the summary. Used when listed as subcommand of parent.
	*
	* @param {string} [str]
	* @return {(string|Command)}
	*/
	summary(str) {
		if (str === void 0) return this._summary;
		this._summary = str;
		return this;
	}
	/**
	* Set an alias for the command.
	*
	* You may call more than once to add multiple aliases. Only the first alias is shown in the auto-generated help.
	*
	* @param {string} [alias]
	* @return {(string|Command)}
	*/
	alias(alias) {
		if (alias === void 0) return this._aliases[0];
		/** @type {Command} */
		let command = this;
		if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) command = this.commands[this.commands.length - 1];
		if (alias === command._name) throw new Error("Command alias can't be the same as its name");
		const matchingCommand = this.parent?._findCommand(alias);
		if (matchingCommand) {
			const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
			throw new Error(`cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`);
		}
		command._aliases.push(alias);
		return this;
	}
	/**
	* Set aliases for the command.
	*
	* Only the first alias is shown in the auto-generated help.
	*
	* @param {string[]} [aliases]
	* @return {(string[]|Command)}
	*/
	aliases(aliases) {
		if (aliases === void 0) return this._aliases;
		aliases.forEach((alias) => this.alias(alias));
		return this;
	}
	/**
	* Set / get the command usage `str`.
	*
	* @param {string} [str]
	* @return {(string|Command)}
	*/
	usage(str) {
		if (str === void 0) {
			if (this._usage) return this._usage;
			const args = this.registeredArguments.map((arg) => {
				return humanReadableArgName(arg);
			});
			return [].concat(this.options.length || this._helpOption !== null ? "[options]" : [], this.commands.length ? "[command]" : [], this.registeredArguments.length ? args : []).join(" ");
		}
		this._usage = str;
		return this;
	}
	/**
	* Get or set the name of the command.
	*
	* @param {string} [str]
	* @return {(string|Command)}
	*/
	name(str) {
		if (str === void 0) return this._name;
		this._name = str;
		return this;
	}
	/**
	* Set/get the help group heading for this subcommand in parent command's help.
	*
	* @param {string} [heading]
	* @return {Command | string}
	*/
	helpGroup(heading) {
		if (heading === void 0) return this._helpGroupHeading ?? "";
		this._helpGroupHeading = heading;
		return this;
	}
	/**
	* Set/get the default help group heading for subcommands added to this command.
	* (This does not override a group set directly on the subcommand using .helpGroup().)
	*
	* @example
	* program.commandsGroup('Development Commands:);
	* program.command('watch')...
	* program.command('lint')...
	* ...
	*
	* @param {string} [heading]
	* @returns {Command | string}
	*/
	commandsGroup(heading) {
		if (heading === void 0) return this._defaultCommandGroup ?? "";
		this._defaultCommandGroup = heading;
		return this;
	}
	/**
	* Set/get the default help group heading for options added to this command.
	* (This does not override a group set directly on the option using .helpGroup().)
	*
	* @example
	* program
	*   .optionsGroup('Development Options:')
	*   .option('-d, --debug', 'output extra debugging')
	*   .option('-p, --profile', 'output profiling information')
	*
	* @param {string} [heading]
	* @returns {Command | string}
	*/
	optionsGroup(heading) {
		if (heading === void 0) return this._defaultOptionGroup ?? "";
		this._defaultOptionGroup = heading;
		return this;
	}
	/**
	* @param {Option} option
	* @private
	*/
	_initOptionGroup(option) {
		if (this._defaultOptionGroup && !option.helpGroupHeading) option.helpGroup(this._defaultOptionGroup);
	}
	/**
	* @param {Command} cmd
	* @private
	*/
	_initCommandGroup(cmd) {
		if (this._defaultCommandGroup && !cmd.helpGroup()) cmd.helpGroup(this._defaultCommandGroup);
	}
	/**
	* Set the name of the command from script filename, such as process.argv[1],
	* or import.meta.filename.
	*
	* (Used internally and public although not documented in README.)
	*
	* @example
	* program.nameFromFilename(import.meta.filename);
	*
	* @param {string} filename
	* @return {Command}
	*/
	nameFromFilename(filename) {
		this._name = path.basename(filename, path.extname(filename));
		return this;
	}
	/**
	* Get or set the directory for searching for executable subcommands of this command.
	*
	* @example
	* program.executableDir(import.meta.dirname);
	* // or
	* program.executableDir('subcommands');
	*
	* @param {string} [path]
	* @return {(string|null|Command)}
	*/
	executableDir(path) {
		if (path === void 0) return this._executableDir;
		this._executableDir = path;
		return this;
	}
	/**
	* Return program help documentation.
	*
	* @param {{ error: boolean }} [contextOptions] - pass {error:true} to wrap for stderr instead of stdout
	* @return {string}
	*/
	helpInformation(contextOptions) {
		const helper = this.createHelp();
		const context = this._getOutputContext(contextOptions);
		helper.prepareContext({
			error: context.error,
			helpWidth: context.helpWidth,
			outputHasColors: context.hasColors
		});
		const text = helper.formatHelp(this, helper);
		if (context.hasColors) return text;
		return this._outputConfiguration.stripColor(text);
	}
	/**
	* @typedef HelpContext
	* @type {object}
	* @property {boolean} error
	* @property {number} helpWidth
	* @property {boolean} hasColors
	* @property {function} write - includes stripColor if needed
	*
	* @returns {HelpContext}
	* @private
	*/
	_getOutputContext(contextOptions) {
		contextOptions = contextOptions || {};
		const error = !!contextOptions.error;
		let baseWrite;
		let hasColors;
		let helpWidth;
		if (error) {
			baseWrite = (str) => this._outputConfiguration.writeErr(str);
			hasColors = this._outputConfiguration.getErrHasColors();
			helpWidth = this._outputConfiguration.getErrHelpWidth();
		} else {
			baseWrite = (str) => this._outputConfiguration.writeOut(str);
			hasColors = this._outputConfiguration.getOutHasColors();
			helpWidth = this._outputConfiguration.getOutHelpWidth();
		}
		const write = (str) => {
			if (!hasColors) str = this._outputConfiguration.stripColor(str);
			return baseWrite(str);
		};
		return {
			error,
			write,
			hasColors,
			helpWidth
		};
	}
	/**
	* Output help information for this command.
	*
	* Outputs built-in help, and custom text added using `.addHelpText()`.
	*
	* @param {{ error: boolean } | Function} [contextOptions] - pass {error:true} to write to stderr instead of stdout
	*/
	outputHelp(contextOptions) {
		let deprecatedCallback;
		if (typeof contextOptions === "function") {
			deprecatedCallback = contextOptions;
			contextOptions = void 0;
		}
		const outputContext = this._getOutputContext(contextOptions);
		/** @type {HelpTextEventContext} */
		const eventContext = {
			error: outputContext.error,
			write: outputContext.write,
			command: this
		};
		this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
		this.emit("beforeHelp", eventContext);
		let helpInformation = this.helpInformation({ error: outputContext.error });
		if (deprecatedCallback) {
			helpInformation = deprecatedCallback(helpInformation);
			if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) throw new Error("outputHelp callback must return a string or a Buffer");
		}
		outputContext.write(helpInformation);
		if (this._getHelpOption()?.long) this.emit(this._getHelpOption().long);
		this.emit("afterHelp", eventContext);
		this._getCommandAndAncestors().forEach((command) => command.emit("afterAllHelp", eventContext));
	}
	/**
	* You can pass in flags and a description to customise the built-in help option.
	* Pass in false to disable the built-in help option.
	*
	* @example
	* program.helpOption('-?, --help' 'show help'); // customise
	* program.helpOption(false); // disable
	*
	* @param {(string | boolean)} flags
	* @param {string} [description]
	* @return {Command} `this` command for chaining
	*/
	helpOption(flags, description) {
		if (typeof flags === "boolean") {
			if (flags) {
				if (this._helpOption === null) this._helpOption = void 0;
				if (this._defaultOptionGroup) this._initOptionGroup(this._getHelpOption());
			} else this._helpOption = null;
			return this;
		}
		this._helpOption = this.createOption(flags ?? "-h, --help", description ?? "display help for command");
		if (flags || description) this._initOptionGroup(this._helpOption);
		return this;
	}
	/**
	* Lazy create help option.
	* Returns null if has been disabled with .helpOption(false).
	*
	* @returns {(Option | null)} the help option
	* @package
	*/
	_getHelpOption() {
		if (this._helpOption === void 0) this.helpOption(void 0, void 0);
		return this._helpOption;
	}
	/**
	* Supply your own option to use for the built-in help option.
	* This is an alternative to using helpOption() to customise the flags and description etc.
	*
	* @param {Option} option
	* @return {Command} `this` command for chaining
	*/
	addHelpOption(option) {
		this._helpOption = option;
		this._initOptionGroup(option);
		return this;
	}
	/**
	* Output help information and exit.
	*
	* Outputs built-in help, and custom text added using `.addHelpText()`.
	*
	* @param {{ error: boolean }} [contextOptions] - pass {error:true} to write to stderr instead of stdout
	*/
	help(contextOptions) {
		this.outputHelp(contextOptions);
		let exitCode = Number(process$1.exitCode ?? 0);
		if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) exitCode = 1;
		this._exit(exitCode, "commander.help", "(outputHelp)");
	}
	/**
	* // Do a little typing to coordinate emit and listener for the help text events.
	* @typedef HelpTextEventContext
	* @type {object}
	* @property {boolean} error
	* @property {Command} command
	* @property {function} write
	*/
	/**
	* Add additional text to be displayed with the built-in help.
	*
	* Position is 'before' or 'after' to affect just this command,
	* and 'beforeAll' or 'afterAll' to affect this command and all its subcommands.
	*
	* @param {string} position - before or after built-in help
	* @param {(string | Function)} text - string to add, or a function returning a string
	* @return {Command} `this` command for chaining
	*/
	addHelpText(position, text) {
		const allowedValues = [
			"beforeAll",
			"before",
			"after",
			"afterAll"
		];
		if (!allowedValues.includes(position)) throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
		const helpEvent = `${position}Help`;
		this.on(helpEvent, (context) => {
			let helpStr;
			if (typeof text === "function") helpStr = text({
				error: context.error,
				command: context.command
			});
			else helpStr = text;
			if (helpStr) context.write(`${helpStr}\n`);
		});
		return this;
	}
	/**
	* Output help information if help flags specified
	*
	* @param {Array} args - array of options to search for help flags
	* @private
	*/
	_outputHelpIfRequested(args) {
		const helpOption = this._getHelpOption();
		if (helpOption && args.find((arg) => helpOption.is(arg))) {
			this.outputHelp();
			this._exit(0, "commander.helpDisplayed", "(outputHelp)");
		}
	}
};
/**
* Scan arguments and increment port number for inspect calls (to avoid conflicts when spawning new command).
*
* @param {string[]} args - array of arguments from node.execArgv
* @returns {string[]}
* @private
*/
function incrementNodeInspectorPort(args) {
	return args.map((arg) => {
		if (!arg.startsWith("--inspect")) return arg;
		let debugOption;
		let debugHost = "127.0.0.1";
		let debugPort = "9229";
		let match;
		if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) debugOption = match[1];
		else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
			debugOption = match[1];
			if (/^\d+$/.test(match[3])) debugPort = match[3];
			else debugHost = match[3];
		} else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
			debugOption = match[1];
			debugHost = match[3];
			debugPort = match[4];
		}
		if (debugOption && debugPort !== "0") return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
		return arg;
	});
}
/**
* Exported for using from tests, not otherwise used outside this file.
*
* @returns {boolean | undefined}
* @package
*/
function useColor() {
	if (process$1.env.NO_COLOR || process$1.env.FORCE_COLOR === "0" || process$1.env.FORCE_COLOR === "false") return false;
	if (process$1.env.FORCE_COLOR || process$1.env.CLICOLOR_FORCE !== void 0) return true;
}

// ../../../node_modules/.pnpm/commander@15.0.0/node_modules/commander/index.js
const program = new Command();

// ../typescript/dist/version.js
const VERSION = "0.1.1";

// ../typescript/dist/runtime/errors.js
/** The docs page with the table of problem codes, in the Markdown form for agents. */
const ERROR_CODES_DOC_URL = "https://code.storage/docs/api/overview.md#error-codes";
/** The base class of every error that the SDK raises. */
var PierreError = class extends Error {
	name = "PierreError";
};
/** The request got no response. */
var APIConnectionError = class extends PierreError {
	name = "APIConnectionError";
};
/** The request got no response before its timeout. */
var APITimeoutError = class extends APIConnectionError {
	name = "APITimeoutError";
};
/** An HTTP error response. Branch on `code`, not on the message. */
var APIError = class extends PierreError {
	name = "APIError";
	status;
	/** The problem `code`, for example `repository_not_found`. */
	code;
	title;
	detail;
	/** The `X-Request-Id` response header, or `null` when the server does not send it. */
	request_id;
	/** The headers of the error response, for example `retry-after`. */
	headers;
	/** The parsed response body, with any extension members. */
	body;
	/** The docs page that explains the codes. */
	doc_url = ERROR_CODES_DOC_URL;
	constructor(status, body, headers = new Headers()) {
		const problem = isRecord$2(body) ? body : {};
		const code = text$1(problem.code);
		const title = text$1(problem.title);
		const detail = text$1(problem.detail) ?? text$1(problem.error) ?? text$1(problem.message);
		super(`${status}${code === void 0 ? "" : ` ${code}`}: ${detail ?? title ?? "request failed"}`);
		this.status = status;
		this.code = code;
		this.title = title;
		this.detail = detail;
		this.request_id = headers.get("x-request-id");
		this.headers = headers;
		this.body = body;
	}
};
var BadRequestError = class extends APIError {
	name = "BadRequestError";
};
var AuthenticationError = class extends APIError {
	name = "AuthenticationError";
};
var PermissionDeniedError = class extends APIError {
	name = "PermissionDeniedError";
};
var NotFoundError = class extends APIError {
	name = "NotFoundError";
};
var ConflictError = class extends APIError {
	name = "ConflictError";
};
var RateLimitError = class extends APIError {
	name = "RateLimitError";
};
var InternalServerError = class extends APIError {
	name = "InternalServerError";
};
/** A merge conflict. It carries the conflict fields of the response. */
var MergeConflictError = class extends ConflictError {
	name = "MergeConflictError";
	conflict_type;
	conflict_paths;
	merge_base_sha;
	constructor(status, body, headers) {
		super(status, body, headers);
		const problem = isRecord$2(body) ? body : {};
		this.conflict_type = text$1(problem.conflict_type);
		this.conflict_paths = problem.conflict_paths;
		this.merge_base_sha = text$1(problem.merge_base_sha);
	}
};
/**
* A Git write whose ref guard failed: a response with the code `ref_guard_failed`. `guard` names the
* request field of the guard, for example `expected_target_sha`. `current_sha` is the commit of the
* guarded ref, or 40 zeros when the ref does not exist; send it as the guard of the next attempt.
* The body of a commit write, a restore, or a notes write also keeps `result`, which `body` gives.
*/
var RefGuardError = class extends ConflictError {
	name = "RefGuardError";
	guard;
	current_sha;
	constructor(status, body, headers) {
		super(status, body, headers);
		const problem = isRecord$2(body) ? body : {};
		this.guard = text$1(problem.guard);
		this.current_sha = text$1(problem.current_sha);
	}
};
/**
* A Git write whose ref update failed: an error response whose body has `result`. It carries
* `result` and `commit`. A Git write method returns only when the ref update succeeded.
*/
var RefUpdateError = class extends APIError {
	name = "RefUpdateError";
	/**
	* The result of the ref update. `status` gives the reason, for example `conflict` or
	* `precondition_failed`. A notes write sends a `NotesWriteResult`, which has only `success`,
	* `status`, and `message`.
	*/
	result;
	/** The commit of the write, or `null` when the response has none. A restore has no `blob_count`. */
	commit;
	constructor(status, body, headers) {
		super(status, body, headers);
		const problem = isRecord$2(body) ? body : {};
		this.result = problem.result;
		this.commit = problem.commit ?? null;
	}
};
const BY_STATUS = {
	400: BadRequestError,
	401: AuthenticationError,
	403: PermissionDeniedError,
	404: NotFoundError,
	409: ConflictError,
	429: RateLimitError
};
/** The codes of a merge conflict. Today the conflict body can also have `conflict_type` only. */
const MERGE_CONFLICT_CODES = /* @__PURE__ */ new Set(["merge_conflict"]);
/** The code of a failed ref guard. Its body can also have `result`, so it is read first. */
const REF_GUARD_FAILED = "ref_guard_failed";
/** Picks the error class of an error response from the status and the body. */
function apiError(status, body, headers) {
	const problem = isRecord$2(body) ? body : {};
	const code = text$1(problem.code);
	if (code === REF_GUARD_FAILED) return new RefGuardError(status, body, headers);
	if (isRecord$2(problem.result)) return new RefUpdateError(status, body, headers);
	if (code !== void 0 && MERGE_CONFLICT_CODES.has(code) || typeof problem.conflict_type === "string") return new MergeConflictError(status, body, headers);
	return new (BY_STATUS[status] ?? (status >= 500 ? InternalServerError : APIError))(status, body, headers);
}
/** The problem `code` of a parsed body, or `undefined`. */
function problemCode(body) {
	return isRecord$2(body) ? text$1(body.code) : void 0;
}
function isRecord$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text$1(value) {
	return typeof value === "string" && value !== "" ? value : void 0;
}

// ../typescript/dist/runtime/credentials.js
/** The longest token lifetime that the SDK signs. */
const MAX_TOKEN_SECONDS = 3600;
/** The `sub` claim of the tokens that the SDK signs. */
const SUBJECT = "pierre-sdk-typescript";
const KEY_TYPES = [
	{
		alg: "ES256",
		importParams: {
			name: "ECDSA",
			namedCurve: "P-256"
		},
		hash: "SHA-256"
	},
	{
		alg: "ES384",
		importParams: {
			name: "ECDSA",
			namedCurve: "P-384"
		},
		hash: "SHA-384"
	},
	{
		alg: "ES512",
		importParams: {
			name: "ECDSA",
			namedCurve: "P-521"
		},
		hash: "SHA-512"
	},
	{
		alg: "RS256",
		importParams: {
			name: "RSASSA-PKCS1-v1_5",
			hash: "SHA-256"
		},
		hash: "SHA-256"
	}
];
/**
* Checks the shape of ref policies, and returns a frozen copy. The gateway checks the pattern
* forms and the ops.
*/
function checkRefPolicies(policies, name) {
	if (policies === void 0) return void 0;
	if (!Array.isArray(policies)) throw new PierreError(`\`${name}\` must be a list of rules.`);
	return Object.freeze(policies.map((policy, index) => {
		const at = `\`${name}[${index}]\``;
		if (typeof policy !== "object" || policy === null) throw new PierreError(`${at} must be an object with \`pattern\` and \`ops\`.`);
		const { pattern, ops } = policy;
		if (typeof pattern !== "string" || pattern === "") throw new PierreError(`${at}.pattern must be a non-empty string.`);
		if (ops === void 0) return Object.freeze({ pattern });
		if (!Array.isArray(ops) || ops.some((op) => typeof op !== "string" || op === "")) throw new PierreError(`${at}.ops must be a list of op names.`);
		return Object.freeze({
			pattern,
			ops: Object.freeze(ops.map(String))
		});
	}));
}
/** The `refs` claim of ref policies, or `undefined` for no rule. */
function refsClaim(policies) {
	if (policies === void 0 || policies.length === 0) return void 0;
	return policies.map(({ pattern, ops }) => [pattern, ops ?? []]);
}
/** Checks a token lifetime: a whole number of seconds from 1 to 3600. */
function checkTtl(ttl, name) {
	if (!Number.isInteger(ttl) || ttl < 1 || ttl > 3600) throw new PierreError(`\`${name}\` must be a whole number of seconds from 1 to ${MAX_TOKEN_SECONDS}.`);
	return ttl;
}
/** A signer for a PKCS #8 PEM private key. `load` runs once, on the first signature. */
function keySigner(load) {
	let signingKey;
	return { async sign(claims) {
		signingKey ??= load().then(importSigningKey);
		let loaded;
		try {
			loaded = await signingKey;
		} catch (error) {
			signingKey = void 0;
			throw error;
		}
		const { key, alg, kid } = loaded;
		const now = Math.floor(Date.now() / 1e3);
		const header = {
			alg,
			typ: "JWT",
			kid
		};
		const payload = {
			iss: claims.iss,
			sub: claims.sub,
			...claims.repo === void 0 ? {} : { repo: claims.repo },
			scopes: [...claims.scopes],
			iat: now,
			exp: now + claims.ttl,
			...claims.refs === void 0 ? {} : { refs: claims.refs }
		};
		const input = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
		const type = KEY_TYPES.find((entry) => entry.alg === alg);
		const algorithm = type?.importParams.name === "ECDSA" ? {
			name: "ECDSA",
			hash: type.hash
		} : { name: "RSASSA-PKCS1-v1_5" };
		const signature = await crypto.subtle.sign(algorithm, key, new TextEncoder().encode(input));
		return `${input}.${base64Url(new Uint8Array(signature))}`;
	} };
}
/** Signs a token for each request with the operation's scopes and repository claim. */
function signerCredentials(org, signer) {
	return {
		fixed: false,
		token: (request) => signer.sign({
			iss: org,
			sub: SUBJECT,
			repo: request.repo,
			scopes: request.scopes,
			ttl: request.ttl,
			refs: refsClaim(request.ref_policies)
		})
	};
}
/** A fixed token. The server checks its scopes. */
function tokenCredentials(token) {
	return {
		fixed: true,
		token: () => Promise.resolve(token)
	};
}
/** Asks the caller's function for the token of each request. */
function getTokenCredentials(getToken) {
	return {
		fixed: false,
		async token(request) {
			const refPolicies = request.ref_policies ?? [];
			const token = await getToken({
				scopes: [...request.scopes],
				...request.repo === void 0 ? {} : { repo: request.repo },
				ttl: request.ttl,
				...refPolicies.length === 0 ? {} : { ref_policies: refPolicies },
				...request.signal === void 0 ? {} : { signal: request.signal }
			});
			if (typeof token !== "string" || token === "") throw new PierreError("`getToken` must return a token string.");
			return token;
		}
	};
}
const clientKeys = /* @__PURE__ */ new WeakMap();
function registerClientKey(client, key) {
	clientKeys.set(client, key);
}
function clientKey(client) {
	return clientKeys.get(client);
}
/** Imports a PKCS #8 PEM private key, and finds its algorithm and key ID. */
async function importSigningKey(pem) {
	const der = pemToDer(pem);
	for (const type of KEY_TYPES) {
		let key;
		try {
			key = await crypto.subtle.importKey("pkcs8", der, type.importParams, true, ["sign"]);
		} catch {
			continue;
		}
		return {
			key,
			alg: type.alg,
			kid: await keyId(key, type.importParams)
		};
	}
	throw new PierreError("The private key is not a PKCS #8 EC (P-256, P-384, or P-521) or RSA key in PEM form.");
}
/** The key ID: the lowercase hex SHA-256 of the SPKI DER of the public key. */
async function keyId(privateKey, params) {
	const { kty, crv, x, y, n, e } = await crypto.subtle.exportKey("jwk", privateKey);
	const publicJwk = Object.fromEntries(Object.entries(kty === "EC" ? {
		kty,
		crv,
		x,
		y
	} : {
		kty,
		n,
		e
	}).filter(([, value]) => value !== void 0));
	const publicKey = await crypto.subtle.importKey("jwk", publicJwk, params, true, ["verify"]);
	const spki = await crypto.subtle.exportKey("spki", publicKey);
	const digest = await crypto.subtle.digest("SHA-256", spki);
	return hex(new Uint8Array(digest));
}
function pemToDer(pem) {
	const match = /-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/.exec(pem);
	if (match?.[1] === void 0) throw new PierreError("The private key must be a PEM block of type \"PRIVATE KEY\" (PKCS #8).");
	const binary = atob(match[1].replaceAll(/\s+/g, ""));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes.buffer;
}
function hex(bytes) {
	return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function base64(bytes) {
	let binary = "";
	const step = 32768;
	for (let index = 0; index < bytes.length; index += step) binary += String.fromCharCode(...bytes.subarray(index, index + step));
	return btoa(binary);
}
function base64Url(bytes) {
	return base64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function base64UrlJson(value) {
	return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}
/** The `iss` claim of a token, or `undefined`. The SDK does not verify the token. */
function tokenIssuer(token) {
	const payload = token.split(".")[1];
	if (payload === void 0) return void 0;
	try {
		const json = JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/")));
		return typeof json === "object" && json !== null && "iss" in json && typeof json.iss === "string" && json.iss !== "" ? json.iss : void 0;
	} catch {
		return;
	}
}

// ../typescript/dist/runtime/api-promise.js
/**
* The result of a method. `await` gives the result. `withResponse()` also gives the response,
* and `asResponse()` gives the response without a read of the body. The request starts when the
* method is called, and every use reads that one request.
*/
var APIPromise = class extends Promise {
	static get [Symbol.species]() {
		return Promise;
	}
	#call;
	#received;
	#use;
	#result;
	/**
	* A method makes it. A test can also make one, to mock a method. When the code under test only
	* uses `await`, a plain promise is enough. When it calls `withResponse()` or `asResponse()`,
	* make an `APIPromise` from a call that gives the response and the data.
	*
	* ```ts
	* const response = Response.json(data);
	* const promise = new APIPromise({
	* 	send: async () => ({ response, read: true, body: data }),
	* 	data: async () => data,
	* 	headers: () => ({}),
	* });
	* ```
	*/
	constructor(call) {
		super(() => void 0);
		this.#call = call;
		this.#received = call.send(() => this.#use);
	}
	/**
	* The platform response, when its headers arrive. The SDK does not read the body, so the
	* timeout ends with the headers, and no retry covers the body. An error status rejects with
	* the `APIError`. After `await` or `withResponse()`, the body is already read. When the
	* response arrives before any use, the SDK reads a copy of the body, so the body stays
	* readable.
	*/
	asResponse() {
		this.#use ??= "response";
		return this.#received.then((received) => received.response);
	}
	/** The result, with the platform response, the declared headers, and the request ID. */
	async withResponse() {
		const { data, response } = await this.#data();
		return {
			data,
			response,
			headers: this.#call.headers(response),
			request_id: response.headers.get("x-request-id")
		};
	}
	then(onfulfilled, onrejected) {
		return this.#data().then((result) => result.data).then(onfulfilled, onrejected);
	}
	#data() {
		this.#use ??= "data";
		this.#result ??= this.#received.then(async (received) => ({
			data: await this.#call.data(received),
			response: received.response
		}));
		return this.#result;
	}
};

// ../typescript/dist/runtime/page.js
/**
* One page of a list. `body` is the full response, with the fields beside the items. `for await`
* on a page iterates over the items of this page and of each next page.
*/
var Page = class {
	data;
	has_more;
	next_cursor;
	body;
	/** The platform response of this page. The SDK read its body. */
	response;
	#fetch;
	/**
	* A list method makes a page. A test can also make one, to mock a list method. Return the page
	* itself, not a promise of it, so that `await` and `for await` both work. `fetch` gets the page
	* at a cursor. A page with `has_more` false never calls it.
	*
	* ```ts
	* const fields = { data, has_more: false, next_cursor: undefined, body, response: new Response() };
	* const page = new Page(fields, () => Promise.reject(new Error('no next page')));
	* ```
	*/
	constructor(fields, fetch) {
		this.data = fields.data;
		this.has_more = fields.has_more;
		this.next_cursor = fields.next_cursor;
		this.body = fields.body;
		this.response = fields.response;
		this.#fetch = fetch;
	}
	/** Whether a next page exists: `has_more` is true, and `next_cursor` is not empty. */
	hasNextPage() {
		return this.#nextCursor() !== void 0;
	}
	/** Gets the next page. Call `hasNextPage()` first: with no next page, it throws. */
	async getNextPage() {
		const cursor = this.#nextCursor();
		if (cursor === void 0) throw new PierreError("No next page. Call `hasNextPage()` before `getNextPage()`.");
		return this.#fetch(cursor);
	}
	/** This page, then each next page. */
	async *iterPages() {
		yield this;
		let cursor = this.#nextCursor();
		while (cursor !== void 0) {
			const page = await this.#fetch(cursor);
			yield page;
			cursor = page.#nextCursor();
		}
	}
	/**
	* The response body of this page. So `JSON.stringify(page)` gives the response that the API
	* sent, with the items one time and without the platform response.
	*/
	toJSON() {
		return this.body;
	}
	async *[Symbol.asyncIterator]() {
		for await (const page of this.iterPages()) yield* page.data;
	}
	#nextCursor() {
		return this.has_more && this.next_cursor !== void 0 && this.next_cursor !== "" ? this.next_cursor : void 0;
	}
};
/**
* The result of a `list` method. `await` gives the first page, and `for await` iterates over the
* items of every page.
*/
var PagePromise = class extends APIPromise {
	async *[Symbol.asyncIterator]() {
		yield* await this;
	}
};

// ../typescript/dist/runtime/retry.js
/** The 409 codes of a condition that ends by itself. */
const RETRYABLE_CONFLICT_CODES = /* @__PURE__ */ new Set(["repository_thawing", "sync_in_progress"]);
/** The first backoff delay. */
const INITIAL_DELAY_MS = 500;
/** The longest backoff delay. */
const MAX_BACKOFF_MS = 8e3;
/** The longest `Retry-After` that the SDK waits. A longer value falls back to the backoff. */
const MAX_RETRY_AFTER_MS = 6e4;
/** Whether an error status can succeed on a repeat. */
function transientStatus(status, code) {
	return status === 408 || status === 429 || status >= 500 || status === 409 && code !== void 0 && RETRYABLE_CONFLICT_CODES.has(code);
}
/**
* The wait before retry number `attempt + 1`: the `Retry-After` value when it is 60 seconds or
* less, or else an exponential backoff from 0.5 seconds, up to 8 seconds, less up to 25% jitter.
*/
function retryDelay(retryAfter, attempt, now = Date.now()) {
	const after = retryAfterMs(retryAfter, now);
	if (after !== void 0 && after <= MAX_RETRY_AFTER_MS) return after;
	return Math.min(INITIAL_DELAY_MS * 2 ** attempt, MAX_BACKOFF_MS) * (1 - Math.random() * .25);
}
/**
* The HTTP date form that servers send (IMF-fixdate, RFC 9110), for example
* `Sun, 06 Nov 1994 08:49:37 GMT`. `Date.parse` alone accepts other text, such as `-1`, in a
* different way in each engine.
*/
const HTTP_DATE = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/;
/** A `Retry-After` value in seconds or as an HTTP date, in milliseconds from `now`. */
function retryAfterMs(value, now) {
	if (value === null) return void 0;
	const text = value.trim();
	if (/^\d+(\.\d+)?$/.test(text)) return Number(text) * 1e3;
	if (!HTTP_DATE.test(text)) return void 0;
	const date = Date.parse(text);
	return Number.isNaN(date) ? void 0 : Math.max(0, date - now);
}
/** Waits `ms`, or rejects with the reason of `signal` when it aborts. */
function sleep(ms, signal) {
	return new Promise((resolve, reject) => {
		if (signal?.aborted === true) {
			reject(signal.reason);
			return;
		}
		let handle;
		const onAbort = () => {
			clearTimeout(handle);
			reject(signal?.reason);
		};
		handle = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

// ../typescript/dist/runtime/http.js
/** A repeat of these methods is safe. */
const SAFE_METHODS = /* @__PURE__ */ new Set([
	"GET",
	"HEAD",
	"PUT",
	"DELETE"
]);
/** `setTimeout` fires at once above this value, so a longer timeout sets no timer. */
const MAX_TIMER_MS = 2 ** 31 - 1;
/** The largest `Idempotency-Key`, in UTF-8 bytes. */
const MAX_IDEMPOTENCY_KEY_BYTES = 255;
var HttpRuntime = class {
	#config;
	constructor(config) {
		this.#config = config;
	}
	request(operation, params, options) {
		return new APIPromise(this.#call(operation, params, options, (value) => value));
	}
	list(operation, params, options) {
		const itemField = operation.pagination?.itemField;
		if (itemField === void 0) throw new PierreError(`${operation.id} is not a list`);
		const first = { ...params };
		const firstOptions = copyOptions(options);
		const page = (value, response) => {
			const body = isRecord$1(value) ? value : {};
			const items = body[itemField];
			const nextCursor = body.next_cursor;
			return new Page({
				data: Array.isArray(items) ? items : [],
				has_more: body.has_more === true,
				next_cursor: typeof nextCursor === "string" ? nextCursor : void 0,
				body: value,
				response
			}, nextPage);
		};
		const nextPage = (cursor) => new APIPromise(this.#call(operation, {
			...first,
			cursor
		}, firstOptions, page));
		return new PagePromise(this.#call(operation, first, firstOptions, page));
	}
	async readToken(repo, options) {
		if (this.#config.credentials.fixed) throw new PierreError("A client with a fixed `token` cannot make a token for another repository. Give that token in the params.");
		const timeout = checkTimeout(options?.timeout ?? this.#config.timeout);
		const timer = new AbortController();
		const handle = timeout <= MAX_TIMER_MS ? setTimeout(() => {
			timer.abort();
		}, timeout) : void 0;
		const callerSignal = options?.signal;
		const signal = callerSignal === void 0 ? timer.signal : AbortSignal.any([callerSignal, timer.signal]);
		try {
			return await untilAborted(this.#config.credentials.token({
				scopes: ["git:read"],
				repo,
				ttl: 300,
				signal
			}), signal);
		} catch (error) {
			if (callerSignal?.aborted === true) throw callerSignal.reason;
			if (timer.signal.aborted) throw new APITimeoutError(`no token for \`${repo}\` within ${timeout} ms`, { cause: error });
			throw error;
		} finally {
			clearTimeout(handle);
		}
	}
	/** One call, which an `APIPromise` sends once. `result` gives the result of the response. */
	#call(operation, params, options, result) {
		const values = params instanceof Promise ? params.then((value) => ({ ...value })) : Promise.resolve({ ...params });
		const settings = copyOptions(options);
		return {
			send: async (firstUse) => this.#send(operation, await values, settings, firstUse),
			data: async (received) => result(received.read ? received.body : await decode(operation, received.response, settings?.signal), received.response),
			headers: (response) => declaredHeaders(operation, response)
		};
	}
	/** Sends the request with its retries, and returns the response of the last attempt. */
	async #send(operation, values, options, firstUse) {
		const refPolicies = checkRefPolicies(options?.refPolicies, "refPolicies") ?? this.#config.refPolicies ?? [];
		if (refPolicies.length > 0 && this.#config.credentials.fixed) throw new PierreError("A client with a fixed `token` cannot use `refPolicies`. Give `privateKey` or `getToken`.");
		const timeout = checkTimeout(options?.timeout ?? this.#config.timeout);
		const maxRetries = checkMaxRetries(options?.maxRetries ?? this.#config.maxRetries);
		const idempotencyKey = idempotencyKeyOf(operation, options?.idempotencyKey);
		if (operation.repoClaim && values.repo_name === void 0 && operation.body?.fields.includes("repo_name") === true) values.repo_name = crypto.randomUUID();
		const url = new URL(this.#config.baseUrl.replace(/\/+$/, "") + expandPath(operation, values));
		const headers = new Headers({
			"Pierre-Client": this.#config.client,
			Accept: operation.response.encoding === "json" ? "application/json" : "*/*"
		});
		for (const [name, value] of Object.entries(this.#config.defaultHeaders)) headers.set(name, value);
		for (const parameter of operation.parameters) {
			const value = values[parameter.field];
			if (value === void 0 || parameter.in === "path") continue;
			if (parameter.in === "query") for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(parameter.name, wireText(operation, parameter.field, item));
			else headers.set(parameter.name, wireText(operation, parameter.field, value));
		}
		let repo;
		if (operation.repoClaim) {
			if (typeof values.repo_name !== "string") throw new PierreError(`${operation.id} needs \`repo_name\``);
			repo = values.repo_name;
		}
		if (idempotencyKey !== void 0) headers.set("Idempotency-Key", idempotencyKey);
		const { body } = operation;
		const fields = body === null ? {} : pick$1(values, body.fields);
		const bodyFailure = {};
		let content;
		if (body?.encoding === "json" && (body.required || Object.keys(fields).length > 0)) {
			headers.set("Content-Type", "application/json");
			content = JSON.stringify(fields);
		} else if (body?.encoding === "ndjson") {
			headers.set("Content-Type", "application/x-ndjson");
			content = ndjsonStream(ndjsonLines(body.first, fields, values.chunks), bodyFailure);
		}
		const repeatable = !(content instanceof ReadableStream) && (SAFE_METHODS.has(operation.method) || idempotencyKey !== void 0);
		const request = {
			operation,
			url,
			headers,
			content,
			bodyFailure,
			token: {
				scopes: operation.scopes,
				repo,
				ttl: 300,
				...refPolicies.length > 0 ? { ref_policies: refPolicies } : {}
			},
			requestHeaders: options?.headers ?? {},
			timeout,
			signal: options?.signal,
			firstUse
		};
		for (let attempt = 0;; attempt++) {
			const outcome = await this.#attempt(request);
			if (outcome.ok) return outcome.received;
			if (!(repeatable && outcome.transient && attempt < maxRetries)) throw outcome.error;
			await sleep(retryDelay(outcome.retryAfter, attempt), options?.signal);
		}
	}
	/**
	* Gets the token and sends one attempt. The timeout and the caller's signal cover both steps.
	* It throws only when the caller aborts, the token or the body content fails, or the response
	* is not usable.
	*/
	async #attempt(request) {
		const { operation, timeout, signal: callerSignal } = request;
		const timer = new AbortController();
		const handle = timeout <= MAX_TIMER_MS ? setTimeout(() => {
			timer.abort();
		}, timeout) : void 0;
		const signal = callerSignal === void 0 ? timer.signal : AbortSignal.any([callerSignal, timer.signal]);
		let sent = false;
		try {
			const token = await untilAborted(this.#config.credentials.token({
				...request.token,
				signal
			}), signal);
			const headers = new Headers(request.headers);
			headers.set("Authorization", `Bearer ${token}`);
			for (const [name, value] of Object.entries(request.requestHeaders)) headers.set(name, value);
			const init = {
				method: operation.method,
				headers,
				signal
			};
			if (request.content !== void 0) init.body = request.content;
			if (request.content instanceof ReadableStream) init.duplex = "half";
			sent = true;
			const response = await this.#config.fetch(request.url, init);
			if (response.ok || response.status === 304 && operation.notModified) {
				const use = request.firstUse();
				if (operation.response.encoding === "json" && use !== "response") return {
					ok: true,
					received: {
						response,
						read: true,
						body: await readJson(operation, use === void 0 ? response.clone() : response)
					}
				};
				return {
					ok: true,
					received: {
						response,
						read: false
					}
				};
			}
			const body = await readBody(response);
			return {
				ok: false,
				error: apiError(response.status, body, response.headers),
				transient: transientStatus(response.status, problemCode(body)),
				retryAfter: response.headers.get("retry-after")
			};
		} catch (error) {
			if (callerSignal?.aborted === true) throw callerSignal.reason;
			if (timer.signal.aborted) return {
				ok: false,
				error: new APITimeoutError(`${operation.id}: no response within ${timeout} ms`, { cause: error }),
				transient: true,
				retryAfter: null
			};
			if (request.bodyFailure.error !== void 0) throw request.bodyFailure.error;
			if (!sent || error instanceof PierreError) throw error;
			return {
				ok: false,
				error: new APIConnectionError(`${operation.id}: ${String(error)}`, { cause: error }),
				transient: true,
				retryAfter: null
			};
		} finally {
			clearTimeout(handle);
		}
	}
};
/** A copy of the request options and their headers. */
/** A copy of the request options, their headers, and their ref policies. `#send` checks them. */
function copyOptions(options) {
	if (options === void 0) return void 0;
	const copy = { ...options };
	if (options.headers !== void 0) copy.headers = { ...options.headers };
	if (Array.isArray(options.refPolicies)) copy.refPolicies = options.refPolicies.map((rule) => typeof rule === "object" && rule !== null ? copyRule(rule) : rule);
	return copy;
}
function copyRule(rule) {
	const { ops } = rule;
	return Array.isArray(ops) ? {
		...rule,
		ops: [...ops]
	} : { ...rule };
}
/** The value of `promise`, or a rejection with the reason of `signal` when it aborts first. */
async function untilAborted(promise, signal) {
	signal.throwIfAborted();
	let onAbort;
	const aborted = new Promise((_resolve, reject) => {
		onAbort = () => {
			reject(signal.reason);
		};
		signal.addEventListener("abort", onAbort, { once: true });
	});
	try {
		return await Promise.race([promise, aborted]);
	} finally {
		if (onAbort !== void 0) signal.removeEventListener("abort", onAbort);
	}
}
function checkTimeout(timeout) {
	if (typeof timeout !== "number" || Number.isNaN(timeout) || timeout <= 0) throw new PierreError("`timeout` must be a number of milliseconds greater than 0.");
	return timeout;
}
function checkMaxRetries(maxRetries) {
	if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new PierreError("`maxRetries` must be a whole number, 0 or more.");
	return maxRetries;
}
/** The `Idempotency-Key` of a call: the caller's key, or a new UUID for an operation that accepts one. */
function idempotencyKeyOf(operation, key) {
	if (key === void 0) return operation.idempotencyKey ? crypto.randomUUID() : void 0;
	if (!operation.idempotencyKey) throw new PierreError(`${operation.id} does not accept an idempotency key.`);
	const size = new TextEncoder().encode(key).length;
	if (size === 0 || size > MAX_IDEMPOTENCY_KEY_BYTES) throw new PierreError(`\`idempotencyKey\` must have 1 to ${MAX_IDEMPOTENCY_KEY_BYTES} bytes of UTF-8.`);
	return key;
}
/** Puts the path parameters in the path. Each value is one segment, so `/` is `%2F`. */
function expandPath(operation, values) {
	return operation.path.replace(/\{([^}]+)\}/g, (_match, name) => {
		const parameter = operation.parameters.find((entry) => entry.in === "path" && entry.name === name);
		const value = parameter === void 0 ? void 0 : values[parameter.field];
		if (value === void 0 || value === null || value === "") throw new PierreError(`${operation.id} needs \`${parameter?.field ?? name}\``);
		const segment = encodeURIComponent(wireText(operation, parameter?.field ?? name, value));
		if (segment === "." || segment === "..") throw new PierreError(`${operation.id}: \`${parameter?.field ?? name}\` cannot be \`${segment}\``);
		return segment;
	});
}
/** The text of a path, query, or header value. The model allows only scalar parameters. */
function wireText(operation, field, value) {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	throw new PierreError(`${operation.id}: \`${field}\` must be a string, a number, or a boolean`);
}
/** The given fields. An `undefined` field is not sent, and `null` is. */
function pick$1(values, fields) {
	const result = {};
	for (const field of fields) if (values[field] !== void 0) result[field] = values[field];
	return result;
}
async function* ndjsonLines(first, fields, rest) {
	yield { [first]: fields };
	if (rest === void 0) return;
	if (!isIterable(rest)) throw new PierreError("`chunks` must be an iterable or an async iterable");
	yield* rest;
}
function isIterable(value) {
	return typeof value === "object" && value !== null && (Symbol.iterator in value || Symbol.asyncIterator in value);
}
/** The lines as an NDJSON stream. It records an error of `lines` in `failure`. */
function ndjsonStream(lines, failure) {
	const encoder = new TextEncoder();
	const iterator = lines[Symbol.asyncIterator]();
	return new ReadableStream({
		async pull(controller) {
			let line;
			let text;
			try {
				line = await iterator.next();
				text = line.done === true ? "" : `${JSON.stringify(line.value)}\n`;
			} catch (error) {
				failure.error ??= error;
				throw error;
			}
			if (line.done === true) controller.close();
			else controller.enqueue(encoder.encode(text));
		},
		async cancel(reason) {
			await iterator.return?.(reason);
		}
	});
}
async function readJson(operation, response) {
	const text = await response.text();
	try {
		return JSON.parse(text);
	} catch (error) {
		throw new PierreError(`${operation.id}: the response body is not JSON`, { cause: error });
	}
}
/** The result of a response whose body the attempt did not read. */
async function decode(operation, response, signal) {
	switch (operation.response.encoding) {
		case "json":
			if (response.bodyUsed) throw new PierreError(`${operation.id}: the caller read the body of the response, so the SDK cannot read the result`);
			try {
				return await readJson(operation, response);
			} catch (error) {
				if (signal?.aborted === true) throw signal.reason;
				if (error instanceof PierreError) throw error;
				throw new APIConnectionError(`${operation.id}: ${String(error)}`, { cause: error });
			}
		case "bytes": return response;
		case "none": return {
			status: response.status,
			headers: declaredHeaders(operation, response)
		};
		default: throw new PierreError(`${operation.id}: NDJSON responses are not supported yet`);
	}
}
/** The declared response headers that the response has, by field. */
function declaredHeaders(operation, response) {
	const headers = {};
	for (const header of operation.response.headers) {
		const value = response.headers.get(header.name);
		if (value !== null) headers[header.field] = value;
	}
	return headers;
}
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function readBody(response) {
	const text = await response.text().catch(() => "");
	if (text === "") return void 0;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

// ../typescript/dist/runtime/client.js
const DEFAULT_TIMEOUT_MS = 6e4;
const DEFAULT_MAX_RETRIES = 2;
/** A DNS label: the form of an organization name in its default hosts. */
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const VARIABLES = [
	"PIERRE_ORG",
	"PIERRE_PRIVATE_KEY",
	"PIERRE_PRIVATE_KEY_FILE",
	"PIERRE_TOKEN",
	"PIERRE_API_BASE_URL",
	"PIERRE_GIT_HOST"
];
const runtimes = /* @__PURE__ */ new WeakMap();
const clientSettings = /* @__PURE__ */ new WeakMap();
/** The settings that `withOptions` gives to the copy, by the options object of the copy. */
const inherited = /* @__PURE__ */ new WeakMap();
/** The transport of a client. The generated namespaces call it. */
function runtimeOf(client) {
	const runtime = runtimes.get(client);
	if (runtime === void 0) throw new PierreError("Give a client from `new PierreCore()` or `new Pierre()`.");
	return runtime;
}
/**
* The core client, with no namespaces. Give it to a namespace from a subpath, for example
* `new ReposNamespace(new PierreCore())` from `@pierre/sdk/repos`, so a bundle loads only that
* namespace. `new Pierre()` has every namespace.
*/
var PierreCore = class {
	/**
	* The settings of the client. Every top-level name other than `options` and `withOptions` is
	* free for an API namespace.
	*/
	options;
	constructor(options = {}) {
		const parent = inherited.get(options);
		const settings = parent === void 0 ? fromEnvironment(options) : withChanges(parent, options);
		const { credential } = settings;
		const org = settings.org ?? (credential.kind === "token" ? tokenIssuer(credential.token) : void 0);
		const label = org !== void 0 && HOST_LABEL.test(org) ? org : void 0;
		if (settings.baseUrl === void 0 && label === void 0) throw new PierreError(org === void 0 ? "Set `org` or PIERRE_ORG, or give `baseUrl`." : "The organization name is not a host label, so give `baseUrl`.");
		const { refPolicies } = settings;
		if (credential.kind === "token" && refPolicies !== void 0 && refPolicies.length > 0) throw new PierreError("A client with a fixed `token` cannot have `refPolicies`. Give `privateKey` or `getToken`.");
		const baseUrl = checkBaseUrl(settings.baseUrl ?? `https://api.${label}.code.storage`);
		const gitHost = settings.gitHost ?? (label === void 0 ? void 0 : `${label}.code.storage`);
		let credentials;
		if (credential.kind === "privateKey") {
			if (org === void 0) throw new PierreError("A private key needs `org` or PIERRE_ORG.");
			credentials = signerCredentials(org, credential.signer);
		} else if (credential.kind === "token") credentials = tokenCredentials(credential.token);
		else credentials = getTokenCredentials(credential.getToken);
		const fetchFunction = settings.fetch ?? globalThis.fetch.bind(globalThis);
		runtimes.set(this, new HttpRuntime({
			baseUrl,
			credentials,
			fetch: fetchFunction,
			client: `pierre-sdk-typescript/${VERSION}`,
			defaultHeaders: settings.defaultHeaders,
			timeout: settings.timeout,
			maxRetries: settings.maxRetries,
			refPolicies
		}));
		clientSettings.set(this, {
			...settings,
			org
		});
		registerClientKey(this, {
			org,
			signer: credential.kind === "privateKey" ? credential.signer : void 0,
			credentials
		});
		this.options = Object.freeze({
			org,
			baseUrl,
			gitHost,
			timeout: settings.timeout,
			maxRetries: settings.maxRetries,
			refPolicies
		});
	}
	/**
	* Returns a copy of the client with changed options. The copy keeps every option that
	* `changes` does not set, including the `org` of `options`, and does not read the environment
	* again. It keeps the credential, unless `changes` gives one. When `org` changes, the default
	* hosts follow it.
	*/
	withOptions(changes = {}) {
		const settings = clientSettings.get(this);
		if (settings === void 0) throw new PierreError("The client is not initialized.");
		const options = { ...changes };
		inherited.set(options, settings);
		const Client = this.constructor;
		return new Client(options);
	}
};
/** Checks that the base URL is an absolute `https` or `http` URL. */
function checkBaseUrl(baseUrl) {
	let protocol;
	try {
		protocol = new URL(baseUrl).protocol;
	} catch {
		protocol = void 0;
	}
	if (protocol !== "https:" && protocol !== "http:") throw new PierreError("`baseUrl` must be an absolute https URL, for example https://api.acme.code.storage.");
	return baseUrl;
}
function fromEnvironment(options) {
	const env = environment();
	return {
		org: options.org ?? env.PIERRE_ORG,
		baseUrl: options.baseUrl ?? env.PIERRE_API_BASE_URL,
		gitHost: options.gitHost ?? env.PIERRE_GIT_HOST,
		timeout: checkTimeout(options.timeout ?? DEFAULT_TIMEOUT_MS),
		maxRetries: checkMaxRetries(options.maxRetries ?? DEFAULT_MAX_RETRIES),
		defaultHeaders: options.defaultHeaders ?? {},
		fetch: options.fetch,
		refPolicies: checkRefPolicies(options.refPolicies, "refPolicies"),
		credential: credentialOf(options) ?? environmentCredential(env)
	};
}
function withChanges(parent, changes) {
	return {
		org: changes.org ?? parent.org,
		baseUrl: changes.baseUrl ?? parent.baseUrl,
		gitHost: changes.gitHost ?? parent.gitHost,
		timeout: checkTimeout(changes.timeout ?? parent.timeout),
		maxRetries: checkMaxRetries(changes.maxRetries ?? parent.maxRetries),
		defaultHeaders: changes.defaultHeaders ?? parent.defaultHeaders,
		fetch: changes.fetch ?? parent.fetch,
		refPolicies: checkRefPolicies(changes.refPolicies, "refPolicies") ?? parent.refPolicies,
		credential: credentialOf(changes) ?? parent.credential
	};
}
/** The credential in the options, or `undefined`. More than one is an error. */
function credentialOf(options) {
	const { privateKey, token, getToken } = options;
	if ([
		privateKey,
		token,
		getToken
	].filter((value) => value !== void 0).length > 1) throw new PierreError("Give only one of `privateKey`, `token`, and `getToken`.");
	if (privateKey !== void 0) return {
		kind: "privateKey",
		signer: keySigner(() => Promise.resolve(privateKey))
	};
	if (token !== void 0) {
		if (token === "") throw new PierreError("`token` must not be empty.");
		return {
			kind: "token",
			token
		};
	}
	if (getToken !== void 0) {
		if (typeof getToken !== "function") throw new PierreError("`getToken` must be a function.");
		return {
			kind: "getToken",
			getToken
		};
	}
}
function environmentCredential(env) {
	const { PIERRE_TOKEN: token, PIERRE_PRIVATE_KEY: privateKey } = env;
	const keyFile = env.PIERRE_PRIVATE_KEY_FILE;
	if (token !== void 0) return {
		kind: "token",
		token
	};
	if (privateKey !== void 0) return {
		kind: "privateKey",
		signer: keySigner(() => Promise.resolve(privateKey))
	};
	if (keyFile !== void 0) return {
		kind: "privateKey",
		signer: keySigner(() => readKeyFile$1(keyFile))
	};
	throw new PierreError("Give `privateKey`, `token`, or `getToken`, or set PIERRE_PRIVATE_KEY, PIERRE_PRIVATE_KEY_FILE, or PIERRE_TOKEN.");
}
/** The Pierre variables of the process. An empty value counts as not set. */
function environment() {
	const env = globalThis.process?.env ?? {};
	const result = {};
	for (const name of VARIABLES) {
		const value = env[name];
		if (value !== void 0 && value !== "") result[name] = value;
	}
	return result;
}
function isKeyFileReader(value) {
	return typeof value === "object" && value !== null && "readFile" in value && typeof value.readFile === "function";
}
/**
* Reads the key file through `process.getBuiltinModule`, so the package has no `node:` import
* and a browser or edge bundle stays free of Node code.
*/
async function readKeyFile$1(path) {
	const fs = globalThis.process?.getBuiltinModule?.("node:fs/promises");
	if (!isKeyFileReader(fs)) throw new PierreError("PIERRE_PRIVATE_KEY_FILE needs a runtime with `node:fs`. Set PIERRE_PRIVATE_KEY instead.");
	try {
		return await fs.readFile(path, "utf8");
	} catch (error) {
		throw new PierreError(`Cannot read PIERRE_PRIVATE_KEY_FILE (${path}).`, { cause: error });
	}
}

// ../typescript/dist/generated/operations/meta.js
const metaGet = {
	id: "meta.get",
	method: "GET",
	path: "/api/meta",
	parameters: [],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["org:read"],
	repoClaim: false,
	pagination: null,
	idempotencyKey: false
};

// ../typescript/dist/generated/namespaces/meta.js
/**
* The `meta` namespace. `new Pierre()` has it as `pierre.meta`. To load only this namespace, build it on a core client: `new MetaNamespace(new PierreCore())`.
*/
var MetaNamespace = class {
	#runtime;
	constructor(client) {
		const runtime = runtimeOf(client);
		this.#runtime = runtime;
	}
	/**
	* Get Organization Metadata
	*
	* Return the cloud provider, region, and public inbound IP addresses of the Code Storage cluster that serves the current organisation. Addresses are listed separately for Git over HTTPS and for the HTTP API; allow them in firewall rules that restrict outbound traffic to Code Storage. The lists change when the cluster's ingress changes, so poll this endpoint rather than copying them once.
	*
	* Scope: `org:read`.
	*
	* Catalog ID `meta.get`: `GET /api/meta`.
	*
	* Docs: search for `meta.get` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	get(params = {}, options) {
		return this.#runtime.request(metaGet, params, options);
	}
};

// ../typescript/dist/runtime/bytes.js
/** The gateway limits a decoded chunk to 4 MiB. */
const MAX_CHUNK_BYTES = 4194304;
/**
* The bytes of one chunk of content. A string gives its UTF-8 bytes. A chunk of another type
* throws, because JavaScript code and loosely typed streams can yield one.
*/
function chunkBytes(chunk) {
	if (typeof chunk === "string") return new TextEncoder().encode(chunk);
	if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
	if (ArrayBuffer.isView(chunk)) return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
	throw new PierreError(`Each chunk of \`content\` must be a string, an ArrayBuffer, or an ArrayBufferView, not ${typeName(chunk)}.`);
}
function typeName(value) {
	if (value === null) return "null";
	if (typeof value === "object") return value.constructor?.name ?? "object";
	return typeof value;
}
async function* pieces(content) {
	if (typeof content === "string" || content instanceof ArrayBuffer || ArrayBuffer.isView(content)) yield chunkBytes(content);
	else if (content instanceof Blob) yield* pieces(content.stream());
	else if (content instanceof ReadableStream) {
		const reader = content.getReader();
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) return;
				let bytes;
				try {
					bytes = chunkBytes(value);
				} catch (error) {
					await reader.cancel(error);
					throw error;
				}
				yield bytes;
			}
		} finally {
			reader.releaseLock();
		}
	} else if (typeof content === "object" && content !== null && (Symbol.iterator in content || Symbol.asyncIterator in content)) for await (const chunk of content) yield chunkBytes(chunk);
	else throw new PierreError(`\`content\` must be a string, an ArrayBuffer, an ArrayBufferView, a Blob, a ReadableStream, or an iterable of chunks, not ${typeName(content)}.`);
}
/**
* Splits content into chunks of at most `MAX_CHUNK_BYTES`, and joins small pieces up to that
* size. The last chunk has `eof: true`, and empty content gives one empty chunk.
*/
async function* chunks(content) {
	let parts = [];
	let size = 0;
	const take = () => {
		const [only] = parts;
		const bytes = parts.length === 1 && only !== void 0 ? only : join$1(parts, size);
		parts = [];
		size = 0;
		return bytes;
	};
	for await (const piece of pieces(content)) {
		let offset = 0;
		while (offset < piece.length) {
			if (size === 4194304) yield {
				bytes: take(),
				eof: false
			};
			const length = Math.min(piece.length - offset, MAX_CHUNK_BYTES - size);
			parts.push(piece.slice(offset, offset + length));
			size += length;
			offset += length;
		}
	}
	yield {
		bytes: take(),
		eof: true
	};
}
function join$1(parts, size) {
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const part of parts) {
		bytes.set(part, offset);
		offset += part.length;
	}
	return bytes;
}

// ../typescript/dist/helpers/commits.js
function createCommit(runtime, operation, params, options) {
	return runtime.request(operation, commitWireParams(params), options);
}
/** The wire params of a commit. The SDK reads all of `files` before the request. */
async function commitWireParams(params) {
	const { files, ...metadata } = params;
	const entries = [];
	for await (const file of files) {
		const operationName = file.operation ?? "upsert";
		if (operationName === "upsert" && file.content === void 0) throw new PierreError(`The file ${file.path} needs \`content\`.`);
		if (operationName === "delete" && file.content !== void 0) throw new PierreError(`The delete of ${file.path} must not have \`content\`.`);
		entries.push({
			file: {
				...file,
				...copyBytes(file.content)
			},
			contentId: crypto.randomUUID()
		});
	}
	const wireFiles = entries.map(({ file, contentId }) => {
		const operationName = file.operation ?? "upsert";
		return {
			path: file.path,
			content_id: contentId,
			operation: operationName,
			...operationName === "upsert" ? { mode: file.mode ?? "100644" } : {}
		};
	});
	async function* blobChunks() {
		for (const { file, contentId } of entries) {
			if (file.content === void 0) continue;
			const content = typeof file.content === "function" ? await file.content() : file.content;
			for await (const chunk of chunks(content)) yield { blob_chunk: {
				content_id: contentId,
				data: base64(chunk.bytes),
				eof: chunk.eof
			} };
		}
	}
	return {
		...metadata,
		files: wireFiles,
		chunks: blobChunks()
	};
}
/** A copy of byte-array content, which the caller can change after it yields the file. */
function copyBytes(content) {
	if (content instanceof ArrayBuffer || ArrayBuffer.isView(content)) return { content: chunkBytes(content).slice() };
	return {};
}
function createCommitFromDiff(runtime, operation, params, options) {
	const { diff, ...metadata } = params;
	async function* diffChunks() {
		for await (const chunk of chunks(diff)) yield { diff_chunk: {
			data: base64(chunk.bytes),
			eof: chunk.eof
		} };
	}
	const wire = {
		...metadata,
		chunks: diffChunks()
	};
	return runtime.request(operation, wire, options);
}

// ../typescript/dist/helpers/repos.js
function createRepo(runtime, operation, params, options) {
	const source = params.base_repo;
	if (source === void 0 || source.provider !== void 0 || source.auth?.token !== void 0) return runtime.request(operation, params, options);
	return runtime.request(operation, withSourceToken(runtime, params, source, options), options);
}
/** The params with a `git:read` token for the source repository of a copy. */
async function withSourceToken(runtime, params, source, options) {
	const token = await runtime.readToken(source.name, options);
	return {
		...params,
		base_repo: {
			...source,
			auth: {
				...source.auth,
				token
			}
		}
	};
}

// ../typescript/dist/generated/operations/repos.js
const reposArchiveGet = {
	id: "repos.archive.get",
	method: "POST",
	path: "/api/repos/{repo_name}/archive",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: {
		encoding: "json",
		required: false,
		fields: [
			"archive",
			"exclude_globs",
			"include_globs",
			"max_blob_size",
			"ref"
		]
	},
	response: {
		encoding: "bytes",
		headers: [{
			name: "Cache-Control",
			field: "cache_control"
		}, {
			name: "Content-Disposition",
			field: "content_disposition"
		}]
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposBlameGet = {
	id: "repos.blame.get",
	method: "GET",
	path: "/api/repos/{repo_name}/blame",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "detect_moves",
			field: "detect_moves"
		},
		{
			in: "query",
			name: "ephemeral",
			field: "ephemeral"
		},
		{
			in: "query",
			name: "path",
			field: "path"
		},
		{
			in: "query",
			name: "range",
			field: "range"
		},
		{
			in: "query",
			name: "ref",
			field: "ref"
		}
	],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposBranchesCreate = {
	id: "repos.branches.create",
	method: "POST",
	path: "/api/repos/{repo_name}/branches/create",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: {
		encoding: "json",
		required: true,
		fields: [
			"base_branch",
			"base_is_ephemeral",
			"base_ref",
			"expected_target_sha",
			"force",
			"preferred_base",
			"target_branch",
			"target_is_ephemeral"
		]
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposBranchesDelete = {
	id: "repos.branches.delete",
	method: "DELETE",
	path: "/api/repos/{repo_name}/branches",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "ephemeral",
			field: "ephemeral"
		},
		{
			in: "query",
			name: "target_branch",
			field: "target_branch"
		}
	],
	body: {
		encoding: "json",
		required: false,
		fields: ["name"]
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposBranchesGet = {
	id: "repos.branches.get",
	method: "GET",
	path: "/api/repos/{repo_name}/branch",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "ephemeral",
			field: "ephemeral"
		},
		{
			in: "query",
			name: "name",
			field: "name"
		}
	],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposBranchesList = {
	id: "repos.branches.list",
	method: "GET",
	path: "/api/repos/{repo_name}/branches",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "cursor",
			field: "cursor"
		},
		{
			in: "query",
			name: "ephemeral",
			field: "ephemeral"
		},
		{
			in: "query",
			name: "limit",
			field: "limit"
		}
	],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: { itemField: "branches" },
	idempotencyKey: false
};
const reposCommitsCreate = {
	id: "repos.commits.create",
	method: "POST",
	path: "/api/repos/{repo_name}/commit-pack",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: {
		encoding: "ndjson",
		first: "metadata",
		fields: [
			"author",
			"base_branch",
			"base_is_ephemeral",
			"commit_message",
			"committer",
			"ephemeral",
			"ephemeral_base",
			"expected_head_sha",
			"expected_target_sha",
			"files",
			"target_branch",
			"target_is_ephemeral"
		],
		rest: true
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposCommitsCreateFromDiff = {
	id: "repos.commits.createFromDiff",
	method: "POST",
	path: "/api/repos/{repo_name}/diff-commit",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: {
		encoding: "ndjson",
		first: "metadata",
		fields: [
			"author",
			"base_branch",
			"base_is_ephemeral",
			"commit_message",
			"committer",
			"ephemeral",
			"ephemeral_base",
			"expected_head_sha",
			"expected_target_sha",
			"target_branch",
			"target_is_ephemeral"
		],
		rest: true
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposCommitsGet = {
	id: "repos.commits.get",
	method: "GET",
	path: "/api/repos/{repo_name}/commit",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "ref",
			field: "ref"
		},
		{
			in: "query",
			name: "sha",
			field: "sha"
		}
	],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposCommitsList = {
	id: "repos.commits.list",
	method: "GET",
	path: "/api/repos/{repo_name}/commits",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "branch",
			field: "branch"
		},
		{
			in: "query",
			name: "cursor",
			field: "cursor"
		},
		{
			in: "query",
			name: "ephemeral",
			field: "ephemeral"
		},
		{
			in: "query",
			name: "limit",
			field: "limit"
		},
		{
			in: "query",
			name: "path",
			field: "path"
		},
		{
			in: "query",
			name: "ref",
			field: "ref"
		}
	],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: { itemField: "commits" },
	idempotencyKey: false
};
const reposCommitsRestore = {
	id: "repos.commits.restore",
	method: "POST",
	path: "/api/repos/{repo_name}/restore-commit",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: {
		encoding: "ndjson",
		first: "metadata",
		fields: [
			"author",
			"base_ref",
			"commit_message",
			"committer",
			"expected_head_sha",
			"expected_target_sha",
			"target_branch",
			"target_commit_sha"
		],
		rest: false
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposCreate = {
	id: "repos.create",
	method: "POST",
	path: "/api/repos",
	parameters: [],
	body: {
		encoding: "json",
		required: false,
		fields: [
			"base_repo",
			"default_branch",
			"repo_name",
			"upstream"
		]
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["repo:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposDelete = {
	id: "repos.delete",
	method: "DELETE",
	path: "/api/repos/{repo_name}",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["repo:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposDiffGet = {
	id: "repos.diff.get",
	method: "GET",
	path: "/api/repos/{repo_name}/diff",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "baseSha",
			field: "baseSha"
		},
		{
			in: "query",
			name: "base_is_ephemeral",
			field: "base_is_ephemeral"
		},
		{
			in: "query",
			name: "base_ref",
			field: "base_ref"
		},
		{
			in: "query",
			name: "gitApplyCompatible",
			field: "gitApplyCompatible"
		},
		{
			in: "query",
			name: "git_apply_compatible",
			field: "git_apply_compatible"
		},
		{
			in: "query",
			name: "path",
			field: "path"
		},
		{
			in: "query",
			name: "ref",
			field: "ref"
		},
		{
			in: "query",
			name: "ref_is_ephemeral",
			field: "ref_is_ephemeral"
		},
		{
			in: "query",
			name: "sha",
			field: "sha"
		}
	],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposFilesGet = {
	id: "repos.files.get",
	method: "GET",
	path: "/api/repos/{repo_name}/file",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "ephemeral",
			field: "ephemeral"
		},
		{
			in: "query",
			name: "path",
			field: "path"
		},
		{
			in: "query",
			name: "ref",
			field: "ref"
		},
		{
			in: "header",
			name: "If-Match",
			field: "if_match"
		},
		{
			in: "header",
			name: "If-Modified-Since",
			field: "if_modified_since"
		},
		{
			in: "header",
			name: "If-None-Match",
			field: "if_none_match"
		},
		{
			in: "header",
			name: "If-Range",
			field: "if_range"
		},
		{
			in: "header",
			name: "If-Unmodified-Since",
			field: "if_unmodified_since"
		},
		{
			in: "header",
			name: "Range",
			field: "range"
		}
	],
	body: null,
	response: {
		encoding: "bytes",
		headers: [
			{
				name: "Accept-Ranges",
				field: "accept_ranges"
			},
			{
				name: "Content-Length",
				field: "content_length"
			},
			{
				name: "Content-Range",
				field: "content_range"
			},
			{
				name: "Content-Type",
				field: "content_type"
			},
			{
				name: "ETag",
				field: "etag"
			},
			{
				name: "Last-Modified",
				field: "last_modified"
			},
			{
				name: "X-Blob-Sha",
				field: "x_blob_sha"
			},
			{
				name: "X-Last-Commit-Sha",
				field: "x_last_commit_sha"
			}
		]
	},
	notModified: true,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposFilesList = {
	id: "repos.files.list",
	method: "GET",
	path: "/api/repos/{repo_name}/files",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "cursor",
			field: "cursor"
		},
		{
			in: "query",
			name: "ephemeral",
			field: "ephemeral"
		},
		{
			in: "query",
			name: "limit",
			field: "limit"
		},
		{
			in: "query",
			name: "path",
			field: "path"
		},
		{
			in: "query",
			name: "recursive",
			field: "recursive"
		},
		{
			in: "query",
			name: "ref",
			field: "ref"
		}
	],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: { itemField: "entries" },
	idempotencyKey: false
};
const reposFilesMetadataGet = {
	id: "repos.files.metadata.get",
	method: "HEAD",
	path: "/api/repos/{repo_name}/file",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "ephemeral",
			field: "ephemeral"
		},
		{
			in: "query",
			name: "path",
			field: "path"
		},
		{
			in: "query",
			name: "ref",
			field: "ref"
		},
		{
			in: "header",
			name: "If-Match",
			field: "if_match"
		},
		{
			in: "header",
			name: "If-Modified-Since",
			field: "if_modified_since"
		},
		{
			in: "header",
			name: "If-None-Match",
			field: "if_none_match"
		},
		{
			in: "header",
			name: "If-Range",
			field: "if_range"
		},
		{
			in: "header",
			name: "If-Unmodified-Since",
			field: "if_unmodified_since"
		},
		{
			in: "header",
			name: "Range",
			field: "range"
		}
	],
	body: null,
	response: {
		encoding: "none",
		headers: [
			{
				name: "Accept-Ranges",
				field: "accept_ranges"
			},
			{
				name: "Content-Length",
				field: "content_length"
			},
			{
				name: "Content-Range",
				field: "content_range"
			},
			{
				name: "Content-Type",
				field: "content_type"
			},
			{
				name: "ETag",
				field: "etag"
			},
			{
				name: "Last-Modified",
				field: "last_modified"
			},
			{
				name: "X-Blob-Sha",
				field: "x_blob_sha"
			},
			{
				name: "X-Last-Commit-Sha",
				field: "x_last_commit_sha"
			}
		]
	},
	notModified: true,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposFilesMetadataList = {
	id: "repos.files.metadata.list",
	method: "GET",
	path: "/api/repos/{repo_name}/files/metadata",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "cursor",
			field: "cursor"
		},
		{
			in: "query",
			name: "ephemeral",
			field: "ephemeral"
		},
		{
			in: "query",
			name: "limit",
			field: "limit"
		},
		{
			in: "query",
			name: "path",
			field: "path"
		},
		{
			in: "query",
			name: "recursive",
			field: "recursive"
		},
		{
			in: "query",
			name: "ref",
			field: "ref"
		}
	],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: { itemField: "files" },
	idempotencyKey: false
};
const reposGet = {
	id: "repos.get",
	method: "GET",
	path: "/api/repos/{repo_name}",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposGitCredentialsCreate = {
	id: "repos.gitCredentials.create",
	method: "POST",
	path: "/api/repos/{repo_name}/git-credentials",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: {
		encoding: "json",
		required: true,
		fields: ["password", "username"]
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["repo:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposGitCredentialsDelete = {
	id: "repos.gitCredentials.delete",
	method: "DELETE",
	path: "/api/repos/{repo_name}/git-credentials/{git_credential_id}",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}, {
		in: "path",
		name: "git_credential_id",
		field: "git_credential_id"
	}],
	body: null,
	response: {
		encoding: "none",
		headers: []
	},
	notModified: false,
	scopes: ["repo:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposGitCredentialsUpdate = {
	id: "repos.gitCredentials.update",
	method: "PUT",
	path: "/api/repos/{repo_name}/git-credentials/{git_credential_id}",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}, {
		in: "path",
		name: "git_credential_id",
		field: "git_credential_id"
	}],
	body: {
		encoding: "json",
		required: true,
		fields: ["password", "username"]
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["repo:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposGrep = {
	id: "repos.grep",
	method: "POST",
	path: "/api/repos/{repo_name}/grep",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: {
		encoding: "json",
		required: true,
		fields: [
			"context",
			"ephemeral",
			"file_filters",
			"limits",
			"pagination",
			"paths",
			"query",
			"ref",
			"rev"
		]
	},
	response: {
		encoding: "json",
		headers: [{
			name: "X-Cache",
			field: "x_cache"
		}]
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposList = {
	id: "repos.list",
	method: "GET",
	path: "/api/repos",
	parameters: [
		{
			in: "query",
			name: "cursor",
			field: "cursor"
		},
		{
			in: "query",
			name: "limit",
			field: "limit"
		},
		{
			in: "query",
			name: "prefix",
			field: "prefix"
		},
		{
			in: "query",
			name: "q",
			field: "q"
		}
	],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["org:read"],
	repoClaim: false,
	pagination: { itemField: "repos" },
	idempotencyKey: false
};
const reposMerge = {
	id: "repos.merge",
	method: "POST",
	path: "/api/repos/{repo_name}/merge",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: {
		encoding: "json",
		required: true,
		fields: [
			"allow_unrelated_histories",
			"author",
			"commit_message",
			"committer",
			"expected_source_sha",
			"expected_target_sha",
			"source_branch",
			"source_is_ephemeral",
			"source_ref",
			"squash",
			"strategy",
			"target_branch",
			"target_is_ephemeral"
		]
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposNotesAppend = {
	id: "repos.notes.append",
	method: "POST",
	path: "/api/repos/{repo_name}/notes/append",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: {
		encoding: "json",
		required: true,
		fields: [
			"author",
			"expected_notes_ref_sha",
			"expected_ref_sha",
			"note",
			"notes_ref",
			"object_ref",
			"ref",
			"sha"
		]
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposNotesCreate = {
	id: "repos.notes.create",
	method: "POST",
	path: "/api/repos/{repo_name}/notes",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: {
		encoding: "json",
		required: true,
		fields: [
			"action",
			"author",
			"expected_notes_ref_sha",
			"expected_ref_sha",
			"note",
			"notes_ref",
			"object_ref",
			"ref",
			"sha"
		]
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposNotesDelete = {
	id: "repos.notes.delete",
	method: "DELETE",
	path: "/api/repos/{repo_name}/notes",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "expected_notes_ref_sha",
			field: "expected_notes_ref_sha"
		},
		{
			in: "query",
			name: "notes_ref",
			field: "notes_ref"
		},
		{
			in: "query",
			name: "object_ref",
			field: "object_ref"
		}
	],
	body: {
		encoding: "json",
		required: false,
		fields: [
			"action",
			"author",
			"expected_ref_sha",
			"note",
			"ref",
			"sha"
		]
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposNotesGet = {
	id: "repos.notes.get",
	method: "GET",
	path: "/api/repos/{repo_name}/notes",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "notes_ref",
			field: "notes_ref"
		},
		{
			in: "query",
			name: "object_ref",
			field: "object_ref"
		},
		{
			in: "query",
			name: "ref",
			field: "ref"
		},
		{
			in: "query",
			name: "sha",
			field: "sha"
		}
	],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposNotesRefsList = {
	id: "repos.notes.refs.list",
	method: "GET",
	path: "/api/repos/{repo_name}/notes/refs",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "cursor",
			field: "cursor"
		},
		{
			in: "query",
			name: "limit",
			field: "limit"
		},
		{
			in: "query",
			name: "prefix",
			field: "prefix"
		}
	],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: { itemField: "refs" },
	idempotencyKey: false
};
const reposPreviewMerge = {
	id: "repos.previewMerge",
	method: "GET",
	path: "/api/repos/{repo_name}/merge/preview",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "include_content",
			field: "include_content"
		},
		{
			in: "query",
			name: "source_branch",
			field: "source_branch"
		},
		{
			in: "query",
			name: "source_is_ephemeral",
			field: "source_is_ephemeral"
		},
		{
			in: "query",
			name: "target_branch",
			field: "target_branch"
		},
		{
			in: "query",
			name: "target_is_ephemeral",
			field: "target_is_ephemeral"
		}
	],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposTagsCreate = {
	id: "repos.tags.create",
	method: "POST",
	path: "/api/repos/{repo_name}/tags",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: {
		encoding: "json",
		required: true,
		fields: [
			"name",
			"ref",
			"target"
		]
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposTagsDelete = {
	id: "repos.tags.delete",
	method: "DELETE",
	path: "/api/repos/{repo_name}/tags/{tag_name}",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}, {
		in: "path",
		name: "tag_name",
		field: "tag_name"
	}],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read", "git:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposTagsGet = {
	id: "repos.tags.get",
	method: "GET",
	path: "/api/repos/{repo_name}/tag",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}, {
		in: "query",
		name: "name",
		field: "name"
	}],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposTagsList = {
	id: "repos.tags.list",
	method: "GET",
	path: "/api/repos/{repo_name}/tags",
	parameters: [
		{
			in: "path",
			name: "repo_name",
			field: "repo_name"
		},
		{
			in: "query",
			name: "cursor",
			field: "cursor"
		},
		{
			in: "query",
			name: "limit",
			field: "limit"
		}
	],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:read"],
	repoClaim: true,
	pagination: { itemField: "tags" },
	idempotencyKey: false
};
const reposUpdate = {
	id: "repos.update",
	method: "PATCH",
	path: "/api/repos/{repo_name}",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: {
		encoding: "json",
		required: true,
		fields: ["default_branch"]
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["repo:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposUpstreamDelete = {
	id: "repos.upstream.delete",
	method: "DELETE",
	path: "/api/repos/{repo_name}/upstream",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: null,
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["repo:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};
const reposUpstreamPull = {
	id: "repos.upstream.pull",
	method: "POST",
	path: "/api/repos/{repo_name}/upstream/pull",
	parameters: [{
		in: "path",
		name: "repo_name",
		field: "repo_name"
	}],
	body: {
		encoding: "json",
		required: false,
		fields: ["after", "ref"]
	},
	response: {
		encoding: "json",
		headers: []
	},
	notModified: false,
	scopes: ["git:write"],
	repoClaim: true,
	pagination: null,
	idempotencyKey: false
};

// ../typescript/dist/generated/namespaces/repos.js
/** The `repos.archive` namespace. */
var ReposArchiveNamespace = class {
	#runtime;
	constructor(runtime) {
		this.#runtime = runtime;
	}
	/**
	* Archive
	*
	* Download a repository snapshot without cloning the repo. This is useful for packaging docs, examples, or release artefacts directly from a branch, tag, or commit.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.archive.get`: `POST /api/repos/{repo_name}/archive`.
	*
	* Docs: search for `repos.archive.get` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	get(params, options) {
		return this.#runtime.request(reposArchiveGet, params, options);
	}
};
/** The `repos.blame` namespace. */
var ReposBlameNamespace = class {
	#runtime;
	constructor(runtime) {
		this.#runtime = runtime;
	}
	/**
	* Blame
	*
	* Return per-line blame metadata for a file at a branch, tag, or commit. Supports `git blame -L`-style range filters and rename/copy detection for callers building IDE blame views or audit tooling.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.blame.get`: `GET /api/repos/{repo_name}/blame`.
	*
	* Docs: search for `repos.blame.get` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	get(params, options) {
		return this.#runtime.request(reposBlameGet, params, options);
	}
};
/** The `repos.branches` namespace. */
var ReposBranchesNamespace = class {
	#runtime;
	constructor(runtime) {
		this.#runtime = runtime;
	}
	/**
	* Create Branch
	*
	* Create a new branch from an existing branch or ref. This is useful for agent workflows, ephemeral previews, or server-side automation where you do not want to clone the repo first. The base ref must exist. A new empty repository has no branch until its first commit, so the request returns `404`.
	*
	* Scope: `git:write` on the repository.
	*
	* Catalog ID `repos.branches.create`: `POST /api/repos/{repo_name}/branches/create`.
	*
	* Docs: search for `repos.branches.create` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	create(params, options) {
		return this.#runtime.request(reposBranchesCreate, params, options);
	}
	/**
	* Delete Branch
	*
	* Delete a branch from the repository. Name the branch with the `target_branch` and `ephemeral` query parameters. The server resolves the current branch tip before deleting, so the caller does not need the branch SHA. The default branch is protected and cannot be deleted through this endpoint.
	*
	* Scope: `git:write` on the repository.
	*
	* Catalog ID `repos.branches.delete`: `DELETE /api/repos/{repo_name}/branches`.
	*
	* Docs: search for `repos.branches.delete` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	delete(params, options) {
		return this.#runtime.request(reposBranchesDelete, params, options);
	}
	/**
	* Get Branch
	*
	* Get one branch by its exact short name. The response omits list pagination fields. A new empty repository has no branch until its first commit, so the request returns `404`.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.branches.get`: `GET /api/repos/{repo_name}/branch`.
	*
	* Docs: search for `repos.branches.get` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	get(params, options) {
		return this.#runtime.request(reposBranchesGet, params, options);
	}
	/**
	* List Branches
	*
	* List branches in the repository with cursor pagination. Use this to build branch selectors, review tools, or sync jobs without shelling out to Git. A new empty repository has no branch until its first commit, so its list is empty.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.branches.list`: `GET /api/repos/{repo_name}/branches`.
	*
	* Docs: search for `repos.branches.list` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	list(params, options) {
		return this.#runtime.list(reposBranchesList, params, options);
	}
};
/** The `repos.commits` namespace. */
var ReposCommitsNamespace = class {
	#runtime;
	constructor(runtime) {
		this.#runtime = runtime;
	}
	/**
	* Create Commit from Files
	*
	* Create a commit by streaming file operations directly to the service. This is designed for automation, AI agents, and other workflows that need atomic Git writes without running a local Git process.
	*
	* Scope: `git:write` on the repository.
	*
	* Catalog ID `repos.commits.create`: `POST /api/repos/{repo_name}/commit-pack`.
	*
	* Docs: search for `repos.commits.create` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	create(params, options) {
		return createCommit(this.#runtime, reposCommitsCreate, params, options);
	}
	/**
	* Create Commit from Diff
	*
	* Create a commit by streaming a Git patch instead of individual file blobs. Use this when your workflow already produces unified diffs or generated patches.
	*
	* Scope: `git:write` on the repository.
	*
	* Catalog ID `repos.commits.createFromDiff`: `POST /api/repos/{repo_name}/diff-commit`.
	*
	* Docs: search for `repos.commits.createFromDiff` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	createFromDiff(params, options) {
		return createCommitFromDiff(this.#runtime, reposCommitsCreateFromDiff, params, options);
	}
	/**
	* Get Commit
	*
	* Resolve a branch name, short SHA, or full SHA to a commit and return the same metadata shape used in commit listings. Use this when you need commit details without computing a diff.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.commits.get`: `GET /api/repos/{repo_name}/commit`.
	*
	* Docs: search for `repos.commits.get` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	get(params, options) {
		return this.#runtime.request(reposCommitsGet, params, options);
	}
	/**
	* List Commits
	*
	* List commit history for the repository default branch or for an explicit branch. Results are cursor-paginated and ordered by commit date, newest first. Set `path` to restrict the history to commits that modified a specific file or subtree.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.commits.list`: `GET /api/repos/{repo_name}/commits`.
	*
	* Docs: search for `repos.commits.list` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	list(params, options) {
		return this.#runtime.list(reposCommitsList, params, options);
	}
	/**
	* Restore Commit
	*
	* Create a new commit that resets a branch back to a specific commit SHA while preserving normal Git history.
	*
	* Ref-level outcomes are reported in `result.status` and `result.success`, not by the status code alone, and failures raised by the restore itself come back in that same restore-result body. The problem-details schemas below describe gateway-level rejections such as `401`, `403` and `429`.
	*
	* Scope: `git:write` on the repository.
	*
	* Catalog ID `repos.commits.restore`: `POST /api/repos/{repo_name}/restore-commit`.
	*
	* Docs: search for `repos.commits.restore` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	restore(params, options) {
		return this.#runtime.request(reposCommitsRestore, params, options);
	}
};
/** The `repos.diff` namespace. */
var ReposDiffNamespace = class {
	#runtime;
	constructor(runtime) {
		this.#runtime = runtime;
	}
	/**
	* Get Commit Diff
	*
	* Get the diff for a commit, optionally relative to a specific base commit. Repeated `path` parameters narrow the diff to selected files or directories.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.diff.get`: `GET /api/repos/{repo_name}/diff`.
	*
	* Docs: search for `repos.diff.get` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	get(params, options) {
		return this.#runtime.request(reposDiffGet, params, options);
	}
};
/** The `repos.files.metadata` namespace. */
var ReposFilesMetadataNamespace = class {
	#runtime;
	constructor(runtime) {
		this.#runtime = runtime;
	}
	/**
	* Get File Headers
	*
	* Return file metadata headers for a repository file without streaming the file body. Supports byte ranges, ETag validators, and Last-Modified conditionals. Use `ref` to inspect a branch, tag, or commit without cloning the repo locally.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.files.metadata.get`: `HEAD /api/repos/{repo_name}/file`.
	*
	* Docs: search for `repos.files.metadata.get` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	get(params, options) {
		return this.#runtime.request(reposFilesMetadataGet, params, options);
	}
	/**
	* List Files with Metadata
	*
	* Return a recursive file tree together with per-file commit metadata in one request. Each file also includes a derived `type` field for symmetry with `/files`.
	*
	* The server reads the last commit of each file under `path`, also when the call sends a `limit` or a `cursor`. When those files have more than 50,000 distinct last commits, the call fails with a 429 response, and a retry gets the same response. To list such a tree, send a narrower `path`.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.files.metadata.list`: `GET /api/repos/{repo_name}/files/metadata`.
	*
	* Docs: search for `repos.files.metadata.list` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	list(params, options) {
		return this.#runtime.list(reposFilesMetadataList, params, options);
	}
};
/** The `repos.files` namespace. */
var ReposFilesNamespace = class {
	#runtime;
	metadata;
	constructor(runtime) {
		this.#runtime = runtime;
		this.metadata = new ReposFilesMetadataNamespace(runtime);
	}
	/**
	* Get File
	*
	* Stream a file directly from the repository with byte ranges, ETag validators, and Last-Modified conditionals. Use `ref` to read from a branch, tag, or commit without cloning the repo locally.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.files.get`: `GET /api/repos/{repo_name}/file`.
	*
	* Docs: search for `repos.files.get` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	get(params, options) {
		return this.#runtime.request(reposFilesGet, params, options);
	}
	/**
	* List Files
	*
	* List files or direct child entries at a branch, tag, or commit without cloning the repository. Each entry includes its path, Git mode, and derived type (`blob`, `tree`, `symlink`, or `submodule`). Trees no longer carry a trailing `/`; branch on `type` instead.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.files.list`: `GET /api/repos/{repo_name}/files`.
	*
	* Docs: search for `repos.files.list` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	list(params, options) {
		return this.#runtime.list(reposFilesList, params, options);
	}
};
/** The `repos.gitCredentials` namespace. */
var ReposGitCredentialsNamespace = class {
	#runtime;
	constructor(runtime) {
		this.#runtime = runtime;
	}
	/**
	* Create Git Credential
	*
	* Create a stored HTTPS credential for a repository configured with a generic Git upstream.
	*
	* Scope: `repo:write` on the repository.
	*
	* Catalog ID `repos.gitCredentials.create`: `POST /api/repos/{repo_name}/git-credentials`.
	*
	* Docs: search for `repos.gitCredentials.create` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	create(params, options) {
		return this.#runtime.request(reposGitCredentialsCreate, params, options);
	}
	/**
	* Delete Git Credential
	*
	* Delete a stored HTTPS credential for a generic Git upstream.
	*
	* Scope: `repo:write` on the repository.
	*
	* Catalog ID `repos.gitCredentials.delete`: `DELETE /api/repos/{repo_name}/git-credentials/{git_credential_id}`.
	*
	* Docs: search for `repos.gitCredentials.delete` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	delete(params, options) {
		return this.#runtime.request(reposGitCredentialsDelete, params, options);
	}
	/**
	* Update Git Credential
	*
	* Update a stored HTTPS credential for a generic Git upstream.
	*
	* Scope: `repo:write` on the repository.
	*
	* Catalog ID `repos.gitCredentials.update`: `PUT /api/repos/{repo_name}/git-credentials/{git_credential_id}`.
	*
	* Docs: search for `repos.gitCredentials.update` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	update(params, options) {
		return this.#runtime.request(reposGitCredentialsUpdate, params, options);
	}
};
/** The `repos.notes.refs` namespace. */
var ReposNotesRefsNamespace = class {
	#runtime;
	constructor(runtime) {
		this.#runtime = runtime;
	}
	/**
	* List Notes Refs
	*
	* List Git notes refs under a notes ref prefix with cursor pagination. Use this to discover custom notes namespaces before reading individual notes.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.notes.refs.list`: `GET /api/repos/{repo_name}/notes/refs`.
	*
	* Docs: search for `repos.notes.refs.list` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	list(params, options) {
		return this.#runtime.list(reposNotesRefsList, params, options);
	}
};
/** The `repos.notes` namespace. */
var ReposNotesNamespace = class {
	#runtime;
	refs;
	constructor(runtime) {
		this.#runtime = runtime;
		this.refs = new ReposNotesRefsNamespace(runtime);
	}
	/**
	* Append Note
	*
	* Add text to the note on a Git object, or create the note if the object has none. A retry after a success adds the text again. To make a retry safe, set `expected_notes_ref_sha` to the notes ref SHA that you read before the first request: a retry then fails with 409 and adds nothing.
	*
	* Scope: `git:write` on the repository.
	*
	* Catalog ID `repos.notes.append`: `POST /api/repos/{repo_name}/notes/append`.
	*
	* Docs: search for `repos.notes.append` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	append(params, options) {
		return this.#runtime.request(reposNotesAppend, params, options);
	}
	/**
	* Create Note
	*
	* Attach text to a Git object without changing the repository contents. Use notes for review markers, internal decisions, or other lightweight context. To add text to a note, use `POST /notes/append`.
	*
	* Scope: `git:write` on the repository.
	*
	* Catalog ID `repos.notes.create`: `POST /api/repos/{repo_name}/notes`.
	*
	* Docs: search for `repos.notes.create` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	create(params, options) {
		return this.#runtime.request(reposNotesCreate, params, options);
	}
	/**
	* Delete Note
	*
	* Remove the Git note attached to a commit or other Git object. Name the note with the query parameters of `GET /notes`. The notes commit of the delete has the default author.
	*
	* Scope: `git:write` on the repository.
	*
	* Catalog ID `repos.notes.delete`: `DELETE /api/repos/{repo_name}/notes`.
	*
	* Docs: search for `repos.notes.delete` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	delete(params, options) {
		return this.#runtime.request(reposNotesDelete, params, options);
	}
	/**
	* Get Note
	*
	* Read the Git note attached to a commit or other Git object SHA. Notes let you store review status, handoff details, or other context without changing repository contents.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.notes.get`: `GET /api/repos/{repo_name}/notes`.
	*
	* Docs: search for `repos.notes.get` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	get(params, options) {
		return this.#runtime.request(reposNotesGet, params, options);
	}
};
/** The `repos.tags` namespace. */
var ReposTagsNamespace = class {
	#runtime;
	constructor(runtime) {
		this.#runtime = runtime;
	}
	/**
	* Create Tag
	*
	* Create a lightweight tag pointing to a specific commit. Annotated tags are not created through this endpoint.
	*
	* Scope: `git:write` on the repository.
	*
	* Catalog ID `repos.tags.create`: `POST /api/repos/{repo_name}/tags`.
	*
	* Docs: search for `repos.tags.create` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	create(params, options) {
		return this.#runtime.request(reposTagsCreate, params, options);
	}
	/**
	* Delete Tag
	*
	* Delete a tag from the repository. The server resolves the stored ref correctly for both lightweight and annotated tags.
	*
	* Scopes: `git:read` and `git:write` on the repository.
	*
	* Catalog ID `repos.tags.delete`: `DELETE /api/repos/{repo_name}/tags/{tag_name}`.
	*
	* Docs: search for `repos.tags.delete` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	delete(params, options) {
		return this.#runtime.request(reposTagsDelete, params, options);
	}
	/**
	* Get Tag
	*
	* Get one tag by its exact short name. The response returns the dereferenced commit SHA and omits internal fields.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.tags.get`: `GET /api/repos/{repo_name}/tag`.
	*
	* Docs: search for `repos.tags.get` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	get(params, options) {
		return this.#runtime.request(reposTagsGet, params, options);
	}
	/**
	* List Tags
	*
	* List tags in lexical order with cursor pagination. The returned `sha` is the dereferenced commit SHA, even for annotated tags.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.tags.list`: `GET /api/repos/{repo_name}/tags`.
	*
	* Docs: search for `repos.tags.list` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	list(params, options) {
		return this.#runtime.list(reposTagsList, params, options);
	}
};
/** The `repos.upstream` namespace. */
var ReposUpstreamNamespace = class {
	#runtime;
	constructor(runtime) {
		this.#runtime = runtime;
	}
	/**
	* Delete Upstream
	*
	* Detach the repository from its configured upstream provider. The operation is idempotent: already-detached repositories return success.
	*
	* Scope: `repo:write` on the repository.
	*
	* Catalog ID `repos.upstream.delete`: `DELETE /api/repos/{repo_name}/upstream`.
	*
	* Docs: search for `repos.upstream.delete` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	delete(params, options) {
		return this.#runtime.request(reposUpstreamDelete, params, options);
	}
	/**
	* Pull Upstream
	*
	* Trigger a sync from the configured upstream of the repository. This only works for repositories that have an `upstream`.
	*
	* Scope: `git:write` on the repository.
	*
	* Catalog ID `repos.upstream.pull`: `POST /api/repos/{repo_name}/upstream/pull`.
	*
	* Docs: search for `repos.upstream.pull` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	pull(params, options) {
		return this.#runtime.request(reposUpstreamPull, params, options);
	}
};
/**
* The `repos` namespace. `new Pierre()` has it as `pierre.repos`. To load only this namespace, build it on a core client: `new ReposNamespace(new PierreCore())`.
*/
var ReposNamespace = class {
	#runtime;
	archive;
	blame;
	branches;
	commits;
	diff;
	files;
	gitCredentials;
	notes;
	tags;
	upstream;
	constructor(client) {
		const runtime = runtimeOf(client);
		this.#runtime = runtime;
		this.archive = new ReposArchiveNamespace(runtime);
		this.blame = new ReposBlameNamespace(runtime);
		this.branches = new ReposBranchesNamespace(runtime);
		this.commits = new ReposCommitsNamespace(runtime);
		this.diff = new ReposDiffNamespace(runtime);
		this.files = new ReposFilesNamespace(runtime);
		this.gitCredentials = new ReposGitCredentialsNamespace(runtime);
		this.notes = new ReposNotesNamespace(runtime);
		this.tags = new ReposTagsNamespace(runtime);
		this.upstream = new ReposUpstreamNamespace(runtime);
	}
	/**
	* Create Repo
	*
	* Create a repository.
	*
	* A repository starts empty or from a source. `base_repo` is a one-time copy of a Code Storage repository; `upstream` is a lasting link to an external Git host. A copy takes the history of one commit (`base_repo.ref`, or the source HEAD) into one branch, and keeps no link to its source. A sync keeps its upstream, and the repository can sync from it again. Set at most one of the two.
	*
	* A new empty repository has no branch until its first commit. The first commit creates the branch that it targets, so the default branch exists only after a commit to it.
	*
	* Create is idempotent on the repository name. A new repository returns `201`. When the name already exists, the request returns `200`, and a copy copies nothing. When the name exists with a different upstream, the request returns `409`.
	*
	* The deprecated form of `base_repo`, with `provider` and `operation`, still works.
	*
	* Scope: `repo:write` on the repository.
	*
	* Catalog ID `repos.create`: `POST /api/repos`.
	*
	* Docs: search for `repos.create` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	create(params = {}, options) {
		return createRepo(this.#runtime, reposCreate, params, options);
	}
	/**
	* Delete Repo
	*
	* Permanently retire a repository. The API performs a soft delete first and then triggers asynchronous hot and cold storage cleanup.
	*
	* Scope: `repo:write` on the repository.
	*
	* Catalog ID `repos.delete`: `DELETE /api/repos/{repo_name}`.
	*
	* Docs: search for `repos.delete` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	delete(params, options) {
		return this.#runtime.request(reposDelete, params, options);
	}
	/**
	* Get Repo
	*
	* Fetch the metadata of a repository.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.get`: `GET /api/repos/{repo_name}`.
	*
	* Docs: search for `repos.get` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	get(params, options) {
		return this.#runtime.request(reposGet, params, options);
	}
	/**
	* Grep
	*
	* Search a repository without cloning it. Results are paginated and can include surrounding context lines so downstream tools only fetch the relevant slices.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.grep`: `POST /api/repos/{repo_name}/grep`.
	*
	* Docs: search for `repos.grep` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	grep(params, options) {
		return this.#runtime.request(reposGrep, params, options);
	}
	/**
	* List Repos
	*
	* List repositories for the current organisation with cursor-based pagination. Supply `q` to filter results by a case-insensitive substring match against `repo_name` (for example `pierre/sdk-documentation`), and `prefix` to filter by the start of `repo_name`. When both are set they combine with AND: a repository is returned only when it matches both filters.
	*
	* Scope: `org:read`.
	*
	* Catalog ID `repos.list`: `GET /api/repos`.
	*
	* Docs: search for `repos.list` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	list(params = {}, options) {
		return this.#runtime.list(reposList, params, options);
	}
	/**
	* Merge Branch
	*
	* Merge changes between branches without cloning the repository or shelling out to Git. This endpoint also supports promoting work from ephemeral branches into long-lived branches such as `main`. Set `expected_source_sha` to merge the exact source commit that a preview returned, even if the source branch advances. Omit `expected_target_sha` to merge into the current target tip and allow the gateway to retry stale target/repository movement internally; set `expected_target_sha` to require a strict target-tip precondition. GitHub-backed public targets currently do not use automatic retry.
	*
	* Scope: `git:write` on the repository.
	*
	* Catalog ID `repos.merge`: `POST /api/repos/{repo_name}/merge`.
	*
	* Docs: search for `repos.merge` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	merge(params, options) {
		return this.#runtime.request(reposMerge, params, options);
	}
	/**
	* Preview Merge
	*
	* Preview merge conflicts without creating commits, updating refs, or touching a working tree. When requested, conflict content is rendered from Git objects produced in request-local scratch storage.
	*
	* Scope: `git:read` on the repository.
	*
	* Catalog ID `repos.previewMerge`: `GET /api/repos/{repo_name}/merge/preview`.
	*
	* Docs: search for `repos.previewMerge` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	previewMerge(params, options) {
		return this.#runtime.request(reposPreviewMerge, params, options);
	}
	/**
	* Update Repository Settings
	*
	* Change the default branch of a repository.
	*
	* The gateway reads the current `HEAD` symbolic ref, then repoints it at the requested branch through a transactional compare-and-swap against that value, and finally records the new default branch in the repository row. Branch names are fully qualified for you: `main` is written as the symref target `refs/heads/main`, and a value that already starts with `refs/` is used verbatim. The branch itself is not created by this call.
	*
	* Scope: `repo:write` on the repository.
	*
	* Catalog ID `repos.update`: `PATCH /api/repos/{repo_name}`.
	*
	* Docs: search for `repos.update` in the docs MCP server, https://code.storage/docs/mcp.
	*/
	update(params, options) {
		return this.#runtime.request(reposUpdate, params, options);
	}
};

// ../typescript/dist/generated/client.js
/** The core client with every top-level namespace. */
var PierreNamespaces = class extends PierreCore {
	meta;
	repos;
	constructor(options) {
		super(options);
		this.meta = new MetaNamespace(this);
		this.repos = new ReposNamespace(this);
	}
};

// ../typescript/dist/client.js
/**
* The Pierre client. `new Pierre()` reads `PIERRE_ORG` and `PIERRE_PRIVATE_KEY`, or the other
* variables in the docs. Each namespace path is a catalog ID, for example
* `pierre.repos.branches.create()`.
*
* Docs: the MCP server at https://code.storage/docs/mcp, or the Markdown pages from
* https://code.storage/docs/llms.txt.
*/
var Pierre = class extends PierreNamespaces {};

// src/guards.ts
/** Whether a value is a plain object, so its fields can be read by name. */
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** The `code` of a Node.js system error, such as `ENOENT`, or the exit code of a child process. */
function errorCode(error) {
	if (!isRecord(error)) return void 0;
	const { code } = error;
	return typeof code === "string" || typeof code === "number" ? code : void 0;
}
/** The message of an error, or the value as text. */
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}

// src/shell.ts
function shellQuote(word) {
	if (/^[\w./:@%+=-]+$/.test(word)) return word;
	return `'${word.replaceAll("'", String.raw`'\''`)}'`;
}

// src/errors.ts
const ExitCode = {
	success: 0,
	failure: 1,
	usage: 2,
	credential: 3,
	notFound: 4
};
/** The docs for agents: the MCP server first, then the Markdown pages. */
const DOCS = {
	mcpServer: "https://code.storage/docs/mcp",
	index: "https://code.storage/docs/llms.txt",
	errorCodes: "https://code.storage/docs/api/overview.md#error-codes"
};
var CliError = class extends Error {
	exitCode;
	hint;
	body;
	constructor(message, exitCode = ExitCode.failure, hint, body) {
		super(message);
		this.exitCode = exitCode;
		this.hint = hint;
		this.body = body;
		this.name = "CliError";
	}
};
function usageError(message, hint) {
	return new CliError(message, ExitCode.usage, hint);
}
function credentialError(message, hint) {
	return new CliError(message, ExitCode.credential, hint);
}
function notFoundError(message, hint) {
	return new CliError(message, ExitCode.notFound, hint);
}
function reloginHint(context) {
	const options = ["--hostname", context.host ? shellQuote(context.host) : "<host>"];
	if (context.org) options.push("--org", shellQuote(context.org));
	if (context.apiUrl) options.push("--api-url", shellQuote(context.apiUrl));
	return `Check the key on the dashboard Keys page, or run \`pierre auth login ${options.join(" ")} --with-key\` again.`;
}
/** The exit code of an API error, from its class. */
function apiExitCode(error) {
	if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) return ExitCode.credential;
	if (error instanceof NotFoundError) return ExitCode.notFound;
	return ExitCode.failure;
}
/** A line that sends the reader to the docs of a problem code. */
function docsLine(code) {
	return code === void 0 ? `Docs: ${DOCS.mcpServer}, or ${DOCS.errorCodes}` : `Docs: search for "${code}" in the docs MCP server, ${DOCS.mcpServer}, or read ${DOCS.errorCodes}`;
}
const HTML = /^\s*<(?:!doctype\s+html|html|head|body)\b/i;
function fromApiError(error, context) {
	const exitCode = apiExitCode(error);
	if (typeof error.body === "string" && HTML.test(error.body)) {
		const where = context.apiUrl ?? context.host ?? "Code Storage";
		return new CliError(`HTTP ${error.status} from ${where}: The server returned an HTML error page.`, exitCode, "Check the API URL and the server route for this organization.");
	}
	const hints = [];
	if (error.request_id !== null) hints.push(`Request ID: ${error.request_id}`);
	if (exitCode === ExitCode.credential) hints.push(reloginHint(context));
	hints.push(docsLine(error.code));
	const text = typeof error.body === "string" ? error.body.trim() : "";
	const detail = error.detail ?? (text || error.title) ?? "The request failed.";
	const code = error.code === void 0 ? "" : ` ${error.code}`;
	return new CliError(`${error.status}${code}: ${detail}`, exitCode, hints.join("\n"), error.body);
}
/** Map an SDK, network, or other error to a CliError with its exit code. */
function toCliError(error, context = {}) {
	if (error instanceof CliError) return error;
	if (error instanceof APIError) return fromApiError(error, context);
	if (error instanceof APIConnectionError) {
		const cause = error.cause === void 0 ? void 0 : errorCode(error.cause) ?? errorMessage(error.cause);
		return new CliError(`Cannot reach ${context.apiUrl ?? context.host ?? "Code Storage"}: ${cause ?? error.message}`);
	}
	if (error instanceof PierreError) return usageError(error.message);
	return new CliError(errorMessage(error));
}

// src/generated/commands.ts
/** The API command of each operation, in catalog ID order. */
const COMMANDS = [
	{
		id: "meta.get",
		resource: "meta",
		method: "get",
		summary: "Get Organization Metadata",
		description: "Return the cloud provider, region, and public inbound IP addresses of the Code Storage cluster that serves the current organisation. Addresses are listed separately for Git over HTTPS and for the HTTP API; allow them in firewall rules that restrict outbound traffic to Code Storage. The lists change when the cluster's ingress changes, so poll this endpoint rather than copying them once.\n\nScope: `org:read`.",
		httpMethod: "GET",
		path: "/api/meta",
		scopes: ["org:read"],
		positional: null,
		repoName: null,
		fields: [],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: ["ips", "provider"]
	},
	{
		id: "repos.archive.get",
		resource: "repos:archive",
		method: "get",
		summary: "Archive",
		description: "Download a repository snapshot without cloning the repo. This is useful for packaging docs, examples, or release artefacts directly from a branch, tag, or commit.\n\nScope: `git:read` on the repository.",
		httpMethod: "POST",
		path: "/api/repos/{repo_name}/archive",
		scopes: ["git:read"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "archive",
				in: "body",
				type: "object",
				required: false,
				description: "Optional archive output settings.",
				fields: [{
					name: "prefix",
					in: "body",
					type: "string",
					required: false,
					description: "Prefix to add to every file path inside the archive."
				}]
			},
			{
				name: "exclude_globs",
				in: "body",
				type: "array",
				items: "string",
				required: false,
				description: "Exclude files matching these glob patterns after include filtering."
			},
			{
				name: "include_globs",
				in: "body",
				type: "array",
				items: "string",
				required: false,
				description: "Only include files matching these glob patterns."
			},
			{
				name: "max_blob_size",
				in: "body",
				type: "integer",
				required: false,
				description: "Maximum blob size to include in the archive, in bytes."
			},
			{
				name: "ref",
				in: "body",
				type: "string",
				required: false,
				description: "Branch, tag, or commit to archive. When omitted, the default branch or HEAD is used."
			}
		],
		content: null,
		response: "bytes",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: null
	},
	{
		id: "repos.blame.get",
		resource: "repos:blame",
		method: "get",
		summary: "Blame",
		description: "Return per-line blame metadata for a file at a branch, tag, or commit. Supports `git blame -L`-style range filters and rename/copy detection for callers building IDE blame views or audit tooling.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/blame",
		scopes: ["git:read"],
		positional: "path",
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "detect_moves",
				in: "query",
				type: "boolean",
				required: false,
				description: "Follow the file across renames and copies."
			},
			{
				name: "ephemeral",
				in: "query",
				type: "boolean",
				required: false,
				description: "Whether `ref` should be resolved from the ephemeral namespace."
			},
			{
				name: "path",
				in: "query",
				type: "string",
				required: true,
				description: "Repository-relative file path to blame."
			},
			{
				name: "range",
				in: "query",
				type: "array",
				items: "string",
				required: false,
				description: "Optional `git blame -L`-style range spec. May be repeated to blame multiple regions (max 16). Each value is one `-L` argument: e.g. `10,20`, `10,+5`, `/getUser/,/^}/`, `/getUser/,+30`, `10,`, `,20`, `10`, `:^func .*Foo`, `:funcname`."
			},
			{
				name: "ref",
				in: "query",
				type: "string",
				required: false,
				description: "Optional branch, tag, or commit SHA to blame at. When omitted, the repository default branch is used."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: [
			"commit_sha",
			"lines",
			"path",
			"ref"
		]
	},
	{
		id: "repos.branches.create",
		resource: "repos:branches",
		method: "create",
		summary: "Create Branch",
		description: "Create a new branch from an existing branch or ref. This is useful for agent workflows, ephemeral previews, or server-side automation where you do not want to clone the repo first. The base ref must exist. A new empty repository has no branch until its first commit, so the request returns `404`.\n\nScope: `git:write` on the repository.",
		httpMethod: "POST",
		path: "/api/repos/{repo_name}/branches/create",
		scopes: ["git:write"],
		positional: "target_branch",
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "base_branch",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use base_ref. Preferred source branch name."
			},
			{
				name: "base_is_ephemeral",
				in: "body",
				type: "boolean",
				required: false,
				description: "Whether the base branch should be resolved from the ephemeral namespace."
			},
			{
				name: "base_ref",
				in: "body",
				type: "string",
				required: false,
				description: "Optional source ref or revision. Provide base_ref or the deprecated base_branch."
			},
			{
				name: "expected_target_sha",
				in: "body",
				type: "string",
				required: false,
				description: "Optional full commit SHA that must match the target branch tip. Set to 40 zeros to require a new branch. A non-zero guard requires target_branch. Empty means no guard. Applies with or without force."
			},
			{
				name: "force",
				in: "body",
				type: "boolean",
				required: false,
				description: "Allow non-fast-forward updates when recreating an existing named branch. Requires target_branch."
			},
			{
				name: "preferred_base",
				in: "body",
				type: "string",
				required: false,
				description: "Optional pack hint. A branch name the backend prefers as the delta base when it builds the thin pack. It does not change the source or the result."
			},
			{
				name: "target_branch",
				in: "body",
				type: "string",
				required: false,
				description: "Optional destination branch name. Omit it to let the server allocate a name."
			},
			{
				name: "target_is_ephemeral",
				in: "body",
				type: "boolean",
				required: false,
				description: "Whether the new branch should be created in the ephemeral namespace."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: [
			"commit_sha",
			"message",
			"target_branch",
			"target_is_ephemeral"
		]
	},
	{
		id: "repos.branches.delete",
		resource: "repos:branches",
		method: "delete",
		summary: "Delete Branch",
		description: "Delete a branch from the repository. Name the branch with the `target_branch` and `ephemeral` query parameters. The server resolves the current branch tip before deleting, so the caller does not need the branch SHA. The default branch is protected and cannot be deleted through this endpoint.\n\nScope: `git:write` on the repository.",
		httpMethod: "DELETE",
		path: "/api/repos/{repo_name}/branches",
		scopes: ["git:write"],
		positional: "target_branch",
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "ephemeral",
				in: "query",
				type: "boolean",
				required: false,
				description: "When true, delete the branch from the ephemeral namespace instead of the default namespace."
			},
			{
				name: "target_branch",
				in: "query",
				type: "string",
				required: false,
				description: "Exact short name of the branch to delete. Must not start with refs/. Required unless the deprecated body names the branch."
			},
			{
				name: "name",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use the target_branch query parameter. Branch name to delete."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: [
			"ephemeral",
			"message",
			"target_branch"
		]
	},
	{
		id: "repos.branches.get",
		resource: "repos:branches",
		method: "get",
		summary: "Get Branch",
		description: "Get one branch by its exact short name. The response omits list pagination fields. A new empty repository has no branch until its first commit, so the request returns `404`.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/branch",
		scopes: ["git:read"],
		positional: "name",
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "ephemeral",
				in: "query",
				type: "boolean",
				required: false,
				description: "When true, get the branch from the ephemeral namespace."
			},
			{
				name: "name",
				in: "query",
				type: "string",
				required: true,
				description: "Exact short branch name."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: ["branch"]
	},
	{
		id: "repos.branches.list",
		resource: "repos:branches",
		method: "list",
		summary: "List Branches",
		description: "List branches in the repository with cursor pagination. Use this to build branch selectors, review tools, or sync jobs without shelling out to Git. A new empty repository has no branch until its first commit, so its list is empty.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/branches",
		scopes: ["git:read"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "cursor",
				in: "query",
				type: "string",
				required: false,
				description: "Pagination cursor returned by a previous `list_branches` response."
			},
			{
				name: "ephemeral",
				in: "query",
				type: "boolean",
				required: false,
				description: "When true, list branches under the ephemeral namespace instead of regular branches."
			},
			{
				name: "limit",
				in: "query",
				type: "integer",
				required: false,
				description: "Maximum number of branches to return. Defaults to 20."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: "branches",
		display: [
			"name",
			"created_at",
			"head_sha",
			"cursor"
		]
	},
	{
		id: "repos.commits.create",
		resource: "repos:commits",
		method: "create",
		summary: "Create Commit from Files",
		description: "Create a commit by streaming file operations directly to the service. This is designed for automation, AI agents, and other workflows that need atomic Git writes without running a local Git process.\n\nScope: `git:write` on the repository.",
		httpMethod: "POST",
		path: "/api/repos/{repo_name}/commit-pack",
		scopes: ["git:write"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "author",
				in: "body",
				type: "object",
				required: true,
				description: "Author identity for the commit.",
				fields: [{
					name: "email",
					in: "body",
					type: "string",
					required: true,
					description: "Email address."
				}, {
					name: "name",
					in: "body",
					type: "string",
					required: true,
					description: "Display name."
				}]
			},
			{
				name: "base_branch",
				in: "body",
				type: "string",
				required: false,
				description: "Source branch to copy when target_branch does not yet exist."
			},
			{
				name: "base_is_ephemeral",
				in: "body",
				type: "boolean",
				required: false,
				description: "When true, interpret base_branch as ephemeral."
			},
			{
				name: "commit_message",
				in: "body",
				type: "string",
				required: true,
				description: "Commit message for the new commit."
			},
			{
				name: "committer",
				in: "body",
				type: "object",
				required: false,
				description: "Committer identity. Defaults to author when omitted.",
				fields: [{
					name: "email",
					in: "body",
					type: "string",
					required: true,
					description: "Email address."
				}, {
					name: "name",
					in: "body",
					type: "string",
					required: true,
					description: "Display name."
				}]
			},
			{
				name: "ephemeral",
				in: "body",
				type: "boolean",
				required: false,
				deprecated: true,
				description: "Deprecated: use target_is_ephemeral. When true, write the target branch under the ephemeral namespace."
			},
			{
				name: "ephemeral_base",
				in: "body",
				type: "boolean",
				required: false,
				deprecated: true,
				description: "Deprecated: use base_is_ephemeral. When true, interpret base_branch as ephemeral."
			},
			{
				name: "expected_head_sha",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use expected_target_sha. Commit SHA that must match the branch tip before writing."
			},
			{
				name: "expected_target_sha",
				in: "body",
				type: "string",
				required: false,
				description: "Commit SHA that must match the target branch tip before writing. Set to 40 zeros to create the first commit in an empty repository, without base_branch. Omit to fast-forward unconditionally."
			},
			{
				name: "target_branch",
				in: "body",
				type: "string",
				required: true,
				description: "Destination branch name (no refs/ prefix)."
			},
			{
				name: "target_is_ephemeral",
				in: "body",
				type: "boolean",
				required: false,
				description: "When true, write the target branch under the ephemeral namespace."
			}
		],
		content: "files",
		response: "json",
		statuses: [201],
		notModified: false,
		itemField: null,
		display: ["commit", "result"]
	},
	{
		id: "repos.commits.createFromDiff",
		resource: "repos:commits",
		method: "create-from-diff",
		summary: "Create Commit from Diff",
		description: "Create a commit by streaming a Git patch instead of individual file blobs. Use this when your workflow already produces unified diffs or generated patches.\n\nScope: `git:write` on the repository.",
		httpMethod: "POST",
		path: "/api/repos/{repo_name}/diff-commit",
		scopes: ["git:write"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "author",
				in: "body",
				type: "object",
				required: true,
				description: "Author identity for the commit.",
				fields: [{
					name: "email",
					in: "body",
					type: "string",
					required: true,
					description: "Email address."
				}, {
					name: "name",
					in: "body",
					type: "string",
					required: true,
					description: "Display name."
				}]
			},
			{
				name: "base_branch",
				in: "body",
				type: "string",
				required: false,
				description: "Source branch to seed from when target_branch does not exist yet."
			},
			{
				name: "base_is_ephemeral",
				in: "body",
				type: "boolean",
				required: false,
				description: "When true, interpret base_branch as ephemeral."
			},
			{
				name: "commit_message",
				in: "body",
				type: "string",
				required: true,
				description: "Commit message for the new commit."
			},
			{
				name: "committer",
				in: "body",
				type: "object",
				required: false,
				description: "Committer identity. Defaults to author when omitted.",
				fields: [{
					name: "email",
					in: "body",
					type: "string",
					required: true,
					description: "Email address."
				}, {
					name: "name",
					in: "body",
					type: "string",
					required: true,
					description: "Display name."
				}]
			},
			{
				name: "ephemeral",
				in: "body",
				type: "boolean",
				required: false,
				deprecated: true,
				description: "Deprecated: use target_is_ephemeral. When true, write the target branch under the ephemeral namespace."
			},
			{
				name: "ephemeral_base",
				in: "body",
				type: "boolean",
				required: false,
				deprecated: true,
				description: "Deprecated: use base_is_ephemeral. When true, interpret base_branch as ephemeral."
			},
			{
				name: "expected_head_sha",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use expected_target_sha. Guard ensuring the branch tip matches before applying the patch."
			},
			{
				name: "expected_target_sha",
				in: "body",
				type: "string",
				required: false,
				description: "Guard ensuring the target branch tip matches before applying the patch. Set to 40 zeros to create the first commit in an empty repository, without base_branch."
			},
			{
				name: "target_branch",
				in: "body",
				type: "string",
				required: true,
				description: "Destination branch name."
			},
			{
				name: "target_is_ephemeral",
				in: "body",
				type: "boolean",
				required: false,
				description: "When true, write the target branch under the ephemeral namespace."
			}
		],
		content: "diff",
		response: "json",
		statuses: [201],
		notModified: false,
		itemField: null,
		display: ["commit", "result"]
	},
	{
		id: "repos.commits.get",
		resource: "repos:commits",
		method: "get",
		summary: "Get Commit",
		description: "Resolve a branch name, short SHA, or full SHA to a commit and return the same metadata shape used in commit listings. Use this when you need commit details without computing a diff.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/commit",
		scopes: ["git:read"],
		positional: "ref",
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "ref",
				in: "query",
				type: "string",
				required: false,
				description: "Branch name, tag, full commit SHA, short SHA, or other revision Git can resolve. Provide `ref` or the deprecated `sha`."
			},
			{
				name: "sha",
				in: "query",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use ref instead. Commit SHA, short SHA, branch name, or other revision Git can resolve."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: ["commit"]
	},
	{
		id: "repos.commits.list",
		resource: "repos:commits",
		method: "list",
		summary: "List Commits",
		description: "List commit history for the repository default branch or for an explicit branch. Results are cursor-paginated and ordered by commit date, newest first. Set `path` to restrict the history to commits that modified a specific file or subtree.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/commits",
		scopes: ["git:read"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "branch",
				in: "query",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use ref instead. Optional branch name to list commits from. When omitted, the repository default branch is used."
			},
			{
				name: "cursor",
				in: "query",
				type: "string",
				required: false,
				description: "Pagination cursor returned by a previous `list_commits` response."
			},
			{
				name: "ephemeral",
				in: "query",
				type: "boolean",
				required: false,
				description: "Whether `ref` should be resolved from the ephemeral namespace."
			},
			{
				name: "limit",
				in: "query",
				type: "integer",
				required: false,
				description: "Maximum number of commits to return. Defaults to 20."
			},
			{
				name: "path",
				in: "query",
				type: "string",
				required: false,
				description: "Optional repository-relative path to scope the history to commits that touched that path."
			},
			{
				name: "ref",
				in: "query",
				type: "string",
				required: false,
				description: "Optional branch, tag, or commit to list commits from. When omitted, the repository default branch is used. Provide `ref` or the deprecated `branch`."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: "commits",
		display: [
			"author_name",
			"committer_name",
			"author_email",
			"committer_email",
			"date",
			"message",
			"sha"
		]
	},
	{
		id: "repos.commits.restore",
		resource: "repos:commits",
		method: "restore",
		summary: "Restore Commit",
		description: "Create a new commit that resets a branch back to a specific commit SHA while preserving normal Git history.\n\nRef-level outcomes are reported in `result.status` and `result.success`, not by the status code alone, and failures raised by the restore itself come back in that same restore-result body. The problem-details schemas below describe gateway-level rejections such as `401`, `403` and `429`.\n\nScope: `git:write` on the repository.",
		httpMethod: "POST",
		path: "/api/repos/{repo_name}/restore-commit",
		scopes: ["git:write"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "author",
				in: "body",
				type: "object",
				required: true,
				description: "Author identity for the restore commit.",
				fields: [{
					name: "email",
					in: "body",
					type: "string",
					required: true,
					description: "Email address."
				}, {
					name: "name",
					in: "body",
					type: "string",
					required: true,
					description: "Display name."
				}]
			},
			{
				name: "base_ref",
				in: "body",
				type: "string",
				required: false,
				description: "Branch, tag, or commit to reset the branch to. Provide base_ref or the deprecated target_commit_sha."
			},
			{
				name: "commit_message",
				in: "body",
				type: "string",
				required: false,
				description: "Commit message for the restore commit. Defaults to a message that names the branch and the commit."
			},
			{
				name: "committer",
				in: "body",
				type: "object",
				required: false,
				description: "Committer identity. Defaults to author when omitted.",
				fields: [{
					name: "email",
					in: "body",
					type: "string",
					required: true,
					description: "Email address."
				}, {
					name: "name",
					in: "body",
					type: "string",
					required: true,
					description: "Display name."
				}]
			},
			{
				name: "expected_head_sha",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use expected_target_sha. Guard ensuring the current tip matches before applying the restore."
			},
			{
				name: "expected_target_sha",
				in: "body",
				type: "string",
				required: false,
				description: "Guard ensuring the target branch tip matches before applying the restore."
			},
			{
				name: "target_branch",
				in: "body",
				type: "string",
				required: true,
				description: "Branch name to reset (no refs/ prefix)."
			},
			{
				name: "target_commit_sha",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use base_ref. Commit to reset the branch to."
			}
		],
		content: null,
		response: "json",
		statuses: [201],
		notModified: false,
		itemField: null,
		display: ["commit", "result"]
	},
	{
		id: "repos.create",
		resource: "repos",
		method: "create",
		summary: "Create Repo",
		description: "Create a repository.\n\nA repository starts empty or from a source. `base_repo` is a one-time copy of a Code Storage repository; `upstream` is a lasting link to an external Git host. A copy takes the history of one commit (`base_repo.ref`, or the source HEAD) into one branch, and keeps no link to its source. A sync keeps its upstream, and the repository can sync from it again. Set at most one of the two.\n\nA new empty repository has no branch until its first commit. The first commit creates the branch that it targets, so the default branch exists only after a commit to it.\n\nCreate is idempotent on the repository name. A new repository returns `201`. When the name already exists, the request returns `200`, and a copy copies nothing. When the name exists with a different upstream, the request returns `409`.\n\nThe deprecated form of `base_repo`, with `provider` and `operation`, still works.\n\nScope: `repo:write` on the repository.",
		httpMethod: "POST",
		path: "/api/repos",
		scopes: ["repo:write"],
		positional: "repo_name",
		repoName: "body",
		fields: [
			{
				name: "base_repo",
				in: "body",
				type: "object",
				required: false,
				description: "Code Storage repository to copy once. The new repository keeps no link to it. Do not set it together with upstream.",
				fields: [{
					name: "name",
					in: "body",
					type: "string",
					required: true,
					description: "Name of the Code Storage repository to copy. In the deprecated form, the repository name on the provider."
				}, {
					name: "ref",
					in: "body",
					type: "string",
					required: false,
					description: "Branch, tag, or commit SHA to copy. It defaults to the HEAD of the source repository."
				}]
			},
			{
				name: "default_branch",
				in: "body",
				type: "string",
				required: false,
				description: "Default branch for the new repository. When omitted, a copy takes the default branch of the source, a sync from GitHub takes the default branch of the GitHub repository, and any other repository uses main. An empty repository has no branch until its first commit, and a commit to this name creates the default branch."
			},
			{
				name: "repo_name",
				in: "body",
				type: "string",
				required: false,
				description: "Name of the new repository. It can contain a slash."
			},
			{
				name: "upstream",
				in: "body",
				type: "object",
				required: false,
				description: "External Git host to keep syncing from. The link lasts, and the repository can sync again. Do not set it together with base_repo.",
				fields: [
					{
						name: "access",
						in: "body",
						type: "enum",
						values: ["app", "public"],
						required: false,
						description: "GitHub only. app (the default) reads through the GitHub App installation of the organization. public mirrors a public repository without an installation, and syncs only on request."
					},
					{
						name: "host",
						in: "body",
						type: "string",
						required: false,
						description: "Bare hostname of a self-hosted provider, such as gitlab.example.com. It defaults to the public host of the provider."
					},
					{
						name: "name",
						in: "body",
						type: "string",
						required: true,
						description: "Repository name on the upstream provider."
					},
					{
						name: "owner",
						in: "body",
						type: "string",
						required: true,
						description: "Repository owner or namespace on the upstream provider."
					},
					{
						name: "provider",
						in: "body",
						type: "enum",
						values: [
							"bitbucket",
							"codeberg",
							"forgejo",
							"gitea",
							"github",
							"gitlab",
							"sourcehut",
							"sr.ht"
						],
						required: true,
						description: "External Git host of the upstream repository."
					}
				]
			}
		],
		content: null,
		response: "json",
		statuses: [200, 201],
		notModified: false,
		itemField: null,
		display: ["repo_name", "message"]
	},
	{
		id: "repos.delete",
		resource: "repos",
		method: "delete",
		summary: "Delete Repo",
		description: "Permanently retire a repository. The API performs a soft delete first and then triggers asynchronous hot and cold storage cleanup.\n\nScope: `repo:write` on the repository.",
		httpMethod: "DELETE",
		path: "/api/repos/{repo_name}",
		scopes: ["repo:write"],
		positional: "repo_name",
		repoName: "path",
		fields: [{
			name: "repo_name",
			in: "path",
			type: "string",
			required: true,
			description: "The repository name, for example `acme/web`."
		}],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: ["repo_name", "message"]
	},
	{
		id: "repos.diff.get",
		resource: "repos:diff",
		method: "get",
		summary: "Get Commit Diff",
		description: "Get the diff for a commit, optionally relative to a specific base commit. Repeated `path` parameters narrow the diff to selected files or directories.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/diff",
		scopes: ["git:read"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "baseSha",
				in: "query",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use base_ref instead. Optional base commit SHA to diff against. When omitted, the diff is generated against the commit's parent."
			},
			{
				name: "base_is_ephemeral",
				in: "query",
				type: "boolean",
				required: false,
				description: "Whether `base_ref` should be resolved from the ephemeral namespace."
			},
			{
				name: "base_ref",
				in: "query",
				type: "string",
				required: false,
				description: "Optional base branch, tag, or commit to diff against. When omitted, the diff is generated against the commit's parent. When set, the diff starts at the merge base of `base_ref` and `ref`, as `git diff base_ref...ref` does, and `merge_base_sha` gives that commit. So the diff holds only the changes on `ref` after the two histories split. When `ref` is an ancestor of `base_ref`, the merge base is `ref`, and the diff is empty. Provide `base_ref` or the deprecated `baseSha`."
			},
			{
				name: "gitApplyCompatible",
				in: "query",
				type: "boolean",
				required: false,
				deprecated: true,
				description: "Deprecated: use git_apply_compatible instead. When enabled, concatenate `files[].raw` in response order and apply the result against the selected base with `git apply`. Changes listed in `filtered_files` are not included in the patch. Defaults to false, preserving review-oriented whitespace suppression."
			},
			{
				name: "git_apply_compatible",
				in: "query",
				type: "boolean",
				required: false,
				description: "When enabled, concatenate `files[].raw` in response order and apply the result against the selected base with `git apply`. Changes listed in `filtered_files` are not included in the patch. Defaults to false, preserving review-oriented whitespace suppression. Provide `git_apply_compatible` or the deprecated `gitApplyCompatible`."
			},
			{
				name: "path",
				in: "query",
				type: "array",
				items: "string",
				required: false,
				description: "Optional repeated path filter. Provide multiple `path` query values to restrict the diff to specific files or directories."
			},
			{
				name: "ref",
				in: "query",
				type: "string",
				required: false,
				description: "Branch, tag, or commit to diff. Provide `ref` or the deprecated `sha`."
			},
			{
				name: "ref_is_ephemeral",
				in: "query",
				type: "boolean",
				required: false,
				description: "Whether `ref` should be resolved from the ephemeral namespace."
			},
			{
				name: "sha",
				in: "query",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use ref instead. Commit SHA to diff."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: [
			"base_sha",
			"files",
			"filtered_files",
			"merge_base_sha",
			"sha",
			"stats"
		]
	},
	{
		id: "repos.files.get",
		resource: "repos:files",
		method: "get",
		summary: "Get File",
		description: "Stream a file directly from the repository with byte ranges, ETag validators, and Last-Modified conditionals. Use `ref` to read from a branch, tag, or commit without cloning the repo locally.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/file",
		scopes: ["git:read"],
		positional: "path",
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "ephemeral",
				in: "query",
				type: "boolean",
				required: false,
				description: "Whether `ref` should be resolved from the ephemeral namespace."
			},
			{
				name: "path",
				in: "query",
				type: "string",
				required: true,
				description: "Repository-relative file path to fetch."
			},
			{
				name: "ref",
				in: "query",
				type: "string",
				required: false,
				description: "Optional branch, tag, or commit SHA to read from. When omitted, the repository default branch is used."
			},
			{
				name: "if_match",
				in: "header",
				type: "string",
				required: false,
				description: "Returns `412 Precondition Failed` when the current `ETag` does not match."
			},
			{
				name: "if_modified_since",
				in: "header",
				type: "string",
				required: false,
				description: "Returns `304 Not Modified` when `Last-Modified` is on or before this date."
			},
			{
				name: "if_none_match",
				in: "header",
				type: "string",
				required: false,
				description: "Returns `304 Not Modified` when the current `ETag` matches."
			},
			{
				name: "if_range",
				in: "header",
				type: "string",
				required: false,
				description: "Conditional range request: when the supplied validator matches `ETag` or `Last-Modified`, the server returns `206 Partial Content`; otherwise the full body is returned with `200 OK`."
			},
			{
				name: "if_unmodified_since",
				in: "header",
				type: "string",
				required: false,
				description: "Returns `412 Precondition Failed` when `Last-Modified` is after this date."
			},
			{
				name: "range",
				in: "header",
				type: "string",
				required: false,
				description: "Standard HTTP byte-range header (`bytes=<start>-<end>`). Triggers a `206 Partial Content` response."
			}
		],
		content: null,
		response: "bytes",
		statuses: [200, 206],
		notModified: true,
		itemField: null,
		display: null
	},
	{
		id: "repos.files.list",
		resource: "repos:files",
		method: "list",
		summary: "List Files",
		description: "List files or direct child entries at a branch, tag, or commit without cloning the repository. Each entry includes its path, Git mode, and derived type (`blob`, `tree`, `symlink`, or `submodule`). Trees no longer carry a trailing `/`; branch on `type` instead.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/files",
		scopes: ["git:read"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "cursor",
				in: "query",
				type: "string",
				required: false,
				description: "Pagination cursor returned by a previous `list_files` response."
			},
			{
				name: "ephemeral",
				in: "query",
				type: "boolean",
				required: false,
				description: "Whether `ref` should be resolved from the ephemeral namespace."
			},
			{
				name: "limit",
				in: "query",
				type: "integer",
				required: false,
				description: "Maximum number of paths to return. A call with no `limit` and no `cursor` returns every path in one response, with `has_more` false. A `limit` of 0 is the same as no `limit`. A call with a `cursor` and no `limit` returns up to 1000 paths."
			},
			{
				name: "path",
				in: "query",
				type: "string",
				required: false,
				description: "Optional repository-relative subtree to list. Empty means the repository root."
			},
			{
				name: "recursive",
				in: "query",
				type: "boolean",
				required: false,
				description: "When true, include descendants recursively. When false, only direct children are returned. Defaults to true."
			},
			{
				name: "ref",
				in: "query",
				type: "string",
				required: false,
				description: "Optional branch, tag, or commit SHA to list from. When omitted, the repository default branch is used."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: "entries",
		display: [
			"mode",
			"path",
			"type"
		]
	},
	{
		id: "repos.files.metadata.get",
		resource: "repos:files:metadata",
		method: "get",
		summary: "Get File Headers",
		description: "Return file metadata headers for a repository file without streaming the file body. Supports byte ranges, ETag validators, and Last-Modified conditionals. Use `ref` to inspect a branch, tag, or commit without cloning the repo locally.\n\nScope: `git:read` on the repository.",
		httpMethod: "HEAD",
		path: "/api/repos/{repo_name}/file",
		scopes: ["git:read"],
		positional: "path",
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "ephemeral",
				in: "query",
				type: "boolean",
				required: false,
				description: "Whether `ref` should be resolved from the ephemeral namespace."
			},
			{
				name: "path",
				in: "query",
				type: "string",
				required: true,
				description: "Repository-relative file path to fetch."
			},
			{
				name: "ref",
				in: "query",
				type: "string",
				required: false,
				description: "Optional branch, tag, or commit SHA to read from. When omitted, the repository default branch is used."
			},
			{
				name: "if_match",
				in: "header",
				type: "string",
				required: false,
				description: "Returns `412 Precondition Failed` when the current `ETag` does not match."
			},
			{
				name: "if_modified_since",
				in: "header",
				type: "string",
				required: false,
				description: "Returns `304 Not Modified` when `Last-Modified` is on or before this date."
			},
			{
				name: "if_none_match",
				in: "header",
				type: "string",
				required: false,
				description: "Returns `304 Not Modified` when the current `ETag` matches."
			},
			{
				name: "if_range",
				in: "header",
				type: "string",
				required: false,
				description: "Conditional range request: when the supplied validator matches `ETag` or `Last-Modified`, the server returns `206 Partial Content`; otherwise the full body is returned with `200 OK`."
			},
			{
				name: "if_unmodified_since",
				in: "header",
				type: "string",
				required: false,
				description: "Returns `412 Precondition Failed` when `Last-Modified` is after this date."
			},
			{
				name: "range",
				in: "header",
				type: "string",
				required: false,
				description: "Standard HTTP byte-range header (`bytes=<start>-<end>`). Triggers a `206 Partial Content` response."
			}
		],
		content: null,
		response: "none",
		statuses: [200, 206],
		notModified: true,
		itemField: null,
		display: null
	},
	{
		id: "repos.files.metadata.list",
		resource: "repos:files:metadata",
		method: "list",
		summary: "List Files with Metadata",
		description: "Return a recursive file tree together with per-file commit metadata in one request. Each file also includes a derived `type` field for symmetry with `/files`.\n\nThe server reads the last commit of each file under `path`, also when the call sends a `limit` or a `cursor`. When those files have more than 50,000 distinct last commits, the call fails with a 429 response, and a retry gets the same response. To list such a tree, send a narrower `path`.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/files/metadata",
		scopes: ["git:read"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "cursor",
				in: "query",
				type: "string",
				required: false,
				description: "Pagination cursor returned by a previous `list_files_with_metadata` response."
			},
			{
				name: "ephemeral",
				in: "query",
				type: "boolean",
				required: false,
				description: "Whether `ref` should be resolved from the ephemeral namespace."
			},
			{
				name: "limit",
				in: "query",
				type: "integer",
				required: false,
				description: "Maximum number of files to return. A call with no `limit` and no `cursor` returns every file in one response, with `has_more` false. A `limit` of 0 is the same as no `limit`. A call with a `cursor` and no `limit` returns up to 200 files."
			},
			{
				name: "path",
				in: "query",
				type: "string",
				required: false,
				description: "Optional repository-relative subtree to list recursively. Empty means the repository root."
			},
			{
				name: "recursive",
				in: "query",
				type: "boolean",
				required: false,
				description: "Accepted for API symmetry. Metadata listings are recursive regardless of this flag."
			},
			{
				name: "ref",
				in: "query",
				type: "string",
				required: false,
				description: "Optional branch, tag, or commit SHA to list from. When omitted, the repository default branch is used."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: "files",
		display: [
			"last_commit_sha",
			"mode",
			"path",
			"size",
			"type"
		]
	},
	{
		id: "repos.get",
		resource: "repos",
		method: "get",
		summary: "Get Repo",
		description: "Fetch the metadata of a repository.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}",
		scopes: ["git:read"],
		positional: "repo_name",
		repoName: "path",
		fields: [{
			name: "repo_name",
			in: "path",
			type: "string",
			required: true,
			description: "The repository name, for example `acme/web`."
		}],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: [
			"repo_name",
			"created_at",
			"default_branch",
			"upstream"
		]
	},
	{
		id: "repos.gitCredentials.create",
		resource: "repos:git-credentials",
		method: "create",
		summary: "Create Git Credential",
		description: "Create a stored HTTPS credential for a repository configured with a generic Git upstream.\n\nScope: `repo:write` on the repository.",
		httpMethod: "POST",
		path: "/api/repos/{repo_name}/git-credentials",
		scopes: ["repo:write"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "password",
				in: "body",
				type: "string",
				required: true,
				description: "Password or access token for the upstream provider."
			},
			{
				name: "username",
				in: "body",
				type: "string",
				required: false,
				description: "Username for HTTPS authentication. Optional. With no username, requests to the upstream send the token as the password with the username `x-token-auth` for Bitbucket and `oauth2` for GitLab, and as the username for Gitea, Forgejo, and Codeberg. sr.ht takes no credential over HTTPS: it serves private repositories and pushes only over SSH."
			}
		],
		content: null,
		response: "json",
		statuses: [201],
		notModified: false,
		itemField: null,
		display: ["created_at", "id"]
	},
	{
		id: "repos.gitCredentials.delete",
		resource: "repos:git-credentials",
		method: "delete",
		summary: "Delete Git Credential",
		description: "Delete a stored HTTPS credential for a generic Git upstream.\n\nScope: `repo:write` on the repository.",
		httpMethod: "DELETE",
		path: "/api/repos/{repo_name}/git-credentials/{git_credential_id}",
		scopes: ["repo:write"],
		positional: "git_credential_id",
		repoName: "path",
		fields: [{
			name: "repo_name",
			in: "path",
			type: "string",
			required: true,
			description: "The repository name, for example `acme/web`."
		}, {
			name: "git_credential_id",
			in: "path",
			type: "string",
			required: true,
			description: "Credential identifier."
		}],
		content: null,
		response: "none",
		statuses: [204],
		notModified: false,
		itemField: null,
		display: null
	},
	{
		id: "repos.gitCredentials.update",
		resource: "repos:git-credentials",
		method: "update",
		summary: "Update Git Credential",
		description: "Update a stored HTTPS credential for a generic Git upstream.\n\nScope: `repo:write` on the repository.",
		httpMethod: "PUT",
		path: "/api/repos/{repo_name}/git-credentials/{git_credential_id}",
		scopes: ["repo:write"],
		positional: "git_credential_id",
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "git_credential_id",
				in: "path",
				type: "string",
				required: true,
				description: "Credential identifier."
			},
			{
				name: "password",
				in: "body",
				type: "string",
				required: true,
				description: "Updated password or access token for the upstream provider."
			},
			{
				name: "username",
				in: "body",
				type: "string",
				required: false,
				description: "Username for HTTPS authentication. Optional. With no username, requests to the upstream send the token as the password with the username `x-token-auth` for Bitbucket and `oauth2` for GitLab, and as the username for Gitea, Forgejo, and Codeberg. sr.ht takes no credential over HTTPS: it serves private repositories and pushes only over SSH. An omitted username clears the stored one."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: ["created_at", "id"]
	},
	{
		id: "repos.grep",
		resource: "repos",
		method: "grep",
		summary: "Grep",
		description: "Search a repository without cloning it. Results are paginated and can include surrounding context lines so downstream tools only fetch the relevant slices.\n\nScope: `git:read` on the repository.",
		httpMethod: "POST",
		path: "/api/repos/{repo_name}/grep",
		scopes: ["git:read"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "context",
				in: "body",
				type: "object",
				required: false,
				description: "Lines of context to include before and after each match.",
				fields: [{
					name: "after",
					in: "body",
					type: "integer",
					required: false,
					description: "Number of lines to include after each match."
				}, {
					name: "before",
					in: "body",
					type: "integer",
					required: false,
					description: "Number of lines to include before each match."
				}]
			},
			{
				name: "ephemeral",
				in: "body",
				type: "boolean",
				required: false,
				description: "Whether ref should be resolved from the ephemeral namespace."
			},
			{
				name: "file_filters",
				in: "body",
				type: "object",
				required: false,
				description: "Optional include and exclude filters applied before matching."
			},
			{
				name: "limits",
				in: "body",
				type: "object",
				required: false,
				description: "Maximum line and per-file match limits.",
				fields: [{
					name: "max_lines",
					in: "body",
					type: "integer",
					required: false,
					description: "Maximum total lines to return (default 2000, max 2000)."
				}, {
					name: "max_matches_per_file",
					in: "body",
					type: "integer",
					required: false,
					description: "Maximum matches returned per file (default 200)."
				}]
			},
			{
				name: "pagination",
				in: "body",
				type: "object",
				required: false,
				description: "Cursor-based pagination controls for large result sets.",
				fields: [{
					name: "cursor",
					in: "body",
					type: "string",
					required: false,
					description: "Pagination cursor returned by a previous grep response."
				}, {
					name: "limit",
					in: "body",
					type: "integer",
					required: false,
					description: "Maximum number of matches to return (default 200)."
				}]
			},
			{
				name: "paths",
				in: "body",
				type: "array",
				items: "string",
				required: false,
				description: "Optional path prefixes used to narrow the search before pattern matching."
			},
			{
				name: "query",
				in: "body",
				type: "object",
				required: true,
				description: "Pattern configuration.",
				fields: [{
					name: "case_sensitive",
					in: "body",
					type: "boolean",
					required: false,
					description: "Defaults to true when omitted."
				}, {
					name: "pattern",
					in: "body",
					type: "string",
					required: true,
					description: "Regular expression or literal pattern to search for."
				}]
			},
			{
				name: "ref",
				in: "body",
				type: "string",
				required: false,
				description: "Preferred branch, tag, or commit to search."
			},
			{
				name: "rev",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use ref. Legacy ref field retained for backwards compatibility."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: [
			"has_more",
			"incomplete_results",
			"matches",
			"next_cursor",
			"query",
			"repo"
		]
	},
	{
		id: "repos.list",
		resource: "repos",
		method: "list",
		summary: "List Repos",
		description: "List repositories for the current organisation with cursor-based pagination. Supply `q` to filter results by a case-insensitive substring match against `repo_name` (for example `pierre/sdk-documentation`), and `prefix` to filter by the start of `repo_name`. When both are set they combine with AND: a repository is returned only when it matches both filters.\n\nScope: `org:read`.",
		httpMethod: "GET",
		path: "/api/repos",
		scopes: ["org:read"],
		positional: null,
		repoName: null,
		fields: [
			{
				name: "cursor",
				in: "query",
				type: "string",
				required: false,
				description: "Pagination cursor from previous response (base64 encoded)"
			},
			{
				name: "limit",
				in: "query",
				type: "integer",
				required: false,
				description: "Maximum number of repositories to return. Defaults to 20 and is capped at 100."
			},
			{
				name: "prefix",
				in: "query",
				type: "string",
				required: false,
				description: "Case-insensitive prefix to match against the start of `repo_name`. For example, `pierre/` matches `pierre/sdk-documentation` and `pierre/example` but not `acme/pierre-tools`. When `q` is also set, both must match (AND) and `q` only matches the part of `repo_name` after the prefix, so `prefix=pierre/&q=sdk` returns `pierre/sdk-documentation` but not `pierre/example`. Trimmed before matching. When omitted or empty after trimming, no prefix filter applies."
			},
			{
				name: "q",
				in: "query",
				type: "string",
				required: false,
				description: "Case-insensitive substring to match against `repo_name`. Trimmed before matching. When `prefix` is also set, both must match (AND) and `q` only matches the part of `repo_name` after the prefix. When omitted or empty after trimming, the full repository list is returned."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: "repos",
		display: [
			"repo_name",
			"created_at",
			"default_branch"
		]
	},
	{
		id: "repos.merge",
		resource: "repos",
		method: "merge",
		summary: "Merge Branch",
		description: "Merge changes between branches without cloning the repository or shelling out to Git. This endpoint also supports promoting work from ephemeral branches into long-lived branches such as `main`. Set `expected_source_sha` to merge the exact source commit that a preview returned, even if the source branch advances. Omit `expected_target_sha` to merge into the current target tip and allow the gateway to retry stale target/repository movement internally; set `expected_target_sha` to require a strict target-tip precondition. GitHub-backed public targets currently do not use automatic retry.\n\nScope: `git:write` on the repository.",
		httpMethod: "POST",
		path: "/api/repos/{repo_name}/merge",
		scopes: ["git:write"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "allow_unrelated_histories",
				in: "body",
				type: "boolean",
				required: false,
				description: "Permit merges between unrelated histories."
			},
			{
				name: "author",
				in: "body",
				type: "object",
				required: false,
				description: "Author identity used when the backend creates a merge commit. Required for merge-commit strategies.",
				fields: [{
					name: "email",
					in: "body",
					type: "string",
					required: true,
					description: "Email address."
				}, {
					name: "name",
					in: "body",
					type: "string",
					required: true,
					description: "Display name."
				}]
			},
			{
				name: "commit_message",
				in: "body",
				type: "string",
				required: false,
				description: "Commit message used when a merge commit is created."
			},
			{
				name: "committer",
				in: "body",
				type: "object",
				required: false,
				description: "Committer identity for the merge commit. Defaults to author when omitted.",
				fields: [{
					name: "email",
					in: "body",
					type: "string",
					required: true,
					description: "Email address."
				}, {
					name: "name",
					in: "body",
					type: "string",
					required: true,
					description: "Display name."
				}]
			},
			{
				name: "expected_source_sha",
				in: "body",
				type: "string",
				required: false,
				description: "Optional source commit guard. The merge uses this commit instead of the current tip of source_ref, and fails if source_ref does not contain it when the merge starts. A later advance of source_ref does not change the merged commit."
			},
			{
				name: "expected_target_sha",
				in: "body",
				type: "string",
				required: false,
				description: "Optional branch tip guard. The merge fails if the target has moved since this SHA."
			},
			{
				name: "source_branch",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use source_ref. Source branch to merge from."
			},
			{
				name: "source_is_ephemeral",
				in: "body",
				type: "boolean",
				required: false,
				description: "Whether source_ref should be resolved from the ephemeral namespace."
			},
			{
				name: "source_ref",
				in: "body",
				type: "string",
				required: false,
				description: "Branch or refs/heads ref to merge from. The merge reads the source and never updates it. Provide source_ref or the deprecated source_branch."
			},
			{
				name: "squash",
				in: "body",
				type: "boolean",
				required: false,
				description: "When true, collapse the source into a single new commit whose only parent is the current target tip. Defaults to false, which preserves the standard merge/fast-forward behavior. Incompatible with the ff_only strategy."
			},
			{
				name: "strategy",
				in: "body",
				type: "enum",
				values: [
					"ff_only",
					"ff_prefer",
					"merge"
				],
				required: true,
				description: "Merge strategy. merge creates a merge commit when needed, ff_only rejects non-fast-forward merges, and ff_prefer fast-forwards when possible before falling back to a merge commit."
			},
			{
				name: "target_branch",
				in: "body",
				type: "string",
				required: true,
				description: "Destination branch to update. A merge always updates a branch."
			},
			{
				name: "target_is_ephemeral",
				in: "body",
				type: "boolean",
				required: false,
				description: "Whether target_branch should be resolved from the ephemeral namespace."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: [
			"commit_sha",
			"merge_base_sha",
			"promoted_commits",
			"result",
			"source",
			"target",
			"tree_sha"
		]
	},
	{
		id: "repos.notes.append",
		resource: "repos:notes",
		method: "append",
		summary: "Append Note",
		description: "Add text to the note on a Git object, or create the note if the object has none. A retry after a success adds the text again. To make a retry safe, set `expected_notes_ref_sha` to the notes ref SHA that you read before the first request: a retry then fails with 409 and adds nothing.\n\nScope: `git:write` on the repository.",
		httpMethod: "POST",
		path: "/api/repos/{repo_name}/notes/append",
		scopes: ["git:write"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "author",
				in: "body",
				type: "object",
				required: false,
				description: "Author object with name and email for the notes commit.",
				fields: [{
					name: "email",
					in: "body",
					type: "string",
					required: true,
					description: "Email address."
				}, {
					name: "name",
					in: "body",
					type: "string",
					required: true,
					description: "Display name."
				}]
			},
			{
				name: "expected_notes_ref_sha",
				in: "body",
				type: "string",
				required: false,
				description: "Optional compare-and-swap guard for the notes ref. Provide expected_notes_ref_sha or the deprecated expected_ref_sha."
			},
			{
				name: "expected_ref_sha",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use expected_notes_ref_sha. Optional compare-and-swap guard for the notes ref."
			},
			{
				name: "note",
				in: "body",
				type: "string",
				required: true,
				description: "Plain text to add to the note."
			},
			{
				name: "notes_ref",
				in: "body",
				type: "string",
				required: false,
				description: "Optional notes ref to target. A bare name like reviews is placed under refs/notes/; a fully-qualified refs/notes/* ref is also accepted. Defaults to refs/notes/commits. Provide notes_ref or the deprecated ref."
			},
			{
				name: "object_ref",
				in: "body",
				type: "string",
				required: false,
				description: "Git object the note attaches to: a full object SHA (a commit, tree, blob, or annotated tag), or a branch, tag, or other revision that resolves to a commit. Provide object_ref or the deprecated sha."
			},
			{
				name: "ref",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use notes_ref. Optional notes ref to target."
			},
			{
				name: "sha",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use object_ref. Git object SHA to attach the note to."
			}
		],
		content: null,
		response: "json",
		statuses: [201],
		notModified: false,
		itemField: null,
		display: [
			"base_commit",
			"new_ref_sha",
			"notes_ref",
			"result",
			"sha"
		]
	},
	{
		id: "repos.notes.create",
		resource: "repos:notes",
		method: "create",
		summary: "Create Note",
		description: "Attach text to a Git object without changing the repository contents. Use notes for review markers, internal decisions, or other lightweight context. To add text to a note, use `POST /notes/append`.\n\nScope: `git:write` on the repository.",
		httpMethod: "POST",
		path: "/api/repos/{repo_name}/notes",
		scopes: ["git:write"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "action",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use POST /notes/append to append. add creates a note and fails if one already exists. append adds text to the note, and creates the note if none exists."
			},
			{
				name: "author",
				in: "body",
				type: "object",
				required: false,
				description: "Author object with name and email for the notes commit.",
				fields: [{
					name: "email",
					in: "body",
					type: "string",
					required: true,
					description: "Email address."
				}, {
					name: "name",
					in: "body",
					type: "string",
					required: true,
					description: "Display name."
				}]
			},
			{
				name: "expected_notes_ref_sha",
				in: "body",
				type: "string",
				required: false,
				description: "Optional compare-and-swap guard for the notes ref. Provide expected_notes_ref_sha or the deprecated expected_ref_sha."
			},
			{
				name: "expected_ref_sha",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use expected_notes_ref_sha. Optional compare-and-swap guard for the notes ref."
			},
			{
				name: "note",
				in: "body",
				type: "string",
				required: false,
				description: "Plain-text note content. Required."
			},
			{
				name: "notes_ref",
				in: "body",
				type: "string",
				required: false,
				description: "Optional notes ref to target. A bare name like reviews is placed under refs/notes/; a fully-qualified refs/notes/* ref is also accepted. Defaults to refs/notes/commits. Provide notes_ref or the deprecated ref."
			},
			{
				name: "object_ref",
				in: "body",
				type: "string",
				required: false,
				description: "Git object the note attaches to: a full object SHA (a commit, tree, blob, or annotated tag), or a branch, tag, or other revision that resolves to a commit. Provide object_ref or the deprecated sha."
			},
			{
				name: "ref",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use notes_ref. Optional notes ref to target."
			},
			{
				name: "sha",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use object_ref. Git object SHA to attach the note to."
			}
		],
		content: null,
		response: "json",
		statuses: [201],
		notModified: false,
		itemField: null,
		display: [
			"base_commit",
			"new_ref_sha",
			"notes_ref",
			"result",
			"sha"
		]
	},
	{
		id: "repos.notes.delete",
		resource: "repos:notes",
		method: "delete",
		summary: "Delete Note",
		description: "Remove the Git note attached to a commit or other Git object. Name the note with the query parameters of `GET /notes`. The notes commit of the delete has the default author.\n\nScope: `git:write` on the repository.",
		httpMethod: "DELETE",
		path: "/api/repos/{repo_name}/notes",
		scopes: ["git:write"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "expected_notes_ref_sha",
				in: "query",
				type: "string",
				required: false,
				description: "Optional compare-and-swap guard: the notes ref SHA that you read before the delete. The delete fails with 409 when the notes ref has a different SHA."
			},
			{
				name: "notes_ref",
				in: "query",
				type: "string",
				required: false,
				description: "Optional notes ref to delete from. A bare name like reviews is placed under refs/notes/; a fully-qualified refs/notes/* ref is also accepted. Defaults to refs/notes/commits."
			},
			{
				name: "object_ref",
				in: "query",
				type: "string",
				required: false,
				description: "Git object whose note should be deleted: a full object SHA (a commit, tree, blob, or annotated tag), or a branch, tag, or other revision that resolves to a commit. Required unless the deprecated body names the object."
			},
			{
				name: "action",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: a delete ignores action."
			},
			{
				name: "author",
				in: "body",
				type: "object",
				required: false,
				deprecated: true,
				description: "Deprecated: no replacement. Without author, the notes commit of a delete has the default author. Author object with name and email for the notes commit.",
				fields: [{
					name: "email",
					in: "body",
					type: "string",
					required: true,
					description: "Email address."
				}, {
					name: "name",
					in: "body",
					type: "string",
					required: true,
					description: "Display name."
				}]
			},
			{
				name: "expected_ref_sha",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use the expected_notes_ref_sha query parameter. Optional compare-and-swap guard for the notes ref."
			},
			{
				name: "note",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: a delete ignores note."
			},
			{
				name: "ref",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use the notes_ref query parameter. Optional notes ref to target."
			},
			{
				name: "sha",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use the object_ref query parameter. Git object SHA the note attaches to."
			}
		],
		content: null,
		response: "json",
		statuses: [201],
		notModified: false,
		itemField: null,
		display: [
			"base_commit",
			"new_ref_sha",
			"notes_ref",
			"result",
			"sha"
		]
	},
	{
		id: "repos.notes.get",
		resource: "repos:notes",
		method: "get",
		summary: "Get Note",
		description: "Read the Git note attached to a commit or other Git object SHA. Notes let you store review status, handoff details, or other context without changing repository contents.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/notes",
		scopes: ["git:read"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "notes_ref",
				in: "query",
				type: "string",
				required: false,
				description: "Optional notes ref to read from. A bare name like reviews is placed under refs/notes/; a fully-qualified refs/notes/* ref is also accepted. Defaults to refs/notes/commits. Provide notes_ref or the deprecated ref."
			},
			{
				name: "object_ref",
				in: "query",
				type: "string",
				required: false,
				description: "Git object whose note should be fetched. A full object SHA today. Provide object_ref or the deprecated sha."
			},
			{
				name: "ref",
				in: "query",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use notes_ref instead. Optional notes ref to read from. Defaults to refs/notes/commits."
			},
			{
				name: "sha",
				in: "query",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use object_ref instead. Git object SHA whose note should be fetched."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: [
			"note",
			"ref_sha",
			"sha"
		]
	},
	{
		id: "repos.notes.refs.list",
		resource: "repos:notes:refs",
		method: "list",
		summary: "List Notes Refs",
		description: "List Git notes refs under a notes ref prefix with cursor pagination. Use this to discover custom notes namespaces before reading individual notes.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/notes/refs",
		scopes: ["git:read"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "cursor",
				in: "query",
				type: "string",
				required: false,
				description: "Pagination cursor returned by a previous `list_notes_refs` response."
			},
			{
				name: "limit",
				in: "query",
				type: "integer",
				required: false,
				description: "Maximum number of notes refs to return. Defaults to 20."
			},
			{
				name: "prefix",
				in: "query",
				type: "string",
				required: false,
				description: "Notes ref prefix to enumerate. A bare prefix like reviews is placed under refs/notes/; a fully-qualified refs/notes/* prefix is also accepted. Defaults to refs/notes/."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: "refs",
		display: [
			"cursor",
			"ref",
			"sha"
		]
	},
	{
		id: "repos.previewMerge",
		resource: "repos",
		method: "preview-merge",
		summary: "Preview Merge",
		description: "Preview merge conflicts without creating commits, updating refs, or touching a working tree. When requested, conflict content is rendered from Git objects produced in request-local scratch storage.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/merge/preview",
		scopes: ["git:read"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "include_content",
				in: "query",
				type: "boolean",
				required: false,
				description: "When true, include bounded conflict content in the response."
			},
			{
				name: "source_branch",
				in: "query",
				type: "string",
				required: true,
				description: "Source branch to merge from."
			},
			{
				name: "source_is_ephemeral",
				in: "query",
				type: "boolean",
				required: false,
				description: "Whether `source_branch` should be resolved from the ephemeral namespace."
			},
			{
				name: "target_branch",
				in: "query",
				type: "string",
				required: true,
				description: "Destination branch to preview merging into."
			},
			{
				name: "target_is_ephemeral",
				in: "query",
				type: "boolean",
				required: false,
				description: "Whether `target_branch` should be resolved from the ephemeral namespace."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: [
			"conflict_paths",
			"conflicts",
			"filtered_conflicts",
			"merge_base_sha",
			"result",
			"source_branch",
			"source_tip_sha",
			"status",
			"target_branch",
			"target_tip_sha"
		]
	},
	{
		id: "repos.tags.create",
		resource: "repos:tags",
		method: "create",
		summary: "Create Tag",
		description: "Create a lightweight tag pointing to a specific commit. Annotated tags are not created through this endpoint.\n\nScope: `git:write` on the repository.",
		httpMethod: "POST",
		path: "/api/repos/{repo_name}/tags",
		scopes: ["git:write"],
		positional: "name",
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "name",
				in: "body",
				type: "string",
				required: true,
				description: "Tag name. Must be a valid Git ref name and must not start with refs/."
			},
			{
				name: "ref",
				in: "body",
				type: "string",
				required: false,
				description: "Branch, tag, or commit the tag should point to. Provide ref or the deprecated target."
			},
			{
				name: "target",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: use ref. Commit the tag should point to."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: [
			"name",
			"message",
			"sha"
		]
	},
	{
		id: "repos.tags.delete",
		resource: "repos:tags",
		method: "delete",
		summary: "Delete Tag",
		description: "Delete a tag from the repository. The server resolves the stored ref correctly for both lightweight and annotated tags.\n\nScopes: `git:read` and `git:write` on the repository.",
		httpMethod: "DELETE",
		path: "/api/repos/{repo_name}/tags/{tag_name}",
		scopes: ["git:read", "git:write"],
		positional: "tag_name",
		repoName: "path",
		fields: [{
			name: "repo_name",
			in: "path",
			type: "string",
			required: true,
			description: "The repository name, for example `acme/web`."
		}, {
			name: "tag_name",
			in: "path",
			type: "string",
			required: true,
			description: "Tag name."
		}],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: ["name", "message"]
	},
	{
		id: "repos.tags.get",
		resource: "repos:tags",
		method: "get",
		summary: "Get Tag",
		description: "Get one tag by its exact short name. The response returns the dereferenced commit SHA and omits internal fields.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/tag",
		scopes: ["git:read"],
		positional: "name",
		repoName: "path",
		fields: [{
			name: "repo_name",
			in: "path",
			type: "string",
			required: true,
			description: "The repository name, for example `acme/web`."
		}, {
			name: "name",
			in: "query",
			type: "string",
			required: true,
			description: "Exact short tag name."
		}],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: ["tag"]
	},
	{
		id: "repos.tags.list",
		resource: "repos:tags",
		method: "list",
		summary: "List Tags",
		description: "List tags in lexical order with cursor pagination. The returned `sha` is the dereferenced commit SHA, even for annotated tags.\n\nScope: `git:read` on the repository.",
		httpMethod: "GET",
		path: "/api/repos/{repo_name}/tags",
		scopes: ["git:read"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "cursor",
				in: "query",
				type: "string",
				required: false,
				description: "Pagination cursor returned by a previous `list_tags` response."
			},
			{
				name: "limit",
				in: "query",
				type: "integer",
				required: false,
				description: "Maximum number of tags to return. Defaults to 20."
			}
		],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: "tags",
		display: [
			"name",
			"sha",
			"cursor"
		]
	},
	{
		id: "repos.update",
		resource: "repos",
		method: "update",
		summary: "Update Repository Settings",
		description: "Change the default branch of a repository.\n\nThe gateway reads the current `HEAD` symbolic ref, then repoints it at the requested branch through a transactional compare-and-swap against that value, and finally records the new default branch in the repository row. Branch names are fully qualified for you: `main` is written as the symref target `refs/heads/main`, and a value that already starts with `refs/` is used verbatim. The branch itself is not created by this call.\n\nScope: `repo:write` on the repository.",
		httpMethod: "PATCH",
		path: "/api/repos/{repo_name}",
		scopes: ["repo:write"],
		positional: "repo_name",
		repoName: "path",
		fields: [{
			name: "repo_name",
			in: "path",
			type: "string",
			required: true,
			description: "The repository name, for example `acme/web`."
		}, {
			name: "default_branch",
			in: "body",
			type: "string",
			required: false,
			description: "New default branch name for the Code Storage repository."
		}],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: ["repo_name", "default_branch"]
	},
	{
		id: "repos.upstream.delete",
		resource: "repos:upstream",
		method: "delete",
		summary: "Delete Upstream",
		description: "Detach the repository from its configured upstream provider. The operation is idempotent: already-detached repositories return success.\n\nScope: `repo:write` on the repository.",
		httpMethod: "DELETE",
		path: "/api/repos/{repo_name}/upstream",
		scopes: ["repo:write"],
		positional: null,
		repoName: "path",
		fields: [{
			name: "repo_name",
			in: "path",
			type: "string",
			required: true,
			description: "The repository name, for example `acme/web`."
		}],
		content: null,
		response: "json",
		statuses: [200],
		notModified: false,
		itemField: null,
		display: ["message"]
	},
	{
		id: "repos.upstream.pull",
		resource: "repos:upstream",
		method: "pull",
		summary: "Pull Upstream",
		description: "Trigger a sync from the configured upstream of the repository. This only works for repositories that have an `upstream`.\n\nScope: `git:write` on the repository.",
		httpMethod: "POST",
		path: "/api/repos/{repo_name}/upstream/pull",
		scopes: ["git:write"],
		positional: null,
		repoName: "path",
		fields: [
			{
				name: "repo_name",
				in: "path",
				type: "string",
				required: true,
				description: "The repository name, for example `acme/web`."
			},
			{
				name: "after",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: omit it. The field has no effect, and no response returns a token for it. A pull syncs every branch and tag of the upstream."
			},
			{
				name: "ref",
				in: "body",
				type: "string",
				required: false,
				deprecated: true,
				description: "Deprecated: omit it. The field has no effect: a pull syncs every branch and tag of the upstream."
			}
		],
		content: null,
		response: "json",
		statuses: [202],
		notModified: false,
		itemField: null,
		display: ["message"]
	}
];
/** The plural of each singular resource segment. */
const SINGULAR = {
	branch: "branches",
	commit: "commits",
	file: "files",
	"git-credential": "git-credentials",
	note: "notes",
	ref: "refs",
	repo: "repos",
	tag: "tags"
};

// src/prompt.ts
async function readAll(stream) {
	let text = "";
	stream.setEncoding("utf8");
	for await (const chunk of stream) text += chunk;
	return text;
}
/** Ask a yes/no question. --yes answers yes. --no-input or a non-interactive stdin fails. */
async function confirm(session, question) {
	if (session.options.yes) return true;
	if (session.options.noInput || !session.ctx.stdin.isTTY) throw usageError(question, "Pass --yes to confirm without a prompt.");
	const rl = createInterface({
		input: session.ctx.stdin,
		output: session.ctx.stdout
	});
	try {
		const answer = await rl.question(`${question} [y/N] `);
		return /^y(es)?$/i.test(answer.trim());
	} finally {
		rl.close();
	}
}
/**
* Ask a question on stderr and return the trimmed answer. --no-input or a non-interactive stdin
* fails with a usage error that names the flag that gives the answer.
*/
async function ask(session, flag, question) {
	if (session.options.noInput || !session.ctx.stdin.isTTY) throw usageError(`Pass --${flag}.`);
	const rl = createInterface({
		input: session.ctx.stdin,
		output: session.ctx.stderr
	});
	try {
		return (await rl.question(`${question}: `)).trim();
	} finally {
		rl.close();
	}
}
/** Read a pasted PEM from an interactive terminal. Stop after the END line. */
async function readPastedPem(session) {
	if (session.options.noInput) throw usageError("No key was piped on stdin.", "Pipe the key, or pass --from-file <path>.");
	session.info("Paste the private key, then press Enter after the END line.");
	const rl = createInterface({
		input: session.ctx.stdin,
		terminal: false
	});
	const lines = [];
	try {
		for await (const line of rl) {
			lines.push(line);
			if (/^-----END [A-Z ]*PRIVATE KEY-----\s*$/.test(line)) break;
		}
	} finally {
		rl.close();
	}
	return `${lines.join("\n")}\n`;
}

// src/api/fields.ts
/** `repo_name` gives `repo-name`, and `createFromDiff` gives `create-from-diff`. */
function kebab(name) {
	return name.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").replaceAll("_", "-").toLowerCase();
}
/** The flag of a field, for example `--target-branch`. */
function flagOf(field) {
	return `--${kebab(field.name)}`;
}
/** The first paragraph of a description, on one line. */
function firstParagraph(text) {
	return (text ?? "").split(/\n\s*\n/)[0]?.replaceAll(/\s+/g, " ").trim() ?? "";
}
/** The help text of a field: its description, its values, and whether it is required. */
function fieldHelp(field) {
	const parts = [firstParagraph(field.description)];
	if (field.values !== void 0) parts.push(`Known values: ${field.values.join(", ")}.`);
	if (field.type === "boolean") parts.push(`--no-${kebab(field.name)} sends false.`);
	if (field.type === "array") parts.push("Repeat the flag for each item.");
	if (field.type === "object") parts.push("JSON, @file, or @- for stdin.");
	if (field.required) parts.push("Required.");
	return parts.filter(Boolean).join(" ");
}
/** The value of a scalar flag, by the type of its field. */
function scalarValue(type, text, flag) {
	switch (type) {
		case "integer":
			if (!/^-?\d+$/.test(text.trim())) throw usageError(`${flag} needs a whole number.`);
			return Number(text);
		case "number": {
			const value = Number(text);
			if (text.trim() === "" || !Number.isFinite(value)) throw usageError(`${flag} needs a number.`);
			return value;
		}
		case "boolean":
			if (text === "true") return true;
			if (text === "false") return false;
			throw usageError(`${flag} needs true or false.`);
		default: return text;
	}
}
/** The text of `@file`, `@-` for stdin, or the text itself. */
async function textOf(session, value, flag) {
	if (value === "@-") return readAll(session.ctx.stdin);
	if (!value.startsWith("@")) return value;
	const file = value.slice(1);
	try {
		return await readFile(file, "utf8");
	} catch (error) {
		throw usageError(`${flag}: cannot read ${file}: ${errorMessage(error)}`);
	}
}
/** A JSON value from the text of a flag, `@file`, or `@-`. */
async function jsonOf(session, value, flag) {
	const text = await textOf(session, value, flag);
	try {
		return JSON.parse(text);
	} catch {
		throw usageError(`${flag} needs JSON, @file, or @- for stdin.`);
	}
}

// ../typescript/dist/generated/scopes.js
/** Each scope that an operation of this SDK version needs, in name order. */
const SCOPES = [
	"git:read",
	"git:write",
	"org:read",
	"repo:write"
];

// ../typescript/dist/auth.js
/** A token from `createToken` lives 15 minutes by default. */
const DEFAULT_TTL_SECONDS = 900;
/**
* Signs a token with a private key: the key of a client, or `{ org, privateKey }`. A token in a
* URL or a config file is a bearer credential, so keep the lifetime short. The SDK rejects a
* lifetime over 1 hour.
*
* Docs: search for `createToken` in the docs MCP server, https://code.storage/docs/mcp.
*/
async function createToken(credentials, params) {
	const { org, signer } = signingKeyOf(credentials);
	if (params.scopes.length === 0) throw new PierreError("`scopes` must name at least one scope.");
	return signer.sign({
		iss: org,
		sub: params.subject ?? "pierre-sdk-typescript",
		repo: params.repo,
		scopes: params.scopes,
		ttl: checkTtl(params.ttl ?? DEFAULT_TTL_SECONDS, "ttl"),
		refs: refsClaim(checkRefPolicies(params.ref_policies, "ref_policies") ?? ("options" in credentials ? credentials.options.refPolicies : void 0))
	});
}
function signingKeyOf(credentials) {
	const registered = clientKey(credentials);
	if (registered !== void 0) {
		if (registered.signer === void 0 || registered.org === void 0) throw new PierreError("`createToken` needs a client with a private key. A client with `token` or `getToken` cannot sign.");
		return {
			org: registered.org,
			signer: registered.signer
		};
	}
	if ("privateKey" in credentials && typeof credentials.privateKey === "string" && typeof credentials.org === "string" && credentials.org !== "") {
		const { privateKey } = credentials;
		return {
			org: credentials.org,
			signer: keySigner(() => Promise.resolve(privateKey))
		};
	}
	throw new PierreError("Give a client, or `{ org, privateKey }`.");
}

// src/config/shape.ts
const DOMAIN = "code.storage";
/** The org of a host in the <org>.code.storage shape, else undefined. */
function orgFromHost(host) {
	const suffix = `.${DOMAIN}`;
	if (!host.endsWith(suffix)) return void 0;
	const org = host.slice(0, -suffix.length);
	return org && !org.includes(".") ? org : void 0;
}
function defaultHost(org) {
	return `${org}.${DOMAIN}`;
}
function defaultApiUrl(org) {
	return `https://api.${org}.${DOMAIN}/api/v1`;
}
/** Lowercase host with no scheme and no path. */
function normalizeHost(raw, name = "--hostname") {
	const host = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
	if (!/^[a-z0-9][a-z0-9.-]*(:\d+)?$/.test(host)) throw usageError(`${name} needs a host name such as acme.code.storage.`);
	return host;
}
/** An API URL in the <origin>/api/v1 shape. */
function normalizeApiUrl(raw, name = "--api-url") {
	let url;
	try {
		url = new URL(raw.trim());
	} catch {
		throw usageError(`${name} needs an HTTP or HTTPS URL.`);
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") throw usageError(`${name} must be an HTTP or HTTPS URL.`);
	if (url.username || url.password) throw usageError(`${name} must not include credentials.`);
	if (url.search || url.hash) throw usageError(`${name} must not include a query or fragment.`);
	const path = url.pathname.replace(/\/+$/, "");
	return `${url.origin}${/\/api\/v\d+$/.test(path) ? path : `${path}/api/v1`}`;
}
/** The base URL for the SDK, which appends /api/v1 itself. */
function sdkApiBaseUrl(apiUrl) {
	return apiUrl.replace(/\/api\/v\d+$/, "");
}

// src/env.ts
/** The trimmed value of an environment variable, or undefined when it is unset or blank. */
function envValue(env, name) {
	const value = env[name]?.trim();
	return value ? value : void 0;
}

// package.json
var version = "0.1.1";

// src/version.ts
/** The version of this CLI. */
const CLI_VERSION = version;

// src/client.ts
/**
* The scopes of the capabilities that are not in the OpenAPI document yet, so not in `SCOPES`.
* `pierre auth token` signs them, and its help and its errors do not name them. Remove each scope
* when its capability joins the document: until then, this line fails the type check.
*/
const UNLISTED_SCOPES = [
	"deployment:read",
	"deployment:write",
	"sandbox:read",
	"sandbox:write",
	"trigger:read",
	"trigger:write"
];
/** The scopes of a Git token: read and push. */
const DEFAULT_SCOPES = ["git:read", "git:write"];
const READ_ONLY_SCOPES = ["git:read"];
/** The scopes that cover the organization. A token with only these has no `repo` claim. */
const ORG_SCOPES = /* @__PURE__ */ new Set([
	"org:read",
	"sandbox:read",
	"sandbox:write"
]);
/** The lifetime of a token from the credential helper, in seconds. */
const HELPER_TTL_SECONDS = 3600;
/** The SDK rejects a longer lifetime. */
const MAX_TTL_SECONDS = 3600;
const TOKEN_SCOPES = /* @__PURE__ */ new Set([...SCOPES, ...UNLISTED_SCOPES]);
const PUBLIC_SCOPES = new Set(SCOPES);
/** Whether `pierre auth token` signs the scope: a scope of `SCOPES` or of `UNLISTED_SCOPES`. */
function isScope(value) {
	return TOKEN_SCOPES.has(value);
}
/** The scopes of `scopes` that the help and the errors name: the scopes of `SCOPES`. */
function publicScopes(scopes) {
	return [...scopes].filter((scope) => PUBLIC_SCOPES.has(scope));
}
function scopesNeedRepo(scopes) {
	return scopes.some((scope) => !ORG_SCOPES.has(scope));
}
/** The `Pierre` client of the selected host and credential. */
function createClient(credential) {
	const { auth } = credential;
	return new Pierre({
		org: credential.org,
		...auth.kind === "token" ? { token: auth.token } : { privateKey: auth.key },
		baseUrl: sdkApiBaseUrl(credential.apiUrl),
		gitHost: credential.host,
		defaultHeaders: { "Pierre-Client": `pierre-cli/${CLI_VERSION}` }
	});
}
/** Signs a token with the private key of the client (`createToken`). */
function signToken(client, options) {
	return createToken(client, {
		scopes: options.scopes,
		...options.repo === void 0 ? {} : { repo: options.repo },
		ttl: options.ttl,
		subject: "pierre-cli"
	});
}
/** The lifetime of a helper token: PIERRE_TOKEN_TTL in seconds, up to 1 hour, or else 1 hour. */
function tokenTtl(env) {
	const text = envValue(env, "PIERRE_TOKEN_TTL");
	if (text === void 0) return HELPER_TTL_SECONDS;
	const seconds = Number(text);
	if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600) throw usageError(`PIERRE_TOKEN_TTL must be a whole number of seconds from 1 to ${MAX_TTL_SECONDS}.`);
	return seconds;
}

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/identity.js
var require_identity = /* @__PURE__ */ __commonJSMin(((exports) => {
	const ALIAS = Symbol.for("yaml.alias");
	const DOC = Symbol.for("yaml.document");
	const MAP = Symbol.for("yaml.map");
	const PAIR = Symbol.for("yaml.pair");
	const SCALAR = Symbol.for("yaml.scalar");
	const SEQ = Symbol.for("yaml.seq");
	const NODE_TYPE = Symbol.for("yaml.node.type");
	const isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
	const isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
	const isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
	const isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
	const isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
	const isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
	function isCollection(node) {
		if (node && typeof node === "object") switch (node[NODE_TYPE]) {
			case MAP:
			case SEQ: return true;
		}
		return false;
	}
	function isNode(node) {
		if (node && typeof node === "object") switch (node[NODE_TYPE]) {
			case ALIAS:
			case MAP:
			case SCALAR:
			case SEQ: return true;
		}
		return false;
	}
	const hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
	exports.ALIAS = ALIAS;
	exports.DOC = DOC;
	exports.MAP = MAP;
	exports.NODE_TYPE = NODE_TYPE;
	exports.PAIR = PAIR;
	exports.SCALAR = SCALAR;
	exports.SEQ = SEQ;
	exports.hasAnchor = hasAnchor;
	exports.isAlias = isAlias;
	exports.isCollection = isCollection;
	exports.isDocument = isDocument;
	exports.isMap = isMap;
	exports.isNode = isNode;
	exports.isPair = isPair;
	exports.isScalar = isScalar;
	exports.isSeq = isSeq;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/visit.js
var require_visit = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	const BREAK = Symbol("break visit");
	const SKIP = Symbol("skip children");
	const REMOVE = Symbol("remove node");
	/**
	* Apply a visitor to an AST node or document.
	*
	* Walks through the tree (depth-first) starting from `node`, calling a
	* `visitor` function with three arguments:
	*   - `key`: For sequence values and map `Pair`, the node's index in the
	*     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
	*     `null` for the root node.
	*   - `node`: The current node.
	*   - `path`: The ancestry of the current node.
	*
	* The return value of the visitor may be used to control the traversal:
	*   - `undefined` (default): Do nothing and continue
	*   - `visit.SKIP`: Do not visit the children of this node, continue with next
	*     sibling
	*   - `visit.BREAK`: Terminate traversal completely
	*   - `visit.REMOVE`: Remove the current node, then continue with the next one
	*   - `Node`: Replace the current node, then continue by visiting it
	*   - `number`: While iterating the items of a sequence or map, set the index
	*     of the next step. This is useful especially if the index of the current
	*     node has changed.
	*
	* If `visitor` is a single function, it will be called with all values
	* encountered in the tree, including e.g. `null` values. Alternatively,
	* separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
	* `Alias` and `Scalar` node. To define the same visitor function for more than
	* one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
	* and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
	* specific defined one will be used for each node.
	*/
	function visit(node, visitor) {
		const visitor_ = initVisitor(visitor);
		if (identity.isDocument(node)) {
			if (visit_(null, node.contents, visitor_, Object.freeze([node])) === REMOVE) node.contents = null;
		} else visit_(null, node, visitor_, Object.freeze([]));
	}
	/** Terminate visit traversal completely */
	visit.BREAK = BREAK;
	/** Do not visit the children of the current node */
	visit.SKIP = SKIP;
	/** Remove the current node */
	visit.REMOVE = REMOVE;
	function visit_(key, node, visitor, path) {
		const ctrl = callVisitor(key, node, visitor, path);
		if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
			replaceNode(key, path, ctrl);
			return visit_(key, ctrl, visitor, path);
		}
		if (typeof ctrl !== "symbol") {
			if (identity.isCollection(node)) {
				path = Object.freeze(path.concat(node));
				for (let i = 0; i < node.items.length; ++i) {
					const ci = visit_(i, node.items[i], visitor, path);
					if (typeof ci === "number") i = ci - 1;
					else if (ci === BREAK) return BREAK;
					else if (ci === REMOVE) {
						node.items.splice(i, 1);
						i -= 1;
					}
				}
			} else if (identity.isPair(node)) {
				path = Object.freeze(path.concat(node));
				const ck = visit_("key", node.key, visitor, path);
				if (ck === BREAK) return BREAK;
				else if (ck === REMOVE) node.key = null;
				const cv = visit_("value", node.value, visitor, path);
				if (cv === BREAK) return BREAK;
				else if (cv === REMOVE) node.value = null;
			}
		}
		return ctrl;
	}
	/**
	* Apply an async visitor to an AST node or document.
	*
	* Walks through the tree (depth-first) starting from `node`, calling a
	* `visitor` function with three arguments:
	*   - `key`: For sequence values and map `Pair`, the node's index in the
	*     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
	*     `null` for the root node.
	*   - `node`: The current node.
	*   - `path`: The ancestry of the current node.
	*
	* The return value of the visitor may be used to control the traversal:
	*   - `Promise`: Must resolve to one of the following values
	*   - `undefined` (default): Do nothing and continue
	*   - `visit.SKIP`: Do not visit the children of this node, continue with next
	*     sibling
	*   - `visit.BREAK`: Terminate traversal completely
	*   - `visit.REMOVE`: Remove the current node, then continue with the next one
	*   - `Node`: Replace the current node, then continue by visiting it
	*   - `number`: While iterating the items of a sequence or map, set the index
	*     of the next step. This is useful especially if the index of the current
	*     node has changed.
	*
	* If `visitor` is a single function, it will be called with all values
	* encountered in the tree, including e.g. `null` values. Alternatively,
	* separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
	* `Alias` and `Scalar` node. To define the same visitor function for more than
	* one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
	* and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
	* specific defined one will be used for each node.
	*/
	async function visitAsync(node, visitor) {
		const visitor_ = initVisitor(visitor);
		if (identity.isDocument(node)) {
			if (await visitAsync_(null, node.contents, visitor_, Object.freeze([node])) === REMOVE) node.contents = null;
		} else await visitAsync_(null, node, visitor_, Object.freeze([]));
	}
	/** Terminate visit traversal completely */
	visitAsync.BREAK = BREAK;
	/** Do not visit the children of the current node */
	visitAsync.SKIP = SKIP;
	/** Remove the current node */
	visitAsync.REMOVE = REMOVE;
	async function visitAsync_(key, node, visitor, path) {
		const ctrl = await callVisitor(key, node, visitor, path);
		if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
			replaceNode(key, path, ctrl);
			return visitAsync_(key, ctrl, visitor, path);
		}
		if (typeof ctrl !== "symbol") {
			if (identity.isCollection(node)) {
				path = Object.freeze(path.concat(node));
				for (let i = 0; i < node.items.length; ++i) {
					const ci = await visitAsync_(i, node.items[i], visitor, path);
					if (typeof ci === "number") i = ci - 1;
					else if (ci === BREAK) return BREAK;
					else if (ci === REMOVE) {
						node.items.splice(i, 1);
						i -= 1;
					}
				}
			} else if (identity.isPair(node)) {
				path = Object.freeze(path.concat(node));
				const ck = await visitAsync_("key", node.key, visitor, path);
				if (ck === BREAK) return BREAK;
				else if (ck === REMOVE) node.key = null;
				const cv = await visitAsync_("value", node.value, visitor, path);
				if (cv === BREAK) return BREAK;
				else if (cv === REMOVE) node.value = null;
			}
		}
		return ctrl;
	}
	function initVisitor(visitor) {
		if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) return Object.assign({
			Alias: visitor.Node,
			Map: visitor.Node,
			Scalar: visitor.Node,
			Seq: visitor.Node
		}, visitor.Value && {
			Map: visitor.Value,
			Scalar: visitor.Value,
			Seq: visitor.Value
		}, visitor.Collection && {
			Map: visitor.Collection,
			Seq: visitor.Collection
		}, visitor);
		return visitor;
	}
	function callVisitor(key, node, visitor, path) {
		if (typeof visitor === "function") return visitor(key, node, path);
		if (identity.isMap(node)) return visitor.Map?.(key, node, path);
		if (identity.isSeq(node)) return visitor.Seq?.(key, node, path);
		if (identity.isPair(node)) return visitor.Pair?.(key, node, path);
		if (identity.isScalar(node)) return visitor.Scalar?.(key, node, path);
		if (identity.isAlias(node)) return visitor.Alias?.(key, node, path);
	}
	function replaceNode(key, path, node) {
		const parent = path[path.length - 1];
		if (identity.isCollection(parent)) parent.items[key] = node;
		else if (identity.isPair(parent)) {
			if (key === "key") parent.key = node;
			else parent.value = node;
		} else if (identity.isDocument(parent)) parent.contents = node;
		else {
			const pt = identity.isAlias(parent) ? "alias" : "scalar";
			throw new Error(`Cannot replace node with ${pt} parent`);
		}
	}
	exports.visit = visit;
	exports.visitAsync = visitAsync;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/directives.js
var require_directives = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var visit = require_visit();
	const escapeChars = {
		"!": "%21",
		",": "%2C",
		"[": "%5B",
		"]": "%5D",
		"{": "%7B",
		"}": "%7D"
	};
	const escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
	var Directives = class Directives {
		constructor(yaml, tags) {
			/**
			* The directives-end/doc-start marker `---`. If `null`, a marker may still be
			* included in the document's stringified representation.
			*/
			this.docStart = null;
			/** The doc-end marker `...`.  */
			this.docEnd = false;
			this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
			this.tags = Object.assign({}, Directives.defaultTags, tags);
		}
		clone() {
			const copy = new Directives(this.yaml, this.tags);
			copy.docStart = this.docStart;
			return copy;
		}
		/**
		* During parsing, get a Directives instance for the current document and
		* update the stream state according to the current version's spec.
		*/
		atDocument() {
			const res = new Directives(this.yaml, this.tags);
			switch (this.yaml.version) {
				case "1.1":
					this.atNextDocument = true;
					break;
				case "1.2":
					this.atNextDocument = false;
					this.yaml = {
						explicit: Directives.defaultYaml.explicit,
						version: "1.2"
					};
					this.tags = Object.assign({}, Directives.defaultTags);
			}
			return res;
		}
		/**
		* @param onError - May be called even if the action was successful
		* @returns `true` on success
		*/
		add(line, onError) {
			if (this.atNextDocument) {
				this.yaml = {
					explicit: Directives.defaultYaml.explicit,
					version: "1.1"
				};
				this.tags = Object.assign({}, Directives.defaultTags);
				this.atNextDocument = false;
			}
			const parts = line.trim().split(/[ \t]+/);
			const name = parts.shift();
			switch (name) {
				case "%TAG": {
					if (parts.length !== 2) {
						onError(0, "%TAG directive should contain exactly two parts");
						if (parts.length < 2) return false;
					}
					const [handle, prefix] = parts;
					this.tags[handle] = prefix;
					return true;
				}
				case "%YAML": {
					this.yaml.explicit = true;
					if (parts.length !== 1) {
						onError(0, "%YAML directive should contain exactly one part");
						return false;
					}
					const [version] = parts;
					if (version === "1.1" || version === "1.2") {
						this.yaml.version = version;
						return true;
					} else {
						const isValid = /^\d+\.\d+$/.test(version);
						onError(6, `Unsupported YAML version ${version}`, isValid);
						return false;
					}
				}
				default:
					onError(0, `Unknown directive ${name}`, true);
					return false;
			}
		}
		/**
		* Resolves a tag, matching handles to those defined in %TAG directives.
		*
		* @returns Resolved tag, which may also be the non-specific tag `'!'` or a
		*   `'!local'` tag, or `null` if unresolvable.
		*/
		tagName(source, onError) {
			if (source === "!") return "!";
			if (source[0] !== "!") {
				onError(`Not a valid tag: ${source}`);
				return null;
			}
			if (source[1] === "<") {
				const verbatim = source.slice(2, -1);
				if (verbatim === "!" || verbatim === "!!") {
					onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
					return null;
				}
				if (source[source.length - 1] !== ">") onError("Verbatim tags must end with a >");
				return verbatim;
			}
			const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
			if (!suffix) onError(`The ${source} tag has no suffix`);
			const prefix = this.tags[handle];
			if (prefix) try {
				return prefix + decodeURIComponent(suffix);
			} catch (error) {
				onError(String(error));
				return null;
			}
			if (handle === "!") return source;
			onError(`Could not resolve tag: ${source}`);
			return null;
		}
		/**
		* Given a fully resolved tag, returns its printable string form,
		* taking into account current tag prefixes and defaults.
		*/
		tagString(tag) {
			for (const [handle, prefix] of Object.entries(this.tags)) if (tag.startsWith(prefix)) return handle + escapeTagName(tag.substring(prefix.length));
			return tag[0] === "!" ? tag : `!<${tag}>`;
		}
		toString(doc) {
			const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
			const tagEntries = Object.entries(this.tags);
			let tagNames;
			if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
				const tags = {};
				visit.visit(doc.contents, (_key, node) => {
					if (identity.isNode(node) && node.tag) tags[node.tag] = true;
				});
				tagNames = Object.keys(tags);
			} else tagNames = [];
			for (const [handle, prefix] of tagEntries) {
				if (handle === "!!" && prefix === "tag:yaml.org,2002:") continue;
				if (!doc || tagNames.some((tn) => tn.startsWith(prefix))) lines.push(`%TAG ${handle} ${prefix}`);
			}
			return lines.join("\n");
		}
	};
	Directives.defaultYaml = {
		explicit: false,
		version: "1.2"
	};
	Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
	exports.Directives = Directives;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/anchors.js
var require_anchors = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var visit = require_visit();
	/**
	* Verify that the input string is a valid anchor.
	*
	* Will throw on errors.
	*/
	function anchorIsValid(anchor) {
		if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
			const msg = `Anchor must not contain whitespace or control characters: ${JSON.stringify(anchor)}`;
			throw new Error(msg);
		}
		return true;
	}
	function anchorNames(root) {
		const anchors = /* @__PURE__ */ new Set();
		visit.visit(root, { Value(_key, node) {
			if (node.anchor) anchors.add(node.anchor);
		} });
		return anchors;
	}
	/** Find a new anchor name with the given `prefix` and a one-indexed suffix. */
	function findNewAnchor(prefix, exclude) {
		for (let i = 1;; ++i) {
			const name = `${prefix}${i}`;
			if (!exclude.has(name)) return name;
		}
	}
	function createNodeAnchors(doc, prefix) {
		const aliasObjects = [];
		const sourceObjects = /* @__PURE__ */ new Map();
		let prevAnchors = null;
		return {
			onAnchor: (source) => {
				aliasObjects.push(source);
				prevAnchors ?? (prevAnchors = anchorNames(doc));
				const anchor = findNewAnchor(prefix, prevAnchors);
				prevAnchors.add(anchor);
				return anchor;
			},
			/**
			* With circular references, the source node is only resolved after all
			* of its child nodes are. This is why anchors are set only after all of
			* the nodes have been created.
			*/
			setAnchors: () => {
				for (const source of aliasObjects) {
					const ref = sourceObjects.get(source);
					if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) ref.node.anchor = ref.anchor;
					else {
						const error = /* @__PURE__ */ new Error("Failed to resolve repeated object (this should not happen)");
						error.source = source;
						throw error;
					}
				}
			},
			sourceObjects
		};
	}
	exports.anchorIsValid = anchorIsValid;
	exports.anchorNames = anchorNames;
	exports.createNodeAnchors = createNodeAnchors;
	exports.findNewAnchor = findNewAnchor;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Applies the JSON.parse reviver algorithm as defined in the ECMA-262 spec,
	* in section 24.5.1.1 "Runtime Semantics: InternalizeJSONProperty" of the
	* 2021 edition: https://tc39.es/ecma262/#sec-json.parse
	*
	* Includes extensions for handling Map and Set objects.
	*/
	function applyReviver(reviver, obj, key, val) {
		if (val && typeof val === "object") {
			if (Array.isArray(val)) for (let i = 0, len = val.length; i < len; ++i) {
				const v0 = val[i];
				const v1 = applyReviver(reviver, val, String(i), v0);
				if (v1 === void 0) delete val[i];
				else if (v1 !== v0) val[i] = v1;
			}
			else if (val instanceof Map) for (const k of Array.from(val.keys())) {
				const v0 = val.get(k);
				const v1 = applyReviver(reviver, val, k, v0);
				if (v1 === void 0) val.delete(k);
				else if (v1 !== v0) val.set(k, v1);
			}
			else if (val instanceof Set) for (const v0 of Array.from(val)) {
				const v1 = applyReviver(reviver, val, v0, v0);
				if (v1 === void 0) val.delete(v0);
				else if (v1 !== v0) {
					val.delete(v0);
					val.add(v1);
				}
			}
			else for (const [k, v0] of Object.entries(val)) {
				const v1 = applyReviver(reviver, val, k, v0);
				if (v1 === void 0) delete val[k];
				else if (v1 !== v0) val[k] = v1;
			}
		}
		return reviver.call(obj, key, val);
	}
	exports.applyReviver = applyReviver;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	/**
	* Recursively convert any node or its contents to native JavaScript
	*
	* @param value - The input value
	* @param arg - If `value` defines a `toJSON()` method, use this
	*   as its first argument
	* @param ctx - Conversion context, originally set in Document#toJS(). If
	*   `{ keep: true }` is not set, output should be suitable for JSON
	*   stringification.
	*/
	function toJS(value, arg, ctx) {
		if (Array.isArray(value)) return value.map((v, i) => toJS(v, String(i), ctx));
		if (value && typeof value.toJSON === "function") {
			if (!ctx || !identity.hasAnchor(value)) return value.toJSON(arg, ctx);
			const data = {
				aliasCount: 0,
				count: 1,
				res: void 0
			};
			ctx.anchors.set(value, data);
			ctx.onCreate = (res) => {
				data.res = res;
				delete ctx.onCreate;
			};
			const res = value.toJSON(arg, ctx);
			if (ctx.onCreate) ctx.onCreate(res);
			return res;
		}
		if (typeof value === "bigint" && !ctx?.keep) return Number(value);
		return value;
	}
	exports.toJS = toJS;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Node.js
var require_Node = /* @__PURE__ */ __commonJSMin(((exports) => {
	var applyReviver = require_applyReviver();
	var identity = require_identity();
	var toJS = require_toJS();
	var NodeBase = class {
		constructor(type) {
			Object.defineProperty(this, identity.NODE_TYPE, { value: type });
		}
		/** Create a copy of this node.  */
		clone() {
			const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
			if (this.range) copy.range = this.range.slice();
			return copy;
		}
		/** A plain JavaScript representation of this node. */
		toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
			if (!identity.isDocument(doc)) throw new TypeError("A document argument is required");
			const ctx = {
				anchors: /* @__PURE__ */ new Map(),
				doc,
				keep: true,
				mapAsMap: mapAsMap === true,
				mapKeyWarned: false,
				maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
			};
			const res = toJS.toJS(this, "", ctx);
			if (typeof onAnchor === "function") for (const { count, res } of ctx.anchors.values()) onAnchor(res, count);
			return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
		}
	};
	exports.NodeBase = NodeBase;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = /* @__PURE__ */ __commonJSMin(((exports) => {
	var anchors = require_anchors();
	var visit = require_visit();
	var identity = require_identity();
	var Node = require_Node();
	var toJS = require_toJS();
	var Alias = class extends Node.NodeBase {
		constructor(source) {
			super(identity.ALIAS);
			this.source = source;
			Object.defineProperty(this, "tag", { set() {
				throw new Error("Alias nodes cannot have tags");
			} });
		}
		/**
		* Resolve the value of this alias within `doc`, finding the last
		* instance of the `source` anchor before this node.
		*/
		resolve(doc, ctx) {
			if (ctx?.maxAliasCount === 0) throw new ReferenceError("Alias resolution is disabled");
			let nodes;
			if (ctx?.aliasResolveCache) nodes = ctx.aliasResolveCache;
			else {
				nodes = [];
				visit.visit(doc, { Node: (_key, node) => {
					if (identity.isAlias(node) || identity.hasAnchor(node)) nodes.push(node);
				} });
				if (ctx) ctx.aliasResolveCache = nodes;
			}
			let found = void 0;
			for (const node of nodes) {
				if (node === this) break;
				if (node.anchor === this.source) found = node;
			}
			if (found && ctx) {
				const { anchors, doc, maxAliasCount } = ctx;
				let data = anchors.get(found);
				if (!data) {
					toJS.toJS(found, null, ctx);
					data = anchors.get(found);
				}
				/* istanbul ignore if */
				if (data?.res === void 0) throw new ReferenceError("This should not happen: Alias anchor was not resolved?");
				if (maxAliasCount >= 0) {
					data.count += 1;
					if (data.aliasCount === 0) data.aliasCount = getAliasCount(doc, found, anchors);
					if (data.count * data.aliasCount > maxAliasCount) throw new ReferenceError("Excessive alias count indicates a resource exhaustion attack");
				}
			}
			return found;
		}
		toJSON(_arg, ctx) {
			if (!ctx) return { source: this.source };
			const source = this.resolve(ctx.doc, ctx);
			if (!source) {
				const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
				throw new ReferenceError(msg);
			}
			return ctx.anchors.get(source).res;
		}
		toString(ctx, _onComment, _onChompKeep) {
			const src = `*${this.source}`;
			if (ctx) {
				anchors.anchorIsValid(this.source);
				if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
					const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
					throw new Error(msg);
				}
				if (ctx.implicitKey) return `${src} `;
			}
			return src;
		}
	};
	function getAliasCount(doc, node, anchors) {
		if (identity.isAlias(node)) {
			const source = node.resolve(doc);
			const anchor = anchors && source && anchors.get(source);
			return anchor ? anchor.count * anchor.aliasCount : 0;
		} else if (identity.isCollection(node)) {
			let count = 0;
			for (const item of node.items) {
				const c = getAliasCount(doc, item, anchors);
				if (c > count) count = c;
			}
			return count;
		} else if (identity.isPair(node)) {
			const kc = getAliasCount(doc, node.key, anchors);
			const vc = getAliasCount(doc, node.value, anchors);
			return Math.max(kc, vc);
		}
		return 1;
	}
	exports.Alias = Alias;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Node = require_Node();
	var toJS = require_toJS();
	const isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
	var Scalar = class extends Node.NodeBase {
		constructor(value) {
			super(identity.SCALAR);
			this.value = value;
		}
		toJSON(arg, ctx) {
			return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
		}
		toString() {
			return String(this.value);
		}
	};
	Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
	Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
	Scalar.PLAIN = "PLAIN";
	Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
	Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
	exports.Scalar = Scalar;
	exports.isScalarValue = isScalarValue;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/createNode.js
var require_createNode = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Alias = require_Alias();
	var identity = require_identity();
	var Scalar = require_Scalar();
	const defaultTagPrefix = "tag:yaml.org,2002:";
	function findTagObject(value, tagName, tags) {
		if (tagName) {
			const match = tags.filter((t) => t.tag === tagName);
			const tagObj = match.find((t) => !t.format) ?? match[0];
			if (!tagObj) throw new Error(`Tag ${tagName} not found`);
			return tagObj;
		}
		return tags.find((t) => t.identify?.(value) && !t.format);
	}
	function createNode(value, tagName, ctx) {
		if (identity.isDocument(value)) value = value.contents;
		if (identity.isNode(value)) return value;
		if (identity.isPair(value)) {
			const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
			map.items.push(value);
			return map;
		}
		if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) value = value.valueOf();
		const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
		let ref = void 0;
		if (aliasDuplicateObjects && value && typeof value === "object") {
			ref = sourceObjects.get(value);
			if (ref) {
				ref.anchor ?? (ref.anchor = onAnchor(value));
				return new Alias.Alias(ref.anchor);
			} else {
				ref = {
					anchor: null,
					node: null
				};
				sourceObjects.set(value, ref);
			}
		}
		if (tagName?.startsWith("!!")) tagName = defaultTagPrefix + tagName.slice(2);
		let tagObj = findTagObject(value, tagName, schema.tags);
		if (!tagObj) {
			if (value && typeof value.toJSON === "function") value = value.toJSON();
			if (!value || typeof value !== "object") {
				const node = new Scalar.Scalar(value);
				if (ref) ref.node = node;
				return node;
			}
			tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
		}
		if (onTagObj) {
			onTagObj(tagObj);
			delete ctx.onTagObj;
		}
		const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
		if (tagName) node.tag = tagName;
		else if (!tagObj.default) node.tag = tagObj.tag;
		if (ref) ref.node = node;
		return node;
	}
	exports.createNode = createNode;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = /* @__PURE__ */ __commonJSMin(((exports) => {
	var createNode = require_createNode();
	var identity = require_identity();
	var Node = require_Node();
	function collectionFromPath(schema, path, value) {
		let v = value;
		for (let i = path.length - 1; i >= 0; --i) {
			const k = path[i];
			if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
				const a = [];
				a[k] = v;
				v = a;
			} else v = /* @__PURE__ */ new Map([[k, v]]);
		}
		return createNode.createNode(v, void 0, {
			aliasDuplicateObjects: false,
			keepUndefined: false,
			onAnchor: () => {
				throw new Error("This should not happen, please report a bug.");
			},
			schema,
			sourceObjects: /* @__PURE__ */ new Map()
		});
	}
	const isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
	var Collection = class extends Node.NodeBase {
		constructor(type, schema) {
			super(type);
			Object.defineProperty(this, "schema", {
				value: schema,
				configurable: true,
				enumerable: false,
				writable: true
			});
		}
		/**
		* Create a copy of this collection.
		*
		* @param schema - If defined, overwrites the original's schema
		*/
		clone(schema) {
			const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
			if (schema) copy.schema = schema;
			copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
			if (this.range) copy.range = this.range.slice();
			return copy;
		}
		/**
		* Adds a value to the collection. For `!!map` and `!!omap` the value must
		* be a Pair instance or a `{ key, value }` object, which may not have a key
		* that already exists in the map.
		*/
		addIn(path, value) {
			if (isEmptyPath(path)) this.add(value);
			else {
				const [key, ...rest] = path;
				const node = this.get(key, true);
				if (identity.isCollection(node)) node.addIn(rest, value);
				else if (node === void 0 && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));
				else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
			}
		}
		/**
		* Removes a value from the collection.
		* @returns `true` if the item was found and removed.
		*/
		deleteIn(path) {
			const [key, ...rest] = path;
			if (rest.length === 0) return this.delete(key);
			const node = this.get(key, true);
			if (identity.isCollection(node)) return node.deleteIn(rest);
			else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
		}
		/**
		* Returns item at `key`, or `undefined` if not found. By default unwraps
		* scalar values from their surrounding node; to disable set `keepScalar` to
		* `true` (collections are always returned intact).
		*/
		getIn(path, keepScalar) {
			const [key, ...rest] = path;
			const node = this.get(key, true);
			if (rest.length === 0) return !keepScalar && identity.isScalar(node) ? node.value : node;
			else return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
		}
		hasAllNullValues(allowScalar) {
			return this.items.every((node) => {
				if (!identity.isPair(node)) return false;
				const n = node.value;
				return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
			});
		}
		/**
		* Checks if the collection includes a value with the key `key`.
		*/
		hasIn(path) {
			const [key, ...rest] = path;
			if (rest.length === 0) return this.has(key);
			const node = this.get(key, true);
			return identity.isCollection(node) ? node.hasIn(rest) : false;
		}
		/**
		* Sets a value in this collection. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*/
		setIn(path, value) {
			const [key, ...rest] = path;
			if (rest.length === 0) this.set(key, value);
			else {
				const node = this.get(key, true);
				if (identity.isCollection(node)) node.setIn(rest, value);
				else if (node === void 0 && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));
				else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
			}
		}
	};
	exports.Collection = Collection;
	exports.collectionFromPath = collectionFromPath;
	exports.isEmptyPath = isEmptyPath;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Stringifies a comment.
	*
	* Empty comment lines are left empty,
	* lines consisting of a single space are replaced by `#`,
	* and all other lines are prefixed with a `#`.
	*/
	const stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
	function indentComment(comment, indent) {
		if (/^\n+$/.test(comment)) return comment.substring(1);
		return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
	}
	const lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
	exports.indentComment = indentComment;
	exports.lineComment = lineComment;
	exports.stringifyComment = stringifyComment;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = /* @__PURE__ */ __commonJSMin(((exports) => {
	const FOLD_FLOW = "flow";
	const FOLD_BLOCK = "block";
	const FOLD_QUOTED = "quoted";
	/**
	* Tries to keep input at up to `lineWidth` characters, splitting only on spaces
	* not followed by newlines or spaces unless `mode` is `'quoted'`. Lines are
	* terminated with `\n` and started with `indent`.
	*/
	function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
		if (!lineWidth || lineWidth < 0) return text;
		if (lineWidth < minContentWidth) minContentWidth = 0;
		const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
		if (text.length <= endStep) return text;
		const folds = [];
		const escapedFolds = {};
		let end = lineWidth - indent.length;
		if (typeof indentAtStart === "number") {
			if (indentAtStart > lineWidth - Math.max(2, minContentWidth)) folds.push(0);
			else end = lineWidth - indentAtStart;
		}
		let split = void 0;
		let prev = void 0;
		let overflow = false;
		let i = -1;
		let escStart = -1;
		let escEnd = -1;
		if (mode === FOLD_BLOCK) {
			i = consumeMoreIndentedLines(text, i, indent.length);
			if (i !== -1) end = i + endStep;
		}
		for (let ch; ch = text[i += 1];) {
			if (mode === FOLD_QUOTED && ch === "\\") {
				escStart = i;
				switch (text[i + 1]) {
					case "x":
						i += 3;
						break;
					case "u":
						i += 5;
						break;
					case "U":
						i += 9;
						break;
					default: i += 1;
				}
				escEnd = i;
			}
			if (ch === "\n") {
				if (mode === FOLD_BLOCK) i = consumeMoreIndentedLines(text, i, indent.length);
				end = i + indent.length + endStep;
				split = void 0;
			} else {
				if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
					const next = text[i + 1];
					if (next && next !== " " && next !== "\n" && next !== "	") split = i;
				}
				if (i >= end) {
					if (split) {
						folds.push(split);
						end = split + endStep;
						split = void 0;
					} else if (mode === FOLD_QUOTED) {
						while (prev === " " || prev === "	") {
							prev = ch;
							ch = text[i += 1];
							overflow = true;
						}
						const j = i > escEnd + 1 ? i - 2 : escStart - 1;
						if (escapedFolds[j]) return text;
						folds.push(j);
						escapedFolds[j] = true;
						end = j + endStep;
						split = void 0;
					} else overflow = true;
				}
			}
			prev = ch;
		}
		if (overflow && onOverflow) onOverflow();
		if (folds.length === 0) return text;
		if (onFold) onFold();
		let res = text.slice(0, folds[0]);
		for (let i = 0; i < folds.length; ++i) {
			const fold = folds[i];
			const end = folds[i + 1] || text.length;
			if (fold === 0) res = `\n${indent}${text.slice(0, end)}`;
			else {
				if (mode === FOLD_QUOTED && escapedFolds[fold]) res += `${text[fold]}\\`;
				res += `\n${indent}${text.slice(fold + 1, end)}`;
			}
		}
		return res;
	}
	/**
	* Presumes `i + 1` is at the start of a line
	* @returns index of last newline in more-indented block
	*/
	function consumeMoreIndentedLines(text, i, indent) {
		let end = i;
		let start = i + 1;
		let ch = text[start];
		while (ch === " " || ch === "	") if (i < start + indent) ch = text[++i];
		else {
			do
				ch = text[++i];
			while (ch && ch !== "\n");
			end = i;
			start = i + 1;
			ch = text[start];
		}
		return end;
	}
	exports.FOLD_BLOCK = FOLD_BLOCK;
	exports.FOLD_FLOW = FOLD_FLOW;
	exports.FOLD_QUOTED = FOLD_QUOTED;
	exports.foldFlowLines = foldFlowLines;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var foldFlowLines = require_foldFlowLines();
	const getFoldOptions = (ctx, isBlock) => ({
		indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
		lineWidth: ctx.options.lineWidth,
		minContentWidth: ctx.options.minContentWidth
	});
	const containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
	function lineLengthOverLimit(str, lineWidth, indentLength) {
		if (!lineWidth || lineWidth < 0) return false;
		const limit = lineWidth - indentLength;
		const strLen = str.length;
		if (strLen <= limit) return false;
		for (let i = 0, start = 0; i < strLen; ++i) if (str[i] === "\n") {
			if (i - start > limit) return true;
			start = i + 1;
			if (strLen - start <= limit) return false;
		}
		return true;
	}
	function doubleQuotedString(value, ctx) {
		const json = JSON.stringify(value);
		if (ctx.options.doubleQuotedAsJSON) return json;
		const { implicitKey } = ctx;
		const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
		const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
		let str = "";
		let start = 0;
		for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
			if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
				str += json.slice(start, i) + "\\ ";
				i += 1;
				start = i;
				ch = "\\";
			}
			if (ch === "\\") switch (json[i + 1]) {
				case "u":
					{
						str += json.slice(start, i);
						const code = json.substr(i + 2, 4);
						switch (code) {
							case "0000":
								str += "\\0";
								break;
							case "0007":
								str += "\\a";
								break;
							case "000b":
								str += "\\v";
								break;
							case "001b":
								str += "\\e";
								break;
							case "0085":
								str += "\\N";
								break;
							case "00a0":
								str += "\\_";
								break;
							case "2028":
								str += "\\L";
								break;
							case "2029":
								str += "\\P";
								break;
							default: if (code.substr(0, 2) === "00") str += "\\x" + code.substr(2);
							else str += json.substr(i, 6);
						}
						i += 5;
						start = i + 1;
					}
					break;
				case "n":
					if (implicitKey || json[i + 2] === "\"" || json.length < minMultiLineLength) i += 1;
					else {
						str += json.slice(start, i) + "\n\n";
						while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== "\"") {
							str += "\n";
							i += 2;
						}
						str += indent;
						if (json[i + 2] === " ") str += "\\";
						i += 1;
						start = i + 1;
					}
					break;
				default: i += 1;
			}
		}
		str = start ? str + json.slice(start) : json;
		return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
	}
	function singleQuotedString(value, ctx) {
		if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value)) return doubleQuotedString(value, ctx);
		const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
		const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&\n${indent}`) + "'";
		return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
	}
	function quotedString(value, ctx) {
		const { singleQuote } = ctx.options;
		let qs;
		if (singleQuote === false) qs = doubleQuotedString;
		else {
			const hasDouble = value.includes("\"");
			const hasSingle = value.includes("'");
			if (hasDouble && !hasSingle) qs = singleQuotedString;
			else if (hasSingle && !hasDouble) qs = doubleQuotedString;
			else qs = singleQuote ? singleQuotedString : doubleQuotedString;
		}
		return qs(value, ctx);
	}
	let blockEndNewlines;
	try {
		blockEndNewlines = /* @__PURE__ */ new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
	} catch {
		blockEndNewlines = /\n+(?!\n|$)/g;
	}
	function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
		const { blockQuote, commentString, lineWidth } = ctx.options;
		if (!blockQuote || /\n[\t ]+$/.test(value)) return quotedString(value, ctx);
		const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
		const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
		if (!value) return literal ? "|\n" : ">\n";
		let chomp;
		let endStart;
		for (endStart = value.length; endStart > 0; --endStart) {
			const ch = value[endStart - 1];
			if (ch !== "\n" && ch !== "	" && ch !== " ") break;
		}
		let end = value.substring(endStart);
		const endNlPos = end.indexOf("\n");
		if (endNlPos === -1) chomp = "-";
		else if (value === end || endNlPos !== end.length - 1) {
			chomp = "+";
			if (onChompKeep) onChompKeep();
		} else chomp = "";
		if (end) {
			value = value.slice(0, -end.length);
			if (end[end.length - 1] === "\n") end = end.slice(0, -1);
			end = end.replace(blockEndNewlines, `$&${indent}`);
		}
		let startWithSpace = false;
		let startEnd;
		let startNlPos = -1;
		for (startEnd = 0; startEnd < value.length; ++startEnd) {
			const ch = value[startEnd];
			if (ch === " ") startWithSpace = true;
			else if (ch === "\n") startNlPos = startEnd;
			else break;
		}
		let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
		if (start) {
			value = value.substring(start.length);
			start = start.replace(/\n+/g, `$&${indent}`);
		}
		let header = (startWithSpace ? indent ? "2" : "1" : "") + chomp;
		if (comment) {
			header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
			if (onComment) onComment();
		}
		if (!literal) {
			const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
			let literalFallback = false;
			const foldOptions = getFoldOptions(ctx, true);
			if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) foldOptions.onOverflow = () => {
				literalFallback = true;
			};
			const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
			if (!literalFallback) return `>${header}\n${indent}${body}`;
		}
		value = value.replace(/\n+/g, `$&${indent}`);
		return `|${header}\n${indent}${start}${value}${end}`;
	}
	function plainString(item, ctx, onComment, onChompKeep) {
		const { type, value } = item;
		const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
		if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) return quotedString(value, ctx);
		if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
		if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) return blockString(item, ctx, onComment, onChompKeep);
		if (containsDocumentMarker(value)) {
			if (indent === "") {
				ctx.forceBlockIndent = true;
				return blockString(item, ctx, onComment, onChompKeep);
			} else if (implicitKey && indent === indentStep) return quotedString(value, ctx);
		}
		const str = value.replace(/\n+/g, `$&\n${indent}`);
		if (actualString) {
			const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
			const { compat, tags } = ctx.doc.schema;
			if (tags.some(test) || compat?.some(test)) return quotedString(value, ctx);
		}
		return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
	}
	function stringifyString(item, ctx, onComment, onChompKeep) {
		const { implicitKey, inFlow } = ctx;
		const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
		let { type } = item;
		if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
			if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value)) type = Scalar.Scalar.QUOTE_DOUBLE;
		}
		const _stringify = (_type) => {
			switch (_type) {
				case Scalar.Scalar.BLOCK_FOLDED:
				case Scalar.Scalar.BLOCK_LITERAL: return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
				case Scalar.Scalar.QUOTE_DOUBLE: return doubleQuotedString(ss.value, ctx);
				case Scalar.Scalar.QUOTE_SINGLE: return singleQuotedString(ss.value, ctx);
				case Scalar.Scalar.PLAIN: return plainString(ss, ctx, onComment, onChompKeep);
				default: return null;
			}
		};
		let res = _stringify(type);
		if (res === null) {
			const { defaultKeyType, defaultStringType } = ctx.options;
			const t = implicitKey && defaultKeyType || defaultStringType;
			res = _stringify(t);
			if (res === null) throw new Error(`Unsupported default string type ${t}`);
		}
		return res;
	}
	exports.stringifyString = stringifyString;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = /* @__PURE__ */ __commonJSMin(((exports) => {
	var anchors = require_anchors();
	var identity = require_identity();
	var stringifyComment = require_stringifyComment();
	var stringifyString = require_stringifyString();
	function createStringifyContext(doc, options) {
		const opt = Object.assign({
			blockQuote: true,
			commentString: stringifyComment.stringifyComment,
			defaultKeyType: null,
			defaultStringType: "PLAIN",
			directives: null,
			doubleQuotedAsJSON: false,
			doubleQuotedMinMultiLineLength: 40,
			falseStr: "false",
			flowCollectionPadding: true,
			indentSeq: true,
			lineWidth: 80,
			minContentWidth: 20,
			nullStr: "null",
			simpleKeys: false,
			singleQuote: null,
			trailingComma: false,
			trueStr: "true",
			verifyAliasOrder: true
		}, doc.schema.toStringOptions, options);
		let inFlow;
		switch (opt.collectionStyle) {
			case "block":
				inFlow = false;
				break;
			case "flow":
				inFlow = true;
				break;
			default: inFlow = null;
		}
		return {
			anchors: /* @__PURE__ */ new Set(),
			doc,
			flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
			indent: "",
			indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
			inFlow,
			options: opt
		};
	}
	function getTagObject(tags, item) {
		if (item.tag) {
			const match = tags.filter((t) => t.tag === item.tag);
			if (match.length > 0) return match.find((t) => t.format === item.format) ?? match[0];
		}
		let tagObj = void 0;
		let obj;
		if (identity.isScalar(item)) {
			obj = item.value;
			let match = tags.filter((t) => t.identify?.(obj));
			if (match.length > 1) {
				const testMatch = match.filter((t) => t.test);
				if (testMatch.length > 0) match = testMatch;
			}
			tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
		} else {
			obj = item;
			tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
		}
		if (!tagObj) {
			const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
			throw new Error(`Tag not resolved for ${name} value`);
		}
		return tagObj;
	}
	function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
		if (!doc.directives) return "";
		const props = [];
		const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
		if (anchor && anchors.anchorIsValid(anchor)) {
			anchors$1.add(anchor);
			props.push(`&${anchor}`);
		}
		const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
		if (tag) props.push(doc.directives.tagString(tag));
		return props.join(" ");
	}
	function stringify(item, ctx, onComment, onChompKeep) {
		if (identity.isPair(item)) return item.toString(ctx, onComment, onChompKeep);
		if (identity.isAlias(item)) {
			if (ctx.doc.directives) return item.toString(ctx);
			if (ctx.resolvedAliases?.has(item)) throw new TypeError(`Cannot stringify circular structure without alias nodes`);
			else {
				if (ctx.resolvedAliases) ctx.resolvedAliases.add(item);
				else ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
				item = item.resolve(ctx.doc);
			}
		}
		let tagObj = void 0;
		const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
		tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
		const props = stringifyProps(node, tagObj, ctx);
		if (props.length > 0) ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
		const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
		if (!props) return str;
		return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}\n${ctx.indent}${str}`;
	}
	exports.createStringifyContext = createStringifyContext;
	exports.stringify = stringify;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Scalar = require_Scalar();
	var stringify = require_stringify();
	var stringifyComment = require_stringifyComment();
	function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
		const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
		let keyComment = identity.isNode(key) && key.comment || null;
		if (simpleKeys) {
			if (keyComment) throw new Error("With simple keys, key nodes cannot have comments");
			if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") throw new Error("With simple keys, collection cannot be used as a key value");
		}
		let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
		ctx = Object.assign({}, ctx, {
			allNullValues: false,
			implicitKey: !explicitKey && (simpleKeys || !allNullValues),
			indent: indent + indentStep
		});
		let keyCommentDone = false;
		let chompKeep = false;
		let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
		if (!explicitKey && !ctx.inFlow && str.length > 1024) {
			if (simpleKeys) throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
			explicitKey = true;
		}
		if (ctx.inFlow) {
			if (allNullValues || value == null) {
				if (keyCommentDone && onComment) onComment();
				return str === "" ? "?" : explicitKey ? `? ${str}` : str;
			}
		} else if (allNullValues && !simpleKeys || value == null && explicitKey) {
			str = `? ${str}`;
			if (keyComment && !keyCommentDone) str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
			else if (chompKeep && onChompKeep) onChompKeep();
			return str;
		}
		if (keyCommentDone) keyComment = null;
		if (explicitKey) {
			if (keyComment) str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
			str = `? ${str}\n${indent}:`;
		} else {
			str = `${str}:`;
			if (keyComment) str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
		}
		let vsb, vcb, valueComment;
		if (identity.isNode(value)) {
			vsb = !!value.spaceBefore;
			vcb = value.commentBefore;
			valueComment = value.comment;
		} else {
			vsb = false;
			vcb = null;
			valueComment = null;
			if (value && typeof value === "object") value = doc.createNode(value);
		}
		ctx.implicitKey = false;
		if (!explicitKey && !keyComment && identity.isScalar(value)) ctx.indentAtStart = str.length + 1;
		chompKeep = false;
		if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) ctx.indent = ctx.indent.substring(2);
		let valueCommentDone = false;
		const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
		let ws = " ";
		if (keyComment || vsb || vcb) {
			ws = vsb ? "\n" : "";
			if (vcb) {
				const cs = commentString(vcb);
				ws += `\n${stringifyComment.indentComment(cs, ctx.indent)}`;
			}
			if (valueStr === "" && !ctx.inFlow) {
				if (ws === "\n" && valueComment) ws = "\n\n";
			} else ws += `\n${ctx.indent}`;
		} else if (!explicitKey && identity.isCollection(value)) {
			const vs0 = valueStr[0];
			const nl0 = valueStr.indexOf("\n");
			const hasNewline = nl0 !== -1;
			const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
			if (hasNewline || !flow) {
				let hasPropsLine = false;
				if (hasNewline && (vs0 === "&" || vs0 === "!")) {
					let sp0 = valueStr.indexOf(" ");
					if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") sp0 = valueStr.indexOf(" ", sp0 + 1);
					if (sp0 === -1 || nl0 < sp0) hasPropsLine = true;
				}
				if (!hasPropsLine) ws = `\n${ctx.indent}`;
			}
		} else if (valueStr === "" || valueStr[0] === "\n") ws = "";
		str += ws + valueStr;
		if (ctx.inFlow) {
			if (valueCommentDone && onComment) onComment();
		} else if (valueComment && !valueCommentDone) str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
		else if (chompKeep && onChompKeep) onChompKeep();
		return str;
	}
	exports.stringifyPair = stringifyPair;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/log.js
var require_log = /* @__PURE__ */ __commonJSMin(((exports) => {
	var node_process = __require("process");
	function debug(logLevel, ...messages) {
		if (logLevel === "debug") console.log(...messages);
	}
	function warn(logLevel, warning) {
		if (logLevel === "debug" || logLevel === "warn") {
			if (typeof node_process.emitWarning === "function") node_process.emitWarning(warning);
			else console.warn(warning);
		}
	}
	exports.debug = debug;
	exports.warn = warn;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Scalar = require_Scalar();
	const MERGE_KEY = "<<";
	const merge = {
		identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
		default: "key",
		tag: "tag:yaml.org,2002:merge",
		test: /^<<$/,
		resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), { addToJSMap: addMergeToJSMap }),
		stringify: () => MERGE_KEY
	};
	const isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
	function addMergeToJSMap(ctx, map, value) {
		const source = resolveAliasValue(ctx, value);
		if (identity.isSeq(source)) for (const it of source.items) mergeValue(ctx, map, it);
		else if (Array.isArray(source)) for (const it of source) mergeValue(ctx, map, it);
		else mergeValue(ctx, map, source);
	}
	function mergeValue(ctx, map, value) {
		const source = resolveAliasValue(ctx, value);
		if (!identity.isMap(source)) throw new Error("Merge sources must be maps or map aliases");
		const srcMap = source.toJSON(null, ctx, Map);
		for (const [key, value] of srcMap) if (map instanceof Map) {
			if (!map.has(key)) map.set(key, value);
		} else if (map instanceof Set) map.add(key);
		else if (!Object.prototype.hasOwnProperty.call(map, key)) Object.defineProperty(map, key, {
			value,
			writable: true,
			enumerable: true,
			configurable: true
		});
		return map;
	}
	function resolveAliasValue(ctx, value) {
		return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
	}
	exports.addMergeToJSMap = addMergeToJSMap;
	exports.isMergeKey = isMergeKey;
	exports.merge = merge;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = /* @__PURE__ */ __commonJSMin(((exports) => {
	var log = require_log();
	var merge = require_merge();
	var stringify = require_stringify();
	var identity = require_identity();
	var toJS = require_toJS();
	function addPairToJSMap(ctx, map, { key, value }) {
		if (identity.isNode(key) && key.addToJSMap) key.addToJSMap(ctx, map, value);
		else if (merge.isMergeKey(ctx, key)) merge.addMergeToJSMap(ctx, map, value);
		else {
			const jsKey = toJS.toJS(key, "", ctx);
			if (map instanceof Map) map.set(jsKey, toJS.toJS(value, jsKey, ctx));
			else if (map instanceof Set) map.add(jsKey);
			else {
				const stringKey = stringifyKey(key, jsKey, ctx);
				const jsValue = toJS.toJS(value, stringKey, ctx);
				if (stringKey in map) Object.defineProperty(map, stringKey, {
					value: jsValue,
					writable: true,
					enumerable: true,
					configurable: true
				});
				else map[stringKey] = jsValue;
			}
		}
		return map;
	}
	function stringifyKey(key, jsKey, ctx) {
		if (jsKey === null) return "";
		if (typeof jsKey !== "object") return String(jsKey);
		if (identity.isNode(key) && ctx?.doc) {
			const strCtx = stringify.createStringifyContext(ctx.doc, {});
			strCtx.anchors = /* @__PURE__ */ new Set();
			for (const node of ctx.anchors.keys()) strCtx.anchors.add(node.anchor);
			strCtx.inFlow = true;
			strCtx.inStringifyKey = true;
			const strKey = key.toString(strCtx);
			if (!ctx.mapKeyWarned) {
				let jsonStr = JSON.stringify(strKey);
				if (jsonStr.length > 40) jsonStr = jsonStr.substring(0, 36) + "...\"";
				log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
				ctx.mapKeyWarned = true;
			}
			return strKey;
		}
		return JSON.stringify(jsKey);
	}
	exports.addPairToJSMap = addPairToJSMap;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = /* @__PURE__ */ __commonJSMin(((exports) => {
	var createNode = require_createNode();
	var stringifyPair = require_stringifyPair();
	var addPairToJSMap = require_addPairToJSMap();
	var identity = require_identity();
	function createPair(key, value, ctx) {
		const k = createNode.createNode(key, void 0, ctx);
		const v = createNode.createNode(value, void 0, ctx);
		return new Pair(k, v);
	}
	var Pair = class Pair {
		constructor(key, value = null) {
			Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
			this.key = key;
			this.value = value;
		}
		clone(schema) {
			let { key, value } = this;
			if (identity.isNode(key)) key = key.clone(schema);
			if (identity.isNode(value)) value = value.clone(schema);
			return new Pair(key, value);
		}
		toJSON(_, ctx) {
			const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
			return addPairToJSMap.addPairToJSMap(ctx, pair, this);
		}
		toString(ctx, onComment, onChompKeep) {
			return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
		}
	};
	exports.Pair = Pair;
	exports.createPair = createPair;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var stringify = require_stringify();
	var stringifyComment = require_stringifyComment();
	function stringifyCollection(collection, ctx, options) {
		return (ctx.inFlow ?? collection.flow ? stringifyFlowCollection : stringifyBlockCollection)(collection, ctx, options);
	}
	function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
		const { indent, options: { commentString } } = ctx;
		const itemCtx = Object.assign({}, ctx, {
			indent: itemIndent,
			type: null
		});
		let chompKeep = false;
		const lines = [];
		for (let i = 0; i < items.length; ++i) {
			const item = items[i];
			let comment = null;
			if (identity.isNode(item)) {
				if (!chompKeep && item.spaceBefore) lines.push("");
				addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
				if (item.comment) comment = item.comment;
			} else if (identity.isPair(item)) {
				const ik = identity.isNode(item.key) ? item.key : null;
				if (ik) {
					if (!chompKeep && ik.spaceBefore) lines.push("");
					addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
				}
			}
			chompKeep = false;
			let str = stringify.stringify(item, itemCtx, () => comment = null, () => chompKeep = true);
			if (comment) str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
			if (chompKeep && comment) chompKeep = false;
			lines.push(blockItemPrefix + str);
		}
		let str;
		if (lines.length === 0) str = flowChars.start + flowChars.end;
		else {
			str = lines[0];
			for (let i = 1; i < lines.length; ++i) {
				const line = lines[i];
				str += line ? `\n${indent}${line}` : "\n";
			}
		}
		if (comment) {
			str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
			if (onComment) onComment();
		} else if (chompKeep && onChompKeep) onChompKeep();
		return str;
	}
	function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
		const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
		itemIndent += indentStep;
		const itemCtx = Object.assign({}, ctx, {
			indent: itemIndent,
			inFlow: true,
			type: null
		});
		let reqNewline = false;
		let linesAtValue = 0;
		const lines = [];
		for (let i = 0; i < items.length; ++i) {
			const item = items[i];
			let comment = null;
			if (identity.isNode(item)) {
				if (item.spaceBefore) lines.push("");
				addCommentBefore(ctx, lines, item.commentBefore, false);
				if (item.comment) comment = item.comment;
			} else if (identity.isPair(item)) {
				const ik = identity.isNode(item.key) ? item.key : null;
				if (ik) {
					if (ik.spaceBefore) lines.push("");
					addCommentBefore(ctx, lines, ik.commentBefore, false);
					if (ik.comment) reqNewline = true;
				}
				const iv = identity.isNode(item.value) ? item.value : null;
				if (iv) {
					if (iv.comment) comment = iv.comment;
					if (iv.commentBefore) reqNewline = true;
				} else if (item.value == null && ik?.comment) comment = ik.comment;
			}
			if (comment) reqNewline = true;
			let str = stringify.stringify(item, itemCtx, () => comment = null);
			reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
			if (i < items.length - 1) str += ",";
			else if (ctx.options.trailingComma) {
				if (ctx.options.lineWidth > 0) reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
				if (reqNewline) str += ",";
			}
			if (comment) str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
			lines.push(str);
			linesAtValue = lines.length;
		}
		const { start, end } = flowChars;
		if (lines.length === 0) return start + end;
		else {
			if (!reqNewline) {
				const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
				reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
			}
			if (reqNewline) {
				let str = start;
				for (const line of lines) str += line ? `\n${indentStep}${indent}${line}` : "\n";
				return `${str}\n${indent}${end}`;
			} else return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
		}
	}
	function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
		if (comment && chompKeep) comment = comment.replace(/^\n+/, "");
		if (comment) {
			const ic = stringifyComment.indentComment(commentString(comment), indent);
			lines.push(ic.trimStart());
		}
	}
	exports.stringifyCollection = stringifyCollection;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyCollection = require_stringifyCollection();
	var addPairToJSMap = require_addPairToJSMap();
	var Collection = require_Collection();
	var identity = require_identity();
	var Pair = require_Pair();
	var Scalar = require_Scalar();
	function findPair(items, key) {
		const k = identity.isScalar(key) ? key.value : key;
		for (const it of items) if (identity.isPair(it)) {
			if (it.key === key || it.key === k) return it;
			if (identity.isScalar(it.key) && it.key.value === k) return it;
		}
	}
	var YAMLMap = class extends Collection.Collection {
		static get tagName() {
			return "tag:yaml.org,2002:map";
		}
		constructor(schema) {
			super(identity.MAP, schema);
			this.items = [];
		}
		/**
		* A generic collection parsing method that can be extended
		* to other node classes that inherit from YAMLMap
		*/
		static from(schema, obj, ctx) {
			const { keepUndefined, replacer } = ctx;
			const map = new this(schema);
			const add = (key, value) => {
				if (typeof replacer === "function") value = replacer.call(obj, key, value);
				else if (Array.isArray(replacer) && !replacer.includes(key)) return;
				if (value !== void 0 || keepUndefined) map.items.push(Pair.createPair(key, value, ctx));
			};
			if (obj instanceof Map) for (const [key, value] of obj) add(key, value);
			else if (obj && typeof obj === "object") for (const key of Object.keys(obj)) add(key, obj[key]);
			if (typeof schema.sortMapEntries === "function") map.items.sort(schema.sortMapEntries);
			return map;
		}
		/**
		* Adds a value to the collection.
		*
		* @param overwrite - If not set `true`, using a key that is already in the
		*   collection will throw. Otherwise, overwrites the previous value.
		*/
		add(pair, overwrite) {
			let _pair;
			if (identity.isPair(pair)) _pair = pair;
			else if (!pair || typeof pair !== "object" || !("key" in pair)) _pair = new Pair.Pair(pair, pair?.value);
			else _pair = new Pair.Pair(pair.key, pair.value);
			const prev = findPair(this.items, _pair.key);
			const sortEntries = this.schema?.sortMapEntries;
			if (prev) {
				if (!overwrite) throw new Error(`Key ${_pair.key} already set`);
				if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value)) prev.value.value = _pair.value;
				else prev.value = _pair.value;
			} else if (sortEntries) {
				const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
				if (i === -1) this.items.push(_pair);
				else this.items.splice(i, 0, _pair);
			} else this.items.push(_pair);
		}
		delete(key) {
			const it = findPair(this.items, key);
			if (!it) return false;
			return this.items.splice(this.items.indexOf(it), 1).length > 0;
		}
		get(key, keepScalar) {
			const node = findPair(this.items, key)?.value;
			return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
		}
		has(key) {
			return !!findPair(this.items, key);
		}
		set(key, value) {
			this.add(new Pair.Pair(key, value), true);
		}
		/**
		* @param ctx - Conversion context, originally set in Document#toJS()
		* @param {Class} Type - If set, forces the returned collection type
		* @returns Instance of Type, Map, or Object
		*/
		toJSON(_, ctx, Type) {
			const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
			if (ctx?.onCreate) ctx.onCreate(map);
			for (const item of this.items) addPairToJSMap.addPairToJSMap(ctx, map, item);
			return map;
		}
		toString(ctx, onComment, onChompKeep) {
			if (!ctx) return JSON.stringify(this);
			for (const item of this.items) if (!identity.isPair(item)) throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
			if (!ctx.allNullValues && this.hasAllNullValues(false)) ctx = Object.assign({}, ctx, { allNullValues: true });
			return stringifyCollection.stringifyCollection(this, ctx, {
				blockItemPrefix: "",
				flowChars: {
					start: "{",
					end: "}"
				},
				itemIndent: ctx.indent || "",
				onChompKeep,
				onComment
			});
		}
	};
	exports.YAMLMap = YAMLMap;
	exports.findPair = findPair;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/map.js
var require_map = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var YAMLMap = require_YAMLMap();
	const map = {
		collection: "map",
		default: true,
		nodeClass: YAMLMap.YAMLMap,
		tag: "tag:yaml.org,2002:map",
		resolve(map, onError) {
			if (!identity.isMap(map)) onError("Expected a mapping for this tag");
			return map;
		},
		createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
	};
	exports.map = map;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = /* @__PURE__ */ __commonJSMin(((exports) => {
	var createNode = require_createNode();
	var stringifyCollection = require_stringifyCollection();
	var Collection = require_Collection();
	var identity = require_identity();
	var Scalar = require_Scalar();
	var toJS = require_toJS();
	var YAMLSeq = class extends Collection.Collection {
		static get tagName() {
			return "tag:yaml.org,2002:seq";
		}
		constructor(schema) {
			super(identity.SEQ, schema);
			this.items = [];
		}
		add(value) {
			this.items.push(value);
		}
		/**
		* Removes a value from the collection.
		*
		* `key` must contain a representation of an integer for this to succeed.
		* It may be wrapped in a `Scalar`.
		*
		* @returns `true` if the item was found and removed.
		*/
		delete(key) {
			const idx = asItemIndex(key);
			if (typeof idx !== "number") return false;
			return this.items.splice(idx, 1).length > 0;
		}
		get(key, keepScalar) {
			const idx = asItemIndex(key);
			if (typeof idx !== "number") return void 0;
			const it = this.items[idx];
			return !keepScalar && identity.isScalar(it) ? it.value : it;
		}
		/**
		* Checks if the collection includes a value with the key `key`.
		*
		* `key` must contain a representation of an integer for this to succeed.
		* It may be wrapped in a `Scalar`.
		*/
		has(key) {
			const idx = asItemIndex(key);
			return typeof idx === "number" && idx < this.items.length;
		}
		/**
		* Sets a value in this collection. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*
		* If `key` does not contain a representation of an integer, this will throw.
		* It may be wrapped in a `Scalar`.
		*/
		set(key, value) {
			const idx = asItemIndex(key);
			if (typeof idx !== "number") throw new Error(`Expected a valid index, not ${key}.`);
			const prev = this.items[idx];
			if (identity.isScalar(prev) && Scalar.isScalarValue(value)) prev.value = value;
			else this.items[idx] = value;
		}
		toJSON(_, ctx) {
			const seq = [];
			if (ctx?.onCreate) ctx.onCreate(seq);
			let i = 0;
			for (const item of this.items) seq.push(toJS.toJS(item, String(i++), ctx));
			return seq;
		}
		toString(ctx, onComment, onChompKeep) {
			if (!ctx) return JSON.stringify(this);
			return stringifyCollection.stringifyCollection(this, ctx, {
				blockItemPrefix: "- ",
				flowChars: {
					start: "[",
					end: "]"
				},
				itemIndent: (ctx.indent || "") + "  ",
				onChompKeep,
				onComment
			});
		}
		static from(schema, obj, ctx) {
			const { replacer } = ctx;
			const seq = new this(schema);
			if (obj && Symbol.iterator in Object(obj)) {
				let i = 0;
				for (let it of obj) {
					if (typeof replacer === "function") {
						const key = obj instanceof Set ? it : String(i++);
						it = replacer.call(obj, key, it);
					}
					seq.items.push(createNode.createNode(it, void 0, ctx));
				}
			}
			return seq;
		}
	};
	function asItemIndex(key) {
		let idx = identity.isScalar(key) ? key.value : key;
		if (idx && typeof idx === "string") idx = Number(idx);
		return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
	}
	exports.YAMLSeq = YAMLSeq;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/seq.js
var require_seq = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var YAMLSeq = require_YAMLSeq();
	const seq = {
		collection: "seq",
		default: true,
		nodeClass: YAMLSeq.YAMLSeq,
		tag: "tag:yaml.org,2002:seq",
		resolve(seq, onError) {
			if (!identity.isSeq(seq)) onError("Expected a sequence for this tag");
			return seq;
		},
		createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
	};
	exports.seq = seq;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/string.js
var require_string = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyString = require_stringifyString();
	const string = {
		identify: (value) => typeof value === "string",
		default: true,
		tag: "tag:yaml.org,2002:str",
		resolve: (str) => str,
		stringify(item, ctx, onComment, onChompKeep) {
			ctx = Object.assign({ actualString: true }, ctx);
			return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
		}
	};
	exports.string = string;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/null.js
var require_null = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	const nullTag = {
		identify: (value) => value == null,
		createNode: () => new Scalar.Scalar(null),
		default: true,
		tag: "tag:yaml.org,2002:null",
		test: /^(?:~|[Nn]ull|NULL)?$/,
		resolve: () => new Scalar.Scalar(null),
		stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
	};
	exports.nullTag = nullTag;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/bool.js
var require_bool$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	const boolTag = {
		identify: (value) => typeof value === "boolean",
		default: true,
		tag: "tag:yaml.org,2002:bool",
		test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
		resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
		stringify({ source, value }, ctx) {
			if (source && boolTag.test.test(source)) {
				if (value === (source[0] === "t" || source[0] === "T")) return source;
			}
			return value ? ctx.options.trueStr : ctx.options.falseStr;
		}
	};
	exports.boolTag = boolTag;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = /* @__PURE__ */ __commonJSMin(((exports) => {
	function stringifyNumber({ format, minFractionDigits, tag, value }) {
		if (typeof value === "bigint") return String(value);
		const num = typeof value === "number" ? value : Number(value);
		if (!isFinite(num)) return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
		let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
		if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
			let i = n.indexOf(".");
			if (i < 0) {
				i = n.length;
				n += ".";
			}
			let d = minFractionDigits - (n.length - i - 1);
			while (d-- > 0) n += "0";
		}
		return n;
	}
	exports.stringifyNumber = stringifyNumber;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/float.js
var require_float$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var stringifyNumber = require_stringifyNumber();
	const floatNaN = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
		resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
		stringify: stringifyNumber.stringifyNumber
	};
	const floatExp = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		format: "EXP",
		test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
		resolve: (str) => parseFloat(str),
		stringify(node) {
			const num = Number(node.value);
			return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
		}
	};
	const float = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
		resolve(str) {
			const node = new Scalar.Scalar(parseFloat(str));
			const dot = str.indexOf(".");
			if (dot !== -1 && str[str.length - 1] === "0") node.minFractionDigits = str.length - dot - 1;
			return node;
		},
		stringify: stringifyNumber.stringifyNumber
	};
	exports.float = float;
	exports.floatExp = floatExp;
	exports.floatNaN = floatNaN;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/int.js
var require_int$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyNumber = require_stringifyNumber();
	const intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
	const intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
	function intStringify(node, radix, prefix) {
		const { value } = node;
		if (intIdentify(value) && value >= 0) return prefix + value.toString(radix);
		return stringifyNumber.stringifyNumber(node);
	}
	const intOct = {
		identify: (value) => intIdentify(value) && value >= 0,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "OCT",
		test: /^0o[0-7]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
		stringify: (node) => intStringify(node, 8, "0o")
	};
	const int = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		test: /^[-+]?[0-9]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
		stringify: stringifyNumber.stringifyNumber
	};
	const intHex = {
		identify: (value) => intIdentify(value) && value >= 0,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "HEX",
		test: /^0x[0-9a-fA-F]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
		stringify: (node) => intStringify(node, 16, "0x")
	};
	exports.int = int;
	exports.intHex = intHex;
	exports.intOct = intOct;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/schema.js
var require_schema$2 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var map = require_map();
	var _null = require_null();
	var seq = require_seq();
	var string = require_string();
	var bool = require_bool$1();
	var float = require_float$1();
	var int = require_int$1();
	const schema = [
		map.map,
		seq.seq,
		string.string,
		_null.nullTag,
		bool.boolTag,
		int.intOct,
		int.int,
		int.intHex,
		float.floatNaN,
		float.floatExp,
		float.float
	];
	exports.schema = schema;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/json/schema.js
var require_schema$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var map = require_map();
	var seq = require_seq();
	function intIdentify(value) {
		return typeof value === "bigint" || Number.isInteger(value);
	}
	const stringifyJSON = ({ value }) => JSON.stringify(value);
	const jsonScalars = [
		{
			identify: (value) => typeof value === "string",
			default: true,
			tag: "tag:yaml.org,2002:str",
			resolve: (str) => str,
			stringify: stringifyJSON
		},
		{
			identify: (value) => value == null,
			createNode: () => new Scalar.Scalar(null),
			default: true,
			tag: "tag:yaml.org,2002:null",
			test: /^null$/,
			resolve: () => null,
			stringify: stringifyJSON
		},
		{
			identify: (value) => typeof value === "boolean",
			default: true,
			tag: "tag:yaml.org,2002:bool",
			test: /^true$|^false$/,
			resolve: (str) => str === "true",
			stringify: stringifyJSON
		},
		{
			identify: intIdentify,
			default: true,
			tag: "tag:yaml.org,2002:int",
			test: /^-?(?:0|[1-9][0-9]*)$/,
			resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
			stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
		},
		{
			identify: (value) => typeof value === "number",
			default: true,
			tag: "tag:yaml.org,2002:float",
			test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
			resolve: (str) => parseFloat(str),
			stringify: stringifyJSON
		}
	];
	const schema = [map.map, seq.seq].concat(jsonScalars, {
		default: true,
		tag: "",
		test: /^/,
		resolve(str, onError) {
			onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
			return str;
		}
	});
	exports.schema = schema;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = /* @__PURE__ */ __commonJSMin(((exports) => {
	var node_buffer = __require("buffer");
	var Scalar = require_Scalar();
	var stringifyString = require_stringifyString();
	const binary = {
		identify: (value) => value instanceof Uint8Array,
		default: false,
		tag: "tag:yaml.org,2002:binary",
		/**
		* Returns a Buffer in node and an Uint8Array in browsers
		*
		* To use the resulting buffer as an image, you'll want to do something like:
		*
		*   const blob = new Blob([buffer], { type: 'image/jpeg' })
		*   document.querySelector('#photo').src = URL.createObjectURL(blob)
		*/
		resolve(src, onError) {
			if (typeof node_buffer.Buffer === "function") return node_buffer.Buffer.from(src, "base64");
			else if (typeof atob === "function") {
				const str = atob(src.replace(/[\n\r]/g, ""));
				const buffer = new Uint8Array(str.length);
				for (let i = 0; i < str.length; ++i) buffer[i] = str.charCodeAt(i);
				return buffer;
			} else {
				onError("This environment does not support reading binary tags; either Buffer or atob is required");
				return src;
			}
		},
		stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
			if (!value) return "";
			const buf = value;
			let str;
			if (typeof node_buffer.Buffer === "function") str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
			else if (typeof btoa === "function") {
				let s = "";
				for (let i = 0; i < buf.length; ++i) s += String.fromCharCode(buf[i]);
				str = btoa(s);
			} else throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
			type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
			if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
				const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
				const n = Math.ceil(str.length / lineWidth);
				const lines = new Array(n);
				for (let i = 0, o = 0; i < n; ++i, o += lineWidth) lines[i] = str.substr(o, lineWidth);
				str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
			}
			return stringifyString.stringifyString({
				comment,
				type,
				value: str
			}, ctx, onComment, onChompKeep);
		}
	};
	exports.binary = binary;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Pair = require_Pair();
	var Scalar = require_Scalar();
	var YAMLSeq = require_YAMLSeq();
	function resolvePairs(seq, onError) {
		if (identity.isSeq(seq)) for (let i = 0; i < seq.items.length; ++i) {
			let item = seq.items[i];
			if (identity.isPair(item)) continue;
			else if (identity.isMap(item)) {
				if (item.items.length > 1) onError("Each pair must have its own sequence indicator");
				const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
				if (item.commentBefore) pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}\n${pair.key.commentBefore}` : item.commentBefore;
				if (item.comment) {
					const cn = pair.value ?? pair.key;
					cn.comment = cn.comment ? `${item.comment}\n${cn.comment}` : item.comment;
				}
				item = pair;
			}
			seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
		}
		else onError("Expected a sequence for this tag");
		return seq;
	}
	function createPairs(schema, iterable, ctx) {
		const { replacer } = ctx;
		const pairs = new YAMLSeq.YAMLSeq(schema);
		pairs.tag = "tag:yaml.org,2002:pairs";
		let i = 0;
		if (iterable && Symbol.iterator in Object(iterable)) for (let it of iterable) {
			if (typeof replacer === "function") it = replacer.call(iterable, String(i++), it);
			let key, value;
			if (Array.isArray(it)) {
				if (it.length === 2) {
					key = it[0];
					value = it[1];
				} else throw new TypeError(`Expected [key, value] tuple: ${it}`);
			} else if (it && it instanceof Object) {
				const keys = Object.keys(it);
				if (keys.length === 1) {
					key = keys[0];
					value = it[key];
				} else throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
			} else key = it;
			pairs.items.push(Pair.createPair(key, value, ctx));
		}
		return pairs;
	}
	const pairs = {
		collection: "seq",
		default: false,
		tag: "tag:yaml.org,2002:pairs",
		resolve: resolvePairs,
		createNode: createPairs
	};
	exports.createPairs = createPairs;
	exports.pairs = pairs;
	exports.resolvePairs = resolvePairs;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var toJS = require_toJS();
	var YAMLMap = require_YAMLMap();
	var YAMLSeq = require_YAMLSeq();
	var pairs = require_pairs();
	var YAMLOMap = class YAMLOMap extends YAMLSeq.YAMLSeq {
		constructor() {
			super();
			this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
			this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
			this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
			this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
			this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
			this.tag = YAMLOMap.tag;
		}
		/**
		* If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
		* but TypeScript won't allow widening the signature of a child method.
		*/
		toJSON(_, ctx) {
			if (!ctx) return super.toJSON(_);
			const map = /* @__PURE__ */ new Map();
			if (ctx?.onCreate) ctx.onCreate(map);
			for (const pair of this.items) {
				let key, value;
				if (identity.isPair(pair)) {
					key = toJS.toJS(pair.key, "", ctx);
					value = toJS.toJS(pair.value, key, ctx);
				} else key = toJS.toJS(pair, "", ctx);
				if (map.has(key)) throw new Error("Ordered maps must not include duplicate keys");
				map.set(key, value);
			}
			return map;
		}
		static from(schema, iterable, ctx) {
			const pairs$1 = pairs.createPairs(schema, iterable, ctx);
			const omap = new this();
			omap.items = pairs$1.items;
			return omap;
		}
	};
	YAMLOMap.tag = "tag:yaml.org,2002:omap";
	const omap = {
		collection: "seq",
		identify: (value) => value instanceof Map,
		nodeClass: YAMLOMap,
		default: false,
		tag: "tag:yaml.org,2002:omap",
		resolve(seq, onError) {
			const pairs$1 = pairs.resolvePairs(seq, onError);
			const seenKeys = [];
			for (const { key } of pairs$1.items) if (identity.isScalar(key)) {
				if (seenKeys.includes(key.value)) onError(`Ordered maps must not include duplicate keys: ${key.value}`);
				else seenKeys.push(key.value);
			}
			return Object.assign(new YAMLOMap(), pairs$1);
		},
		createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
	};
	exports.YAMLOMap = YAMLOMap;
	exports.omap = omap;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	function boolStringify({ value, source }, ctx) {
		if (source && (value ? trueTag : falseTag).test.test(source)) return source;
		return value ? ctx.options.trueStr : ctx.options.falseStr;
	}
	const trueTag = {
		identify: (value) => value === true,
		default: true,
		tag: "tag:yaml.org,2002:bool",
		test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
		resolve: () => new Scalar.Scalar(true),
		stringify: boolStringify
	};
	const falseTag = {
		identify: (value) => value === false,
		default: true,
		tag: "tag:yaml.org,2002:bool",
		test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
		resolve: () => new Scalar.Scalar(false),
		stringify: boolStringify
	};
	exports.falseTag = falseTag;
	exports.trueTag = trueTag;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var stringifyNumber = require_stringifyNumber();
	const floatNaN = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
		resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
		stringify: stringifyNumber.stringifyNumber
	};
	const floatExp = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		format: "EXP",
		test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
		resolve: (str) => parseFloat(str.replace(/_/g, "")),
		stringify(node) {
			const num = Number(node.value);
			return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
		}
	};
	const float = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
		resolve(str) {
			const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
			const dot = str.indexOf(".");
			if (dot !== -1) {
				const f = str.substring(dot + 1).replace(/_/g, "");
				if (f[f.length - 1] === "0") node.minFractionDigits = f.length;
			}
			return node;
		},
		stringify: stringifyNumber.stringifyNumber
	};
	exports.float = float;
	exports.floatExp = floatExp;
	exports.floatNaN = floatNaN;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyNumber = require_stringifyNumber();
	const intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
	function intResolve(str, offset, radix, { intAsBigInt }) {
		const sign = str[0];
		if (sign === "-" || sign === "+") offset += 1;
		str = str.substring(offset).replace(/_/g, "");
		if (intAsBigInt) {
			switch (radix) {
				case 2:
					str = `0b${str}`;
					break;
				case 8:
					str = `0o${str}`;
					break;
				case 16: str = `0x${str}`;
			}
			const n = BigInt(str);
			return sign === "-" ? BigInt(-1) * n : n;
		}
		const n = parseInt(str, radix);
		return sign === "-" ? -1 * n : n;
	}
	function intStringify(node, radix, prefix) {
		const { value } = node;
		if (intIdentify(value)) {
			const str = value.toString(radix);
			return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
		}
		return stringifyNumber.stringifyNumber(node);
	}
	const intBin = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "BIN",
		test: /^[-+]?0b[0-1_]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
		stringify: (node) => intStringify(node, 2, "0b")
	};
	const intOct = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "OCT",
		test: /^[-+]?0[0-7_]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
		stringify: (node) => intStringify(node, 8, "0")
	};
	const int = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		test: /^[-+]?[0-9][0-9_]*$/,
		resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
		stringify: stringifyNumber.stringifyNumber
	};
	const intHex = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "HEX",
		test: /^[-+]?0x[0-9a-fA-F_]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
		stringify: (node) => intStringify(node, 16, "0x")
	};
	exports.int = int;
	exports.intBin = intBin;
	exports.intHex = intHex;
	exports.intOct = intOct;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Pair = require_Pair();
	var YAMLMap = require_YAMLMap();
	var YAMLSet = class YAMLSet extends YAMLMap.YAMLMap {
		constructor(schema) {
			super(schema);
			this.tag = YAMLSet.tag;
		}
		add(key) {
			let pair;
			if (identity.isPair(key)) pair = key;
			else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null) pair = new Pair.Pair(key.key, null);
			else pair = new Pair.Pair(key, null);
			if (!YAMLMap.findPair(this.items, pair.key)) this.items.push(pair);
		}
		/**
		* If `keepPair` is `true`, returns the Pair matching `key`.
		* Otherwise, returns the value of that Pair's key.
		*/
		get(key, keepPair) {
			const pair = YAMLMap.findPair(this.items, key);
			return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
		}
		set(key, value) {
			if (typeof value !== "boolean") throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
			const prev = YAMLMap.findPair(this.items, key);
			if (prev && !value) this.items.splice(this.items.indexOf(prev), 1);
			else if (!prev && value) this.items.push(new Pair.Pair(key));
		}
		toJSON(_, ctx) {
			return super.toJSON(_, ctx, Set);
		}
		toString(ctx, onComment, onChompKeep) {
			if (!ctx) return JSON.stringify(this);
			if (this.hasAllNullValues(true)) return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
			else throw new Error("Set items must all have null values");
		}
		static from(schema, iterable, ctx) {
			const { replacer } = ctx;
			const set = new this(schema);
			if (iterable && Symbol.iterator in Object(iterable)) for (let value of iterable) {
				if (typeof replacer === "function") value = replacer.call(iterable, value, value);
				set.items.push(Pair.createPair(value, null, ctx));
			}
			return set;
		}
	};
	YAMLSet.tag = "tag:yaml.org,2002:set";
	const set = {
		collection: "map",
		identify: (value) => value instanceof Set,
		nodeClass: YAMLSet,
		default: false,
		tag: "tag:yaml.org,2002:set",
		createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
		resolve(map, onError) {
			if (identity.isMap(map)) {
				if (map.hasAllNullValues(true)) return Object.assign(new YAMLSet(), map);
				else onError("Set items must all have null values");
			} else onError("Expected a mapping for this tag");
			return map;
		}
	};
	exports.YAMLSet = YAMLSet;
	exports.set = set;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyNumber = require_stringifyNumber();
	/** Internal types handle bigint as number, because TS can't figure it out. */
	function parseSexagesimal(str, asBigInt) {
		const sign = str[0];
		const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
		const num = (n) => asBigInt ? BigInt(n) : Number(n);
		const res = parts.replace(/_/g, "").split(":").reduce((res, p) => res * num(60) + num(p), num(0));
		return sign === "-" ? num(-1) * res : res;
	}
	/**
	* hhhh:mm:ss.sss
	*
	* Internal types handle bigint as number, because TS can't figure it out.
	*/
	function stringifySexagesimal(node) {
		let { value } = node;
		let num = (n) => n;
		if (typeof value === "bigint") num = (n) => BigInt(n);
		else if (isNaN(value) || !isFinite(value)) return stringifyNumber.stringifyNumber(node);
		let sign = "";
		if (value < 0) {
			sign = "-";
			value *= num(-1);
		}
		const _60 = num(60);
		const parts = [value % _60];
		if (value < 60) parts.unshift(0);
		else {
			value = (value - parts[0]) / _60;
			parts.unshift(value % _60);
			if (value >= 60) {
				value = (value - parts[0]) / _60;
				parts.unshift(value);
			}
		}
		return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
	}
	const intTime = {
		identify: (value) => typeof value === "bigint" || Number.isInteger(value),
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "TIME",
		test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
		resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
		stringify: stringifySexagesimal
	};
	const floatTime = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		format: "TIME",
		test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
		resolve: (str) => parseSexagesimal(str, false),
		stringify: stringifySexagesimal
	};
	const timestamp = {
		identify: (value) => value instanceof Date,
		default: true,
		tag: "tag:yaml.org,2002:timestamp",
		test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
		resolve(str) {
			const match = str.match(timestamp.test);
			if (!match) throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
			const [, year, month, day, hour, minute, second] = match.map(Number);
			const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
			let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
			const tz = match[8];
			if (tz && tz !== "Z") {
				let d = parseSexagesimal(tz, false);
				if (Math.abs(d) < 30) d *= 60;
				date -= 6e4 * d;
			}
			return new Date(date);
		},
		stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
	};
	exports.floatTime = floatTime;
	exports.intTime = intTime;
	exports.timestamp = timestamp;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema = /* @__PURE__ */ __commonJSMin(((exports) => {
	var map = require_map();
	var _null = require_null();
	var seq = require_seq();
	var string = require_string();
	var binary = require_binary();
	var bool = require_bool();
	var float = require_float();
	var int = require_int();
	var merge = require_merge();
	var omap = require_omap();
	var pairs = require_pairs();
	var set = require_set();
	var timestamp = require_timestamp();
	const schema = [
		map.map,
		seq.seq,
		string.string,
		_null.nullTag,
		bool.trueTag,
		bool.falseTag,
		int.intBin,
		int.intOct,
		int.int,
		int.intHex,
		float.floatNaN,
		float.floatExp,
		float.float,
		binary.binary,
		merge.merge,
		omap.omap,
		pairs.pairs,
		set.set,
		timestamp.intTime,
		timestamp.floatTime,
		timestamp.timestamp
	];
	exports.schema = schema;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/tags.js
var require_tags = /* @__PURE__ */ __commonJSMin(((exports) => {
	var map = require_map();
	var _null = require_null();
	var seq = require_seq();
	var string = require_string();
	var bool = require_bool$1();
	var float = require_float$1();
	var int = require_int$1();
	var schema = require_schema$2();
	var schema$1 = require_schema$1();
	var binary = require_binary();
	var merge = require_merge();
	var omap = require_omap();
	var pairs = require_pairs();
	var schema$2 = require_schema();
	var set = require_set();
	var timestamp = require_timestamp();
	const schemas = /* @__PURE__ */ new Map([
		["core", schema.schema],
		["failsafe", [
			map.map,
			seq.seq,
			string.string
		]],
		["json", schema$1.schema],
		["yaml11", schema$2.schema],
		["yaml-1.1", schema$2.schema]
	]);
	const tagsByName = {
		binary: binary.binary,
		bool: bool.boolTag,
		float: float.float,
		floatExp: float.floatExp,
		floatNaN: float.floatNaN,
		floatTime: timestamp.floatTime,
		int: int.int,
		intHex: int.intHex,
		intOct: int.intOct,
		intTime: timestamp.intTime,
		map: map.map,
		merge: merge.merge,
		null: _null.nullTag,
		omap: omap.omap,
		pairs: pairs.pairs,
		seq: seq.seq,
		set: set.set,
		timestamp: timestamp.timestamp
	};
	const coreKnownTags = {
		"tag:yaml.org,2002:binary": binary.binary,
		"tag:yaml.org,2002:merge": merge.merge,
		"tag:yaml.org,2002:omap": omap.omap,
		"tag:yaml.org,2002:pairs": pairs.pairs,
		"tag:yaml.org,2002:set": set.set,
		"tag:yaml.org,2002:timestamp": timestamp.timestamp
	};
	function getTags(customTags, schemaName, addMergeTag) {
		const schemaTags = schemas.get(schemaName);
		if (schemaTags && !customTags) return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
		let tags = schemaTags;
		if (!tags) {
			if (Array.isArray(customTags)) tags = [];
			else {
				const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
				throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
			}
		}
		if (Array.isArray(customTags)) for (const tag of customTags) tags = tags.concat(tag);
		else if (typeof customTags === "function") tags = customTags(tags.slice());
		if (addMergeTag) tags = tags.concat(merge.merge);
		return tags.reduce((tags, tag) => {
			const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
			if (!tagObj) {
				const tagName = JSON.stringify(tag);
				const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
				throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
			}
			if (!tags.includes(tagObj)) tags.push(tagObj);
			return tags;
		}, []);
	}
	exports.coreKnownTags = coreKnownTags;
	exports.getTags = getTags;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/Schema.js
var require_Schema = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var map = require_map();
	var seq = require_seq();
	var string = require_string();
	var tags = require_tags();
	const sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
	var Schema = class Schema {
		constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
			this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
			this.name = typeof schema === "string" && schema || "core";
			this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
			this.tags = tags.getTags(customTags, this.name, merge);
			this.toStringOptions = toStringDefaults ?? null;
			Object.defineProperty(this, identity.MAP, { value: map.map });
			Object.defineProperty(this, identity.SCALAR, { value: string.string });
			Object.defineProperty(this, identity.SEQ, { value: seq.seq });
			this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
		}
		clone() {
			const copy = Object.create(Schema.prototype, Object.getOwnPropertyDescriptors(this));
			copy.tags = this.tags.slice();
			return copy;
		}
	};
	exports.Schema = Schema;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var stringify = require_stringify();
	var stringifyComment = require_stringifyComment();
	function stringifyDocument(doc, options) {
		const lines = [];
		let hasDirectives = options.directives === true;
		if (options.directives !== false && doc.directives) {
			const dir = doc.directives.toString(doc);
			if (dir) {
				lines.push(dir);
				hasDirectives = true;
			} else if (doc.directives.docStart) hasDirectives = true;
		}
		if (hasDirectives) lines.push("---");
		const ctx = stringify.createStringifyContext(doc, options);
		const { commentString } = ctx.options;
		if (doc.commentBefore) {
			if (lines.length !== 1) lines.unshift("");
			const cs = commentString(doc.commentBefore);
			lines.unshift(stringifyComment.indentComment(cs, ""));
		}
		let chompKeep = false;
		let contentComment = null;
		if (doc.contents) {
			if (identity.isNode(doc.contents)) {
				if (doc.contents.spaceBefore && hasDirectives) lines.push("");
				if (doc.contents.commentBefore) {
					const cs = commentString(doc.contents.commentBefore);
					lines.push(stringifyComment.indentComment(cs, ""));
				}
				ctx.forceBlockIndent = !!doc.comment;
				contentComment = doc.contents.comment;
			}
			const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
			let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
			if (contentComment) body += stringifyComment.lineComment(body, "", commentString(contentComment));
			if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") lines[lines.length - 1] = `--- ${body}`;
			else lines.push(body);
		} else lines.push(stringify.stringify(doc.contents, ctx));
		if (doc.directives?.docEnd) {
			if (doc.comment) {
				const cs = commentString(doc.comment);
				if (cs.includes("\n")) {
					lines.push("...");
					lines.push(stringifyComment.indentComment(cs, ""));
				} else lines.push(`... ${cs}`);
			} else lines.push("...");
		} else {
			let dc = doc.comment;
			if (dc && chompKeep) dc = dc.replace(/^\n+/, "");
			if (dc) {
				if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "") lines.push("");
				lines.push(stringifyComment.indentComment(commentString(dc), ""));
			}
		}
		return lines.join("\n") + "\n";
	}
	exports.stringifyDocument = stringifyDocument;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/Document.js
var require_Document = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Alias = require_Alias();
	var Collection = require_Collection();
	var identity = require_identity();
	var Pair = require_Pair();
	var toJS = require_toJS();
	var Schema = require_Schema();
	var stringifyDocument = require_stringifyDocument();
	var anchors = require_anchors();
	var applyReviver = require_applyReviver();
	var createNode = require_createNode();
	var directives = require_directives();
	var Document = class Document {
		constructor(value, replacer, options) {
			/** A comment before this Document */
			this.commentBefore = null;
			/** A comment immediately after this Document */
			this.comment = null;
			/** Errors encountered during parsing. */
			this.errors = [];
			/** Warnings encountered during parsing. */
			this.warnings = [];
			Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
			let _replacer = null;
			if (typeof replacer === "function" || Array.isArray(replacer)) _replacer = replacer;
			else if (options === void 0 && replacer) {
				options = replacer;
				replacer = void 0;
			}
			const opt = Object.assign({
				intAsBigInt: false,
				keepSourceTokens: false,
				logLevel: "warn",
				prettyErrors: true,
				strict: true,
				stringKeys: false,
				uniqueKeys: true,
				version: "1.2"
			}, options);
			this.options = opt;
			let { version } = opt;
			if (options?._directives) {
				this.directives = options._directives.atDocument();
				if (this.directives.yaml.explicit) version = this.directives.yaml.version;
			} else this.directives = new directives.Directives({ version });
			this.setSchema(version, options);
			this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
		}
		/**
		* Create a deep copy of this Document and its contents.
		*
		* Custom Node values that inherit from `Object` still refer to their original instances.
		*/
		clone() {
			const copy = Object.create(Document.prototype, { [identity.NODE_TYPE]: { value: identity.DOC } });
			copy.commentBefore = this.commentBefore;
			copy.comment = this.comment;
			copy.errors = this.errors.slice();
			copy.warnings = this.warnings.slice();
			copy.options = Object.assign({}, this.options);
			if (this.directives) copy.directives = this.directives.clone();
			copy.schema = this.schema.clone();
			copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
			if (this.range) copy.range = this.range.slice();
			return copy;
		}
		/** Adds a value to the document. */
		add(value) {
			if (assertCollection(this.contents)) this.contents.add(value);
		}
		/** Adds a value to the document. */
		addIn(path, value) {
			if (assertCollection(this.contents)) this.contents.addIn(path, value);
		}
		/**
		* Create a new `Alias` node, ensuring that the target `node` has the required anchor.
		*
		* If `node` already has an anchor, `name` is ignored.
		* Otherwise, the `node.anchor` value will be set to `name`,
		* or if an anchor with that name is already present in the document,
		* `name` will be used as a prefix for a new unique anchor.
		* If `name` is undefined, the generated anchor will use 'a' as a prefix.
		*/
		createAlias(node, name) {
			if (!node.anchor) {
				const prev = anchors.anchorNames(this);
				node.anchor = !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
			}
			return new Alias.Alias(node.anchor);
		}
		createNode(value, replacer, options) {
			let _replacer = void 0;
			if (typeof replacer === "function") {
				value = replacer.call({ "": value }, "", value);
				_replacer = replacer;
			} else if (Array.isArray(replacer)) {
				const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
				const asStr = replacer.filter(keyToStr).map(String);
				if (asStr.length > 0) replacer = replacer.concat(asStr);
				_replacer = replacer;
			} else if (options === void 0 && replacer) {
				options = replacer;
				replacer = void 0;
			}
			const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
			const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(this, anchorPrefix || "a");
			const ctx = {
				aliasDuplicateObjects: aliasDuplicateObjects ?? true,
				keepUndefined: keepUndefined ?? false,
				onAnchor,
				onTagObj,
				replacer: _replacer,
				schema: this.schema,
				sourceObjects
			};
			const node = createNode.createNode(value, tag, ctx);
			if (flow && identity.isCollection(node)) node.flow = true;
			setAnchors();
			return node;
		}
		/**
		* Convert a key and a value into a `Pair` using the current schema,
		* recursively wrapping all values as `Scalar` or `Collection` nodes.
		*/
		createPair(key, value, options = {}) {
			const k = this.createNode(key, null, options);
			const v = this.createNode(value, null, options);
			return new Pair.Pair(k, v);
		}
		/**
		* Removes a value from the document.
		* @returns `true` if the item was found and removed.
		*/
		delete(key) {
			return assertCollection(this.contents) ? this.contents.delete(key) : false;
		}
		/**
		* Removes a value from the document.
		* @returns `true` if the item was found and removed.
		*/
		deleteIn(path) {
			if (Collection.isEmptyPath(path)) {
				if (this.contents == null) return false;
				this.contents = null;
				return true;
			}
			return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
		}
		/**
		* Returns item at `key`, or `undefined` if not found. By default unwraps
		* scalar values from their surrounding node; to disable set `keepScalar` to
		* `true` (collections are always returned intact).
		*/
		get(key, keepScalar) {
			return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
		}
		/**
		* Returns item at `path`, or `undefined` if not found. By default unwraps
		* scalar values from their surrounding node; to disable set `keepScalar` to
		* `true` (collections are always returned intact).
		*/
		getIn(path, keepScalar) {
			if (Collection.isEmptyPath(path)) return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
			return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
		}
		/**
		* Checks if the document includes a value with the key `key`.
		*/
		has(key) {
			return identity.isCollection(this.contents) ? this.contents.has(key) : false;
		}
		/**
		* Checks if the document includes a value at `path`.
		*/
		hasIn(path) {
			if (Collection.isEmptyPath(path)) return this.contents !== void 0;
			return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
		}
		/**
		* Sets a value in this document. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*/
		set(key, value) {
			if (this.contents == null) this.contents = Collection.collectionFromPath(this.schema, [key], value);
			else if (assertCollection(this.contents)) this.contents.set(key, value);
		}
		/**
		* Sets a value in this document. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*/
		setIn(path, value) {
			if (Collection.isEmptyPath(path)) this.contents = value;
			else if (this.contents == null) this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
			else if (assertCollection(this.contents)) this.contents.setIn(path, value);
		}
		/**
		* Change the YAML version and schema used by the document.
		* A `null` version disables support for directives, explicit tags, anchors, and aliases.
		* It also requires the `schema` option to be given as a `Schema` instance value.
		*
		* Overrides all previously set schema options.
		*/
		setSchema(version, options = {}) {
			if (typeof version === "number") version = String(version);
			let opt;
			switch (version) {
				case "1.1":
					if (this.directives) this.directives.yaml.version = "1.1";
					else this.directives = new directives.Directives({ version: "1.1" });
					opt = {
						resolveKnownTags: false,
						schema: "yaml-1.1"
					};
					break;
				case "1.2":
				case "next":
					if (this.directives) this.directives.yaml.version = version;
					else this.directives = new directives.Directives({ version });
					opt = {
						resolveKnownTags: true,
						schema: "core"
					};
					break;
				case null:
					if (this.directives) delete this.directives;
					opt = null;
					break;
				default: {
					const sv = JSON.stringify(version);
					throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
				}
			}
			if (options.schema instanceof Object) this.schema = options.schema;
			else if (opt) this.schema = new Schema.Schema(Object.assign(opt, options));
			else throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
		}
		toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
			const ctx = {
				anchors: /* @__PURE__ */ new Map(),
				doc: this,
				keep: !json,
				mapAsMap: mapAsMap === true,
				mapKeyWarned: false,
				maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
			};
			const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
			if (typeof onAnchor === "function") for (const { count, res } of ctx.anchors.values()) onAnchor(res, count);
			return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
		}
		/**
		* A JSON representation of the document `contents`.
		*
		* @param jsonArg Used by `JSON.stringify` to indicate the array index or
		*   property name.
		*/
		toJSON(jsonArg, onAnchor) {
			return this.toJS({
				json: true,
				jsonArg,
				mapAsMap: false,
				onAnchor
			});
		}
		/** A YAML representation of the document. */
		toString(options = {}) {
			if (this.errors.length > 0) throw new Error("Document with errors cannot be stringified");
			if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
				const s = JSON.stringify(options.indent);
				throw new Error(`"indent" option must be a positive integer, not ${s}`);
			}
			return stringifyDocument.stringifyDocument(this, options);
		}
	};
	function assertCollection(contents) {
		if (identity.isCollection(contents)) return true;
		throw new Error("Expected a YAML collection as document contents");
	}
	exports.Document = Document;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/errors.js
var require_errors = /* @__PURE__ */ __commonJSMin(((exports) => {
	var YAMLError = class extends Error {
		constructor(name, pos, code, message) {
			super();
			this.name = name;
			this.code = code;
			this.message = message;
			this.pos = pos;
		}
	};
	var YAMLParseError = class extends YAMLError {
		constructor(pos, code, message) {
			super("YAMLParseError", pos, code, message);
		}
	};
	var YAMLWarning = class extends YAMLError {
		constructor(pos, code, message) {
			super("YAMLWarning", pos, code, message);
		}
	};
	const prettifyError = (src, lc) => (error) => {
		if (error.pos[0] === -1) return;
		error.linePos = error.pos.map((pos) => lc.linePos(pos));
		const { line, col } = error.linePos[0];
		error.message += ` at line ${line}, column ${col}`;
		let ci = col - 1;
		let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
		if (ci >= 60 && lineStr.length > 80) {
			const trimStart = Math.min(ci - 39, lineStr.length - 79);
			lineStr = "…" + lineStr.substring(trimStart);
			ci -= trimStart - 1;
		}
		if (lineStr.length > 80) lineStr = lineStr.substring(0, 79) + "…";
		if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
			let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
			if (prev.length > 80) prev = prev.substring(0, 79) + "…\n";
			lineStr = prev + lineStr;
		}
		if (/[^ ]/.test(lineStr)) {
			let count = 1;
			const end = error.linePos[1];
			if (end?.line === line && end.col > col) count = Math.max(1, Math.min(end.col - col, 80 - ci));
			const pointer = " ".repeat(ci) + "^".repeat(count);
			error.message += `:\n\n${lineStr}\n${pointer}\n`;
		}
	};
	exports.YAMLError = YAMLError;
	exports.YAMLParseError = YAMLParseError;
	exports.YAMLWarning = YAMLWarning;
	exports.prettifyError = prettifyError;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = /* @__PURE__ */ __commonJSMin(((exports) => {
	function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
		let spaceBefore = false;
		let atNewline = startOnNewline;
		let hasSpace = startOnNewline;
		let comment = "";
		let commentSep = "";
		let hasNewline = false;
		let reqSpace = false;
		let tab = null;
		let anchor = null;
		let tag = null;
		let newlineAfterProp = null;
		let comma = null;
		let found = null;
		let start = null;
		for (const token of tokens) {
			if (reqSpace) {
				if (token.type !== "space" && token.type !== "newline" && token.type !== "comma") onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
				reqSpace = false;
			}
			if (tab) {
				if (atNewline && token.type !== "comment" && token.type !== "newline") onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
				tab = null;
			}
			switch (token.type) {
				case "space":
					if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) tab = token;
					hasSpace = true;
					break;
				case "comment": {
					if (!hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
					const cb = token.source.substring(1) || " ";
					if (!comment) comment = cb;
					else comment += commentSep + cb;
					commentSep = "";
					atNewline = false;
					break;
				}
				case "newline":
					if (atNewline) {
						if (comment) comment += token.source;
						else if (!found || indicator !== "seq-item-ind") spaceBefore = true;
					} else commentSep += token.source;
					atNewline = true;
					hasNewline = true;
					if (anchor || tag) newlineAfterProp = token;
					hasSpace = true;
					break;
				case "anchor":
					if (anchor) onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
					if (token.source.endsWith(":")) onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
					anchor = token;
					start ?? (start = token.offset);
					atNewline = false;
					hasSpace = false;
					reqSpace = true;
					break;
				case "tag":
					if (tag) onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
					tag = token;
					start ?? (start = token.offset);
					atNewline = false;
					hasSpace = false;
					reqSpace = true;
					break;
				case indicator:
					if (anchor || tag) onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
					if (found) onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
					found = token;
					atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
					hasSpace = false;
					break;
				case "comma": if (flow) {
					if (comma) onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
					comma = token;
					atNewline = false;
					hasSpace = false;
					break;
				}
				default:
					onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
					atNewline = false;
					hasSpace = false;
			}
		}
		const last = tokens[tokens.length - 1];
		const end = last ? last.offset + last.source.length : offset;
		if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
		if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq")) onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
		return {
			comma,
			found,
			spaceBefore,
			comment,
			hasNewline,
			anchor,
			tag,
			newlineAfterProp,
			end,
			start: start ?? end
		};
	}
	exports.resolveProps = resolveProps;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = /* @__PURE__ */ __commonJSMin(((exports) => {
	function containsNewline(key) {
		if (!key) return null;
		switch (key.type) {
			case "alias":
			case "scalar":
			case "double-quoted-scalar":
			case "single-quoted-scalar":
				if (key.source.includes("\n")) return true;
				if (key.end) {
					for (const st of key.end) if (st.type === "newline") return true;
				}
				return false;
			case "flow-collection":
				for (const it of key.items) {
					for (const st of it.start) if (st.type === "newline") return true;
					if (it.sep) {
						for (const st of it.sep) if (st.type === "newline") return true;
					}
					if (containsNewline(it.key) || containsNewline(it.value)) return true;
				}
				return false;
			default: return true;
		}
	}
	exports.containsNewline = containsNewline;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = /* @__PURE__ */ __commonJSMin(((exports) => {
	var utilContainsNewline = require_util_contains_newline();
	function flowIndentCheck(indent, fc, onError) {
		if (fc?.type === "flow-collection") {
			const end = fc.end[0];
			if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) onError(end, "BAD_INDENT", "Flow end indicator should be more indented than parent", true);
		}
	}
	exports.flowIndentCheck = flowIndentCheck;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	function mapIncludes(ctx, items, search) {
		const { uniqueKeys } = ctx.options;
		if (uniqueKeys === false) return false;
		const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
		return items.some((pair) => isEqual(pair.key, search));
	}
	exports.mapIncludes = mapIncludes;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Pair = require_Pair();
	var YAMLMap = require_YAMLMap();
	var resolveProps = require_resolve_props();
	var utilContainsNewline = require_util_contains_newline();
	var utilFlowIndentCheck = require_util_flow_indent_check();
	var utilMapIncludes = require_util_map_includes();
	const startColMsg = "All mapping items must start at the same column";
	function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
		const map = new ((tag?.nodeClass) ?? YAMLMap.YAMLMap)(ctx.schema);
		if (ctx.atRoot) ctx.atRoot = false;
		let offset = bm.offset;
		let commentEnd = null;
		for (const collItem of bm.items) {
			const { start, key, sep, value } = collItem;
			const keyProps = resolveProps.resolveProps(start, {
				indicator: "explicit-key-ind",
				next: key ?? sep?.[0],
				offset,
				onError,
				parentIndent: bm.indent,
				startOnNewline: true
			});
			const implicitKey = !keyProps.found;
			if (implicitKey) {
				if (key) {
					if (key.type === "block-seq") onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
					else if ("indent" in key && key.indent !== bm.indent) onError(offset, "BAD_INDENT", startColMsg);
				}
				if (!keyProps.anchor && !keyProps.tag && !sep) {
					commentEnd = keyProps.end;
					if (keyProps.comment) {
						if (map.comment) map.comment += "\n" + keyProps.comment;
						else map.comment = keyProps.comment;
					}
					continue;
				}
				if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
			} else if (keyProps.found?.indent !== bm.indent) onError(offset, "BAD_INDENT", startColMsg);
			ctx.atKey = true;
			const keyStart = keyProps.end;
			const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
			if (ctx.schema.compat) utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
			ctx.atKey = false;
			if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode)) onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
			const valueProps = resolveProps.resolveProps(sep ?? [], {
				indicator: "map-value-ind",
				next: value,
				offset: keyNode.range[2],
				onError,
				parentIndent: bm.indent,
				startOnNewline: !key || key.type === "block-scalar"
			});
			offset = valueProps.end;
			if (valueProps.found) {
				if (implicitKey) {
					if (value?.type === "block-map" && !valueProps.hasNewline) onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
					if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024) onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
				}
				const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
				if (ctx.schema.compat) utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
				offset = valueNode.range[2];
				const pair = new Pair.Pair(keyNode, valueNode);
				if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
				map.items.push(pair);
			} else {
				if (implicitKey) onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
				if (valueProps.comment) {
					if (keyNode.comment) keyNode.comment += "\n" + valueProps.comment;
					else keyNode.comment = valueProps.comment;
				}
				const pair = new Pair.Pair(keyNode);
				if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
				map.items.push(pair);
			}
		}
		if (commentEnd && commentEnd < offset) onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
		map.range = [
			bm.offset,
			offset,
			commentEnd ?? offset
		];
		return map;
	}
	exports.resolveBlockMap = resolveBlockMap;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = /* @__PURE__ */ __commonJSMin(((exports) => {
	var YAMLSeq = require_YAMLSeq();
	var resolveProps = require_resolve_props();
	var utilFlowIndentCheck = require_util_flow_indent_check();
	function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
		const seq = new ((tag?.nodeClass) ?? YAMLSeq.YAMLSeq)(ctx.schema);
		if (ctx.atRoot) ctx.atRoot = false;
		if (ctx.atKey) ctx.atKey = false;
		let offset = bs.offset;
		let commentEnd = null;
		for (const { start, value } of bs.items) {
			const props = resolveProps.resolveProps(start, {
				indicator: "seq-item-ind",
				next: value,
				offset,
				onError,
				parentIndent: bs.indent,
				startOnNewline: true
			});
			if (!props.found) {
				if (props.anchor || props.tag || value) {
					if (value?.type === "block-seq") onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
					else onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
				} else {
					commentEnd = props.end;
					if (props.comment) seq.comment = props.comment;
					continue;
				}
			}
			const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
			if (ctx.schema.compat) utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
			offset = node.range[2];
			seq.items.push(node);
		}
		seq.range = [
			bs.offset,
			offset,
			commentEnd ?? offset
		];
		return seq;
	}
	exports.resolveBlockSeq = resolveBlockSeq;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = /* @__PURE__ */ __commonJSMin(((exports) => {
	function resolveEnd(end, offset, reqSpace, onError) {
		let comment = "";
		if (end) {
			let hasSpace = false;
			let sep = "";
			for (const token of end) {
				const { source, type } = token;
				switch (type) {
					case "space":
						hasSpace = true;
						break;
					case "comment": {
						if (reqSpace && !hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
						const cb = source.substring(1) || " ";
						if (!comment) comment = cb;
						else comment += sep + cb;
						sep = "";
						break;
					}
					case "newline":
						if (comment) sep += source;
						hasSpace = true;
						break;
					default: onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
				}
				offset += source.length;
			}
		}
		return {
			comment,
			offset
		};
	}
	exports.resolveEnd = resolveEnd;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Pair = require_Pair();
	var YAMLMap = require_YAMLMap();
	var YAMLSeq = require_YAMLSeq();
	var resolveEnd = require_resolve_end();
	var resolveProps = require_resolve_props();
	var utilContainsNewline = require_util_contains_newline();
	var utilMapIncludes = require_util_map_includes();
	const blockMsg = "Block collections are not allowed within flow collections";
	const isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
	function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
		const isMap = fc.start.source === "{";
		const fcName = isMap ? "flow map" : "flow sequence";
		const coll = new ((tag?.nodeClass) ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq))(ctx.schema);
		coll.flow = true;
		const atRoot = ctx.atRoot;
		if (atRoot) ctx.atRoot = false;
		if (ctx.atKey) ctx.atKey = false;
		let offset = fc.offset + fc.start.source.length;
		for (let i = 0; i < fc.items.length; ++i) {
			const collItem = fc.items[i];
			const { start, key, sep, value } = collItem;
			const props = resolveProps.resolveProps(start, {
				flow: fcName,
				indicator: "explicit-key-ind",
				next: key ?? sep?.[0],
				offset,
				onError,
				parentIndent: fc.indent,
				startOnNewline: false
			});
			if (!props.found) {
				if (!props.anchor && !props.tag && !sep && !value) {
					if (i === 0 && props.comma) onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
					else if (i < fc.items.length - 1) onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
					if (props.comment) {
						if (coll.comment) coll.comment += "\n" + props.comment;
						else coll.comment = props.comment;
					}
					offset = props.end;
					continue;
				}
				if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key)) onError(key, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
			}
			if (i === 0) {
				if (props.comma) onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
			} else {
				if (!props.comma) onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
				if (props.comment) {
					let prevItemComment = "";
					loop: for (const st of start) switch (st.type) {
						case "comma":
						case "space": break;
						case "comment":
							prevItemComment = st.source.substring(1);
							break loop;
						default: break loop;
					}
					if (prevItemComment) {
						let prev = coll.items[coll.items.length - 1];
						if (identity.isPair(prev)) prev = prev.value ?? prev.key;
						if (prev.comment) prev.comment += "\n" + prevItemComment;
						else prev.comment = prevItemComment;
						props.comment = props.comment.substring(prevItemComment.length + 1);
					}
				}
			}
			if (!isMap && !sep && !props.found) {
				const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
				coll.items.push(valueNode);
				offset = valueNode.range[2];
				if (isBlock(value)) onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
			} else {
				ctx.atKey = true;
				const keyStart = props.end;
				const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
				if (isBlock(key)) onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
				ctx.atKey = false;
				const valueProps = resolveProps.resolveProps(sep ?? [], {
					flow: fcName,
					indicator: "map-value-ind",
					next: value,
					offset: keyNode.range[2],
					onError,
					parentIndent: fc.indent,
					startOnNewline: false
				});
				if (valueProps.found) {
					if (!isMap && !props.found && ctx.options.strict) {
						if (sep) for (const st of sep) {
							if (st === valueProps.found) break;
							if (st.type === "newline") {
								onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
								break;
							}
						}
						if (props.start < valueProps.found.offset - 1024) onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
					}
				} else if (value) {
					if ("source" in value && value.source?.[0] === ":") onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
					else onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
				}
				const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
				if (valueNode) {
					if (isBlock(value)) onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
				} else if (valueProps.comment) {
					if (keyNode.comment) keyNode.comment += "\n" + valueProps.comment;
					else keyNode.comment = valueProps.comment;
				}
				const pair = new Pair.Pair(keyNode, valueNode);
				if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
				if (isMap) {
					const map = coll;
					if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode)) onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
					map.items.push(pair);
				} else {
					const map = new YAMLMap.YAMLMap(ctx.schema);
					map.flow = true;
					map.items.push(pair);
					const endRange = (valueNode ?? keyNode).range;
					map.range = [
						keyNode.range[0],
						endRange[1],
						endRange[2]
					];
					coll.items.push(map);
				}
				offset = valueNode ? valueNode.range[2] : valueProps.end;
			}
		}
		const expectedEnd = isMap ? "}" : "]";
		const [ce, ...ee] = fc.end;
		let cePos = offset;
		if (ce?.source === expectedEnd) cePos = ce.offset + ce.source.length;
		else {
			const name = fcName[0].toUpperCase() + fcName.substring(1);
			const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
			onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
			if (ce && ce.source.length !== 1) ee.unshift(ce);
		}
		if (ee.length > 0) {
			const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
			if (end.comment) {
				if (coll.comment) coll.comment += "\n" + end.comment;
				else coll.comment = end.comment;
			}
			coll.range = [
				fc.offset,
				cePos,
				end.offset
			];
		} else coll.range = [
			fc.offset,
			cePos,
			cePos
		];
		return coll;
	}
	exports.resolveFlowCollection = resolveFlowCollection;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Scalar = require_Scalar();
	var YAMLMap = require_YAMLMap();
	var YAMLSeq = require_YAMLSeq();
	var resolveBlockMap = require_resolve_block_map();
	var resolveBlockSeq = require_resolve_block_seq();
	var resolveFlowCollection = require_resolve_flow_collection();
	function resolveCollection(CN, ctx, token, onError, tagName, tag) {
		const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
		const Coll = coll.constructor;
		if (tagName === "!" || tagName === Coll.tagName) {
			coll.tag = Coll.tagName;
			return coll;
		}
		if (tagName) coll.tag = tagName;
		return coll;
	}
	function composeCollection(CN, ctx, token, props, onError) {
		const tagToken = props.tag;
		const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
		if (token.type === "block-seq") {
			const { anchor, newlineAfterProp: nl } = props;
			const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
			if (lastProp && (!nl || nl.offset < lastProp.offset)) onError(lastProp, "MISSING_CHAR", "Missing newline after block sequence props");
		}
		const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
		if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") return resolveCollection(CN, ctx, token, onError, tagName);
		let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
		if (!tag) {
			const kt = ctx.schema.knownTags[tagName];
			if (kt?.collection === expType) {
				ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
				tag = kt;
			} else {
				if (kt) onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
				else onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
				return resolveCollection(CN, ctx, token, onError, tagName);
			}
		}
		const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
		const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
		const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
		node.range = coll.range;
		node.tag = tagName;
		if (tag?.format) node.format = tag.format;
		return node;
	}
	exports.composeCollection = composeCollection;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	function resolveBlockScalar(ctx, scalar, onError) {
		const start = scalar.offset;
		const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
		if (!header) return {
			value: "",
			type: null,
			comment: "",
			range: [
				start,
				start,
				start
			]
		};
		const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
		const lines = scalar.source ? splitLines(scalar.source) : [];
		let chompStart = lines.length;
		for (let i = lines.length - 1; i >= 0; --i) {
			const content = lines[i][1];
			if (content === "" || content === "\r") chompStart = i;
			else break;
		}
		if (chompStart === 0) {
			const value = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
			let end = start + header.length;
			if (scalar.source) end += scalar.source.length;
			return {
				value,
				type,
				comment: header.comment,
				range: [
					start,
					end,
					end
				]
			};
		}
		let trimIndent = scalar.indent + header.indent;
		let offset = scalar.offset + header.length;
		let contentStart = 0;
		for (let i = 0; i < chompStart; ++i) {
			const [indent, content] = lines[i];
			if (content === "" || content === "\r") {
				if (header.indent === 0 && indent.length > trimIndent) trimIndent = indent.length;
			} else {
				if (indent.length < trimIndent) onError(offset + indent.length, "MISSING_CHAR", "Block scalars with more-indented leading empty lines must use an explicit indentation indicator");
				if (header.indent === 0) trimIndent = indent.length;
				contentStart = i;
				if (trimIndent === 0 && !ctx.atRoot) onError(offset, "BAD_INDENT", "Block scalar values in collections must be indented");
				break;
			}
			offset += indent.length + content.length + 1;
		}
		for (let i = lines.length - 1; i >= chompStart; --i) if (lines[i][0].length > trimIndent) chompStart = i + 1;
		let value = "";
		let sep = "";
		let prevMoreIndented = false;
		for (let i = 0; i < contentStart; ++i) value += lines[i][0].slice(trimIndent) + "\n";
		for (let i = contentStart; i < chompStart; ++i) {
			let [indent, content] = lines[i];
			offset += indent.length + content.length + 1;
			const crlf = content[content.length - 1] === "\r";
			if (crlf) content = content.slice(0, -1);
			/* istanbul ignore if already caught in lexer */
			if (content && indent.length < trimIndent) {
				const message = `Block scalar lines must not be less indented than their ${header.indent ? "explicit indentation indicator" : "first line"}`;
				onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
				indent = "";
			}
			if (type === Scalar.Scalar.BLOCK_LITERAL) {
				value += sep + indent.slice(trimIndent) + content;
				sep = "\n";
			} else if (indent.length > trimIndent || content[0] === "	") {
				if (sep === " ") sep = "\n";
				else if (!prevMoreIndented && sep === "\n") sep = "\n\n";
				value += sep + indent.slice(trimIndent) + content;
				sep = "\n";
				prevMoreIndented = true;
			} else if (content === "") {
				if (sep === "\n") value += "\n";
				else sep = "\n";
			} else {
				value += sep + content;
				sep = " ";
				prevMoreIndented = false;
			}
		}
		switch (header.chomp) {
			case "-": break;
			case "+":
				for (let i = chompStart; i < lines.length; ++i) value += "\n" + lines[i][0].slice(trimIndent);
				if (value[value.length - 1] !== "\n") value += "\n";
				break;
			default: value += "\n";
		}
		const end = start + header.length + scalar.source.length;
		return {
			value,
			type,
			comment: header.comment,
			range: [
				start,
				end,
				end
			]
		};
	}
	function parseBlockScalarHeader({ offset, props }, strict, onError) {
		/* istanbul ignore if should not happen */
		if (props[0].type !== "block-scalar-header") {
			onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
			return null;
		}
		const { source } = props[0];
		const mode = source[0];
		let indent = 0;
		let chomp = "";
		let error = -1;
		for (let i = 1; i < source.length; ++i) {
			const ch = source[i];
			if (!chomp && (ch === "-" || ch === "+")) chomp = ch;
			else {
				const n = Number(ch);
				if (!indent && n) indent = n;
				else if (error === -1) error = offset + i;
			}
		}
		if (error !== -1) onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
		let hasSpace = false;
		let comment = "";
		let length = source.length;
		for (let i = 1; i < props.length; ++i) {
			const token = props[i];
			switch (token.type) {
				case "space": hasSpace = true;
				case "newline":
					length += token.source.length;
					break;
				case "comment":
					if (strict && !hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
					length += token.source.length;
					comment = token.source.substring(1);
					break;
				case "error":
					onError(token, "UNEXPECTED_TOKEN", token.message);
					length += token.source.length;
					break;
				/* istanbul ignore next should not happen */
				default: {
					onError(token, "UNEXPECTED_TOKEN", `Unexpected token in block scalar header: ${token.type}`);
					const ts = token.source;
					if (ts && typeof ts === "string") length += ts.length;
				}
			}
		}
		return {
			mode,
			indent,
			chomp,
			comment,
			length
		};
	}
	/** @returns Array of lines split up as `[indent, content]` */
	function splitLines(source) {
		const split = source.split(/\n( *)/);
		const first = split[0];
		const m = first.match(/^( *)/);
		const lines = [m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first]];
		for (let i = 1; i < split.length; i += 2) lines.push([split[i], split[i + 1]]);
		return lines;
	}
	exports.resolveBlockScalar = resolveBlockScalar;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var resolveEnd = require_resolve_end();
	function resolveFlowScalar(scalar, strict, onError) {
		const { offset, type, source, end } = scalar;
		let _type;
		let value;
		const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
		switch (type) {
			case "scalar":
				_type = Scalar.Scalar.PLAIN;
				value = plainValue(source, _onError);
				break;
			case "single-quoted-scalar":
				_type = Scalar.Scalar.QUOTE_SINGLE;
				value = singleQuotedValue(source, _onError);
				break;
			case "double-quoted-scalar":
				_type = Scalar.Scalar.QUOTE_DOUBLE;
				value = doubleQuotedValue(source, _onError);
				break;
			/* istanbul ignore next should not happen */
			default:
				onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
				return {
					value: "",
					type: null,
					comment: "",
					range: [
						offset,
						offset + source.length,
						offset + source.length
					]
				};
		}
		const valueEnd = offset + source.length;
		const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
		return {
			value,
			type: _type,
			comment: re.comment,
			range: [
				offset,
				valueEnd,
				re.offset
			]
		};
	}
	function plainValue(source, onError) {
		let badChar = "";
		switch (source[0]) {
			/* istanbul ignore next should not happen */
			case "	":
				badChar = "a tab character";
				break;
			case ",":
				badChar = "flow indicator character ,";
				break;
			case "%":
				badChar = "directive indicator character %";
				break;
			case "|":
			case ">":
				badChar = `block scalar indicator ${source[0]}`;
				break;
			case "@":
			case "`": badChar = `reserved character ${source[0]}`;
		}
		if (badChar) onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
		return unfoldLines(source);
	}
	function singleQuotedValue(source, onError) {
		if (source[source.length - 1] !== "'" || source.length === 1) onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
		return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
	}
	function unfoldLines(source) {
		const line = /(.*?)\r?\n/sy;
		let match = line.exec(source);
		if (!match) return source;
		/**
		* The negative lookbehinds in these RegExps are to
		* prevent causing a polynomial search time in certain cases.
		*
		* The try-catch is for Safari < 16.4 and other old browsers:
		* https://caniuse.com/js-regexp-lookbehind
		*/
		let trimEnd, trimBoth;
		try {
			trimEnd = /* @__PURE__ */ new RegExp("(?<![ 	])[ 	]+$");
			trimBoth = /* @__PURE__ */ new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
		} catch {
			trimEnd = /[ \t]+$/;
			trimBoth = /^[ \t]+|[ \t]+$/g;
		}
		let res = match[1].replace(trimEnd, "");
		let sep = " ";
		let pos = line.lastIndex;
		while (match = line.exec(source)) {
			const lm = match[1].replace(trimBoth, "");
			if (lm === "") {
				if (sep === "\n") res += sep;
				else sep = "\n";
			} else {
				res += sep + lm;
				sep = " ";
			}
			pos = line.lastIndex;
		}
		const last = /[ \t]*(.*)/sy;
		last.lastIndex = pos;
		match = last.exec(source);
		return res + sep + (match?.[1] ?? "");
	}
	function doubleQuotedValue(source, onError) {
		let res = "";
		for (let i = 1; i < source.length - 1; ++i) {
			const ch = source[i];
			if (ch === "\r" && source[i + 1] === "\n") continue;
			if (ch === "\n") {
				const { fold, offset } = foldNewline(source, i);
				res += fold;
				i = offset;
			} else if (ch === "\\") {
				let next = source[++i];
				const cc = escapeCodes[next];
				if (cc) res += cc;
				else if (next === "\n") {
					next = source[i + 1];
					while (next === " " || next === "	") next = source[++i + 1];
				} else if (next === "\r" && source[i + 1] === "\n") {
					next = source[++i + 1];
					while (next === " " || next === "	") next = source[++i + 1];
				} else if (next === "x" || next === "u" || next === "U") {
					const length = next === "x" ? 2 : next === "u" ? 4 : 8;
					res += parseCharCode(source, i + 1, length, onError);
					i += length;
				} else {
					const raw = source.substr(i - 1, 2);
					onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
					res += raw;
				}
			} else if (ch === " " || ch === "	") {
				const wsStart = i;
				let next = source[i + 1];
				while (next === " " || next === "	") next = source[++i + 1];
				if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n")) res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
			} else res += ch;
		}
		if (source[source.length - 1] !== "\"" || source.length === 1) onError(source.length, "MISSING_CHAR", "Missing closing \"quote");
		return res;
	}
	/**
	* Fold a single newline into a space, multiple newlines to N - 1 newlines.
	* Presumes `source[offset] === '\n'`
	*/
	function foldNewline(source, offset) {
		let fold = "";
		let ch = source[offset + 1];
		while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
			if (ch === "\r" && source[offset + 2] !== "\n") break;
			if (ch === "\n") fold += "\n";
			offset += 1;
			ch = source[offset + 1];
		}
		if (!fold) fold = " ";
		return {
			fold,
			offset
		};
	}
	const escapeCodes = {
		"0": "\0",
		a: "\x07",
		b: "\b",
		e: "\x1B",
		f: "\f",
		n: "\n",
		r: "\r",
		t: "	",
		v: "\v",
		N: "",
		_: "\xA0",
		L: "\u2028",
		P: "\u2029",
		" ": " ",
		"\"": "\"",
		"/": "/",
		"\\": "\\",
		"	": "	"
	};
	function parseCharCode(source, offset, length, onError) {
		const cc = source.substr(offset, length);
		const code = cc.length === length && /^[0-9a-fA-F]+$/.test(cc) ? parseInt(cc, 16) : NaN;
		try {
			return String.fromCodePoint(code);
		} catch {
			const raw = source.substr(offset - 2, length + 2);
			onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
			return raw;
		}
	}
	exports.resolveFlowScalar = resolveFlowScalar;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Scalar = require_Scalar();
	var resolveBlockScalar = require_resolve_block_scalar();
	var resolveFlowScalar = require_resolve_flow_scalar();
	function composeScalar(ctx, token, tagToken, onError) {
		const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
		const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
		let tag;
		if (ctx.options.stringKeys && ctx.atKey) tag = ctx.schema[identity.SCALAR];
		else if (tagName) tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
		else if (token.type === "scalar") tag = findScalarTagByTest(ctx, value, token, onError);
		else tag = ctx.schema[identity.SCALAR];
		let scalar;
		try {
			const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
			scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
			scalar = new Scalar.Scalar(value);
		}
		scalar.range = range;
		scalar.source = value;
		if (type) scalar.type = type;
		if (tagName) scalar.tag = tagName;
		if (tag.format) scalar.format = tag.format;
		if (comment) scalar.comment = comment;
		return scalar;
	}
	function findScalarTagByName(schema, value, tagName, tagToken, onError) {
		if (tagName === "!") return schema[identity.SCALAR];
		const matchWithTest = [];
		for (const tag of schema.tags) if (!tag.collection && tag.tag === tagName) {
			if (tag.default && tag.test) matchWithTest.push(tag);
			else return tag;
		}
		for (const tag of matchWithTest) if (tag.test?.test(value)) return tag;
		const kt = schema.knownTags[tagName];
		if (kt && !kt.collection) {
			schema.tags.push(Object.assign({}, kt, {
				default: false,
				test: void 0
			}));
			return kt;
		}
		onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
		return schema[identity.SCALAR];
	}
	function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
		const tag = schema.tags.find((tag) => (tag.default === true || atKey && tag.default === "key") && tag.test?.test(value)) || schema[identity.SCALAR];
		if (schema.compat) {
			const compat = schema.compat.find((tag) => tag.default && tag.test?.test(value)) ?? schema[identity.SCALAR];
			if (tag.tag !== compat.tag) onError(token, "TAG_RESOLVE_FAILED", `Value may be parsed as either ${directives.tagString(tag.tag)} or ${directives.tagString(compat.tag)}`, true);
		}
		return tag;
	}
	exports.composeScalar = composeScalar;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = /* @__PURE__ */ __commonJSMin(((exports) => {
	function emptyScalarPosition(offset, before, pos) {
		if (before) {
			pos ?? (pos = before.length);
			for (let i = pos - 1; i >= 0; --i) {
				let st = before[i];
				switch (st.type) {
					case "space":
					case "comment":
					case "newline":
						offset -= st.source.length;
						continue;
				}
				st = before[++i];
				while (st?.type === "space") {
					offset += st.source.length;
					st = before[++i];
				}
				break;
			}
		}
		return offset;
	}
	exports.emptyScalarPosition = emptyScalarPosition;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Alias = require_Alias();
	var identity = require_identity();
	var composeCollection = require_compose_collection();
	var composeScalar = require_compose_scalar();
	var resolveEnd = require_resolve_end();
	var utilEmptyScalarPosition = require_util_empty_scalar_position();
	const CN = {
		composeNode,
		composeEmptyNode
	};
	function composeNode(ctx, token, props, onError) {
		const atKey = ctx.atKey;
		const { spaceBefore, comment, anchor, tag } = props;
		let node;
		let isSrcToken = true;
		switch (token.type) {
			case "alias":
				node = composeAlias(ctx, token, onError);
				if (anchor || tag) onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
				break;
			case "scalar":
			case "single-quoted-scalar":
			case "double-quoted-scalar":
			case "block-scalar":
				node = composeScalar.composeScalar(ctx, token, tag, onError);
				if (anchor) node.anchor = anchor.source.substring(1);
				break;
			case "block-map":
			case "block-seq":
			case "flow-collection":
				try {
					node = composeCollection.composeCollection(CN, ctx, token, props, onError);
					if (anchor) node.anchor = anchor.source.substring(1);
				} catch (error) {
					onError(token, "RESOURCE_EXHAUSTION", error instanceof Error ? error.message : String(error));
				}
				break;
			default:
				onError(token, "UNEXPECTED_TOKEN", token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`);
				isSrcToken = false;
		}
		node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
		if (anchor && node.anchor === "") onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
		if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) onError(tag ?? token, "NON_STRING_KEY", "With stringKeys, all keys must be strings");
		if (spaceBefore) node.spaceBefore = true;
		if (comment) {
			if (token.type === "scalar" && token.source === "") node.comment = comment;
			else node.commentBefore = comment;
		}
		if (ctx.options.keepSourceTokens && isSrcToken) node.srcToken = token;
		return node;
	}
	function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
		const token = {
			type: "scalar",
			offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
			indent: -1,
			source: ""
		};
		const node = composeScalar.composeScalar(ctx, token, tag, onError);
		if (anchor) {
			node.anchor = anchor.source.substring(1);
			if (node.anchor === "") onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
		}
		if (spaceBefore) node.spaceBefore = true;
		if (comment) {
			node.comment = comment;
			node.range[2] = end;
		}
		return node;
	}
	function composeAlias({ options }, { offset, source, end }, onError) {
		const alias = new Alias.Alias(source.substring(1));
		if (alias.source === "") onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
		if (alias.source.endsWith(":")) onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
		const valueEnd = offset + source.length;
		const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
		alias.range = [
			offset,
			valueEnd,
			re.offset
		];
		if (re.comment) alias.comment = re.comment;
		return alias;
	}
	exports.composeEmptyNode = composeEmptyNode;
	exports.composeNode = composeNode;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Document = require_Document();
	var composeNode = require_compose_node();
	var resolveEnd = require_resolve_end();
	var resolveProps = require_resolve_props();
	function composeDoc(options, directives, { offset, start, value, end }, onError) {
		const opts = Object.assign({ _directives: directives }, options);
		const doc = new Document.Document(void 0, opts);
		const ctx = {
			atKey: false,
			atRoot: true,
			directives: doc.directives,
			options: doc.options,
			schema: doc.schema
		};
		const props = resolveProps.resolveProps(start, {
			indicator: "doc-start",
			next: value ?? end?.[0],
			offset,
			onError,
			parentIndent: 0,
			startOnNewline: true
		});
		if (props.found) {
			doc.directives.docStart = true;
			if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline) onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
		}
		doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
		const contentEnd = doc.contents.range[2];
		const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
		if (re.comment) doc.comment = re.comment;
		doc.range = [
			offset,
			contentEnd,
			re.offset
		];
		return doc;
	}
	exports.composeDoc = composeDoc;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/composer.js
var require_composer = /* @__PURE__ */ __commonJSMin(((exports) => {
	var node_process = __require("process");
	var directives = require_directives();
	var Document = require_Document();
	var errors = require_errors();
	var identity = require_identity();
	var composeDoc = require_compose_doc();
	var resolveEnd = require_resolve_end();
	function getErrorPos(src) {
		if (typeof src === "number") return [src, src + 1];
		if (Array.isArray(src)) return src.length === 2 ? src : [src[0], src[1]];
		const { offset, source } = src;
		return [offset, offset + (typeof source === "string" ? source.length : 1)];
	}
	function parsePrelude(prelude) {
		let comment = "";
		let atComment = false;
		let afterEmptyLine = false;
		for (let i = 0; i < prelude.length; ++i) {
			const source = prelude[i];
			switch (source[0]) {
				case "#":
					comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
					atComment = true;
					afterEmptyLine = false;
					break;
				case "%":
					if (prelude[i + 1]?.[0] !== "#") i += 1;
					atComment = false;
					break;
				default:
					if (!atComment) afterEmptyLine = true;
					atComment = false;
			}
		}
		return {
			comment,
			afterEmptyLine
		};
	}
	/**
	* Compose a stream of CST nodes into a stream of YAML Documents.
	*
	* ```ts
	* import { Composer, Parser } from 'yaml'
	*
	* const src: string = ...
	* const tokens = new Parser().parse(src)
	* const docs = new Composer().compose(tokens)
	* ```
	*/
	var Composer = class {
		constructor(options = {}) {
			this.doc = null;
			this.atDirectives = false;
			this.prelude = [];
			this.errors = [];
			this.warnings = [];
			this.onError = (source, code, message, warning) => {
				const pos = getErrorPos(source);
				if (warning) this.warnings.push(new errors.YAMLWarning(pos, code, message));
				else this.errors.push(new errors.YAMLParseError(pos, code, message));
			};
			this.directives = new directives.Directives({ version: options.version || "1.2" });
			this.options = options;
		}
		decorate(doc, afterDoc) {
			const { comment, afterEmptyLine } = parsePrelude(this.prelude);
			if (comment) {
				const dc = doc.contents;
				if (afterDoc) doc.comment = doc.comment ? `${doc.comment}\n${comment}` : comment;
				else if (afterEmptyLine || doc.directives.docStart || !dc) doc.commentBefore = comment;
				else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
					let it = dc.items[0];
					if (identity.isPair(it)) it = it.key;
					const cb = it.commentBefore;
					it.commentBefore = cb ? `${comment}\n${cb}` : comment;
				} else {
					const cb = dc.commentBefore;
					dc.commentBefore = cb ? `${comment}\n${cb}` : comment;
				}
			}
			if (afterDoc) {
				for (let i = 0; i < this.errors.length; ++i) doc.errors.push(this.errors[i]);
				for (let i = 0; i < this.warnings.length; ++i) doc.warnings.push(this.warnings[i]);
			} else {
				doc.errors = this.errors;
				doc.warnings = this.warnings;
			}
			this.prelude = [];
			this.errors = [];
			this.warnings = [];
		}
		/**
		* Current stream status information.
		*
		* Mostly useful at the end of input for an empty stream.
		*/
		streamInfo() {
			return {
				comment: parsePrelude(this.prelude).comment,
				directives: this.directives,
				errors: this.errors,
				warnings: this.warnings
			};
		}
		/**
		* Compose tokens into documents.
		*
		* @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
		* @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
		*/
		*compose(tokens, forceDoc = false, endOffset = -1) {
			for (const token of tokens) yield* this.next(token);
			yield* this.end(forceDoc, endOffset);
		}
		/** Advance the composer by one CST token. */
		*next(token) {
			if (node_process.env.LOG_STREAM) console.dir(token, { depth: null });
			switch (token.type) {
				case "directive":
					this.directives.add(token.source, (offset, message, warning) => {
						const pos = getErrorPos(token);
						pos[0] += offset;
						this.onError(pos, "BAD_DIRECTIVE", message, warning);
					});
					this.prelude.push(token.source);
					this.atDirectives = true;
					break;
				case "document": {
					const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
					if (this.atDirectives && !doc.directives.docStart) this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
					this.decorate(doc, false);
					if (this.doc) yield this.doc;
					this.doc = doc;
					this.atDirectives = false;
					break;
				}
				case "byte-order-mark":
				case "space": break;
				case "comment":
				case "newline":
					this.prelude.push(token.source);
					break;
				case "error": {
					const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
					const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
					if (this.atDirectives || !this.doc) this.errors.push(error);
					else this.doc.errors.push(error);
					break;
				}
				case "doc-end": {
					if (!this.doc) {
						this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", "Unexpected doc-end without preceding document"));
						break;
					}
					this.doc.directives.docEnd = true;
					const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
					this.decorate(this.doc, true);
					if (end.comment) {
						const dc = this.doc.comment;
						this.doc.comment = dc ? `${dc}\n${end.comment}` : end.comment;
					}
					this.doc.range[2] = end.offset;
					break;
				}
				default: this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
			}
		}
		/**
		* Call at end of input to yield any remaining document.
		*
		* @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
		* @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
		*/
		*end(forceDoc = false, endOffset = -1) {
			if (this.doc) {
				this.decorate(this.doc, true);
				yield this.doc;
				this.doc = null;
			} else if (forceDoc) {
				const opts = Object.assign({ _directives: this.directives }, this.options);
				const doc = new Document.Document(void 0, opts);
				if (this.atDirectives) this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
				doc.range = [
					0,
					endOffset,
					endOffset
				];
				this.decorate(doc, false);
				yield doc;
			}
		}
	};
	exports.Composer = Composer;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var resolveBlockScalar = require_resolve_block_scalar();
	var resolveFlowScalar = require_resolve_flow_scalar();
	var errors = require_errors();
	var stringifyString = require_stringifyString();
	function resolveAsScalar(token, strict = true, onError) {
		if (token) {
			const _onError = (pos, code, message) => {
				const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
				if (onError) onError(offset, code, message);
				else throw new errors.YAMLParseError([offset, offset + 1], code, message);
			};
			switch (token.type) {
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
				case "block-scalar": return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
			}
		}
		return null;
	}
	/**
	* Create a new scalar token with `value`
	*
	* Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
	* as this function does not support any schema operations and won't check for such conflicts.
	*
	* @param value The string representation of the value, which will have its content properly indented.
	* @param context.end Comments and whitespace after the end of the value, or after the block scalar header. If undefined, a newline will be added.
	* @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
	* @param context.indent The indent level of the token.
	* @param context.inFlow Is this scalar within a flow collection? This may affect the resolved type of the token's value.
	* @param context.offset The offset position of the token.
	* @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
	*/
	function createScalarToken(value, context) {
		const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
		const source = stringifyString.stringifyString({
			type,
			value
		}, {
			implicitKey,
			indent: indent > 0 ? " ".repeat(indent) : "",
			inFlow,
			options: {
				blockQuote: true,
				lineWidth: -1
			}
		});
		const end = context.end ?? [{
			type: "newline",
			offset: -1,
			indent,
			source: "\n"
		}];
		switch (source[0]) {
			case "|":
			case ">": {
				const he = source.indexOf("\n");
				const head = source.substring(0, he);
				const body = source.substring(he + 1) + "\n";
				const props = [{
					type: "block-scalar-header",
					offset,
					indent,
					source: head
				}];
				if (!addEndtoBlockProps(props, end)) props.push({
					type: "newline",
					offset: -1,
					indent,
					source: "\n"
				});
				return {
					type: "block-scalar",
					offset,
					indent,
					props,
					source: body
				};
			}
			case "\"": return {
				type: "double-quoted-scalar",
				offset,
				indent,
				source,
				end
			};
			case "'": return {
				type: "single-quoted-scalar",
				offset,
				indent,
				source,
				end
			};
			default: return {
				type: "scalar",
				offset,
				indent,
				source,
				end
			};
		}
	}
	/**
	* Set the value of `token` to the given string `value`, overwriting any previous contents and type that it may have.
	*
	* Best efforts are made to retain any comments previously associated with the `token`,
	* though all contents within a collection's `items` will be overwritten.
	*
	* Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
	* as this function does not support any schema operations and won't check for such conflicts.
	*
	* @param token Any token. If it does not include an `indent` value, the value will be stringified as if it were an implicit key.
	* @param value The string representation of the value, which will have its content properly indented.
	* @param context.afterKey In most cases, values after a key should have an additional level of indentation.
	* @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
	* @param context.inFlow Being within a flow collection may affect the resolved type of the token's value.
	* @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
	*/
	function setScalarValue(token, value, context = {}) {
		let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
		let indent = "indent" in token ? token.indent : null;
		if (afterKey && typeof indent === "number") indent += 2;
		if (!type) switch (token.type) {
			case "single-quoted-scalar":
				type = "QUOTE_SINGLE";
				break;
			case "double-quoted-scalar":
				type = "QUOTE_DOUBLE";
				break;
			case "block-scalar": {
				const header = token.props[0];
				if (header.type !== "block-scalar-header") throw new Error("Invalid block scalar header");
				type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
				break;
			}
			default: type = "PLAIN";
		}
		const source = stringifyString.stringifyString({
			type,
			value
		}, {
			implicitKey: implicitKey || indent === null,
			indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
			inFlow,
			options: {
				blockQuote: true,
				lineWidth: -1
			}
		});
		switch (source[0]) {
			case "|":
			case ">":
				setBlockScalarValue(token, source);
				break;
			case "\"":
				setFlowScalarValue(token, source, "double-quoted-scalar");
				break;
			case "'":
				setFlowScalarValue(token, source, "single-quoted-scalar");
				break;
			default: setFlowScalarValue(token, source, "scalar");
		}
	}
	function setBlockScalarValue(token, source) {
		const he = source.indexOf("\n");
		const head = source.substring(0, he);
		const body = source.substring(he + 1) + "\n";
		if (token.type === "block-scalar") {
			const header = token.props[0];
			if (header.type !== "block-scalar-header") throw new Error("Invalid block scalar header");
			header.source = head;
			token.source = body;
		} else {
			const { offset } = token;
			const indent = "indent" in token ? token.indent : -1;
			const props = [{
				type: "block-scalar-header",
				offset,
				indent,
				source: head
			}];
			if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0)) props.push({
				type: "newline",
				offset: -1,
				indent,
				source: "\n"
			});
			for (const key of Object.keys(token)) if (key !== "type" && key !== "offset") delete token[key];
			Object.assign(token, {
				type: "block-scalar",
				indent,
				props,
				source: body
			});
		}
	}
	/** @returns `true` if last token is a newline */
	function addEndtoBlockProps(props, end) {
		if (end) for (const st of end) switch (st.type) {
			case "space":
			case "comment":
				props.push(st);
				break;
			case "newline":
				props.push(st);
				return true;
		}
		return false;
	}
	function setFlowScalarValue(token, source, type) {
		switch (token.type) {
			case "scalar":
			case "double-quoted-scalar":
			case "single-quoted-scalar":
				token.type = type;
				token.source = source;
				break;
			case "block-scalar": {
				const end = token.props.slice(1);
				let oa = source.length;
				if (token.props[0].type === "block-scalar-header") oa -= token.props[0].source.length;
				for (const tok of end) tok.offset += oa;
				delete token.props;
				Object.assign(token, {
					type,
					source,
					end
				});
				break;
			}
			case "block-map":
			case "block-seq": {
				const nl = {
					type: "newline",
					offset: token.offset + source.length,
					indent: token.indent,
					source: "\n"
				};
				delete token.items;
				Object.assign(token, {
					type,
					source,
					end: [nl]
				});
				break;
			}
			default: {
				const indent = "indent" in token ? token.indent : -1;
				const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
				for (const key of Object.keys(token)) if (key !== "type" && key !== "offset") delete token[key];
				Object.assign(token, {
					type,
					indent,
					source,
					end
				});
			}
		}
	}
	exports.createScalarToken = createScalarToken;
	exports.resolveAsScalar = resolveAsScalar;
	exports.setScalarValue = setScalarValue;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Stringify a CST document, token, or collection item
	*
	* Fair warning: This applies no validation whatsoever, and
	* simply concatenates the sources in their logical order.
	*/
	const stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
	function stringifyToken(token) {
		switch (token.type) {
			case "block-scalar": {
				let res = "";
				for (const tok of token.props) res += stringifyToken(tok);
				return res + token.source;
			}
			case "block-map":
			case "block-seq": {
				let res = "";
				for (const item of token.items) res += stringifyItem(item);
				return res;
			}
			case "flow-collection": {
				let res = token.start.source;
				for (const item of token.items) res += stringifyItem(item);
				for (const st of token.end) res += st.source;
				return res;
			}
			case "document": {
				let res = stringifyItem(token);
				if (token.end) for (const st of token.end) res += st.source;
				return res;
			}
			default: {
				let res = token.source;
				if ("end" in token && token.end) for (const st of token.end) res += st.source;
				return res;
			}
		}
	}
	function stringifyItem({ start, key, sep, value }) {
		let res = "";
		for (const st of start) res += st.source;
		if (key) res += stringifyToken(key);
		if (sep) for (const st of sep) res += st.source;
		if (value) res += stringifyToken(value);
		return res;
	}
	exports.stringify = stringify;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = /* @__PURE__ */ __commonJSMin(((exports) => {
	const BREAK = Symbol("break visit");
	const SKIP = Symbol("skip children");
	const REMOVE = Symbol("remove item");
	/**
	* Apply a visitor to a CST document or item.
	*
	* Walks through the tree (depth-first) starting from the root, calling a
	* `visitor` function with two arguments when entering each item:
	*   - `item`: The current item, which included the following members:
	*     - `start: SourceToken[]` – Source tokens before the key or value,
	*       possibly including its anchor or tag.
	*     - `key?: Token | null` – Set for pair values. May then be `null`, if
	*       the key before the `:` separator is empty.
	*     - `sep?: SourceToken[]` – Source tokens between the key and the value,
	*       which should include the `:` map value indicator if `value` is set.
	*     - `value?: Token` – The value of a sequence item, or of a map pair.
	*   - `path`: The steps from the root to the current node, as an array of
	*     `['key' | 'value', number]` tuples.
	*
	* The return value of the visitor may be used to control the traversal:
	*   - `undefined` (default): Do nothing and continue
	*   - `visit.SKIP`: Do not visit the children of this token, continue with
	*      next sibling
	*   - `visit.BREAK`: Terminate traversal completely
	*   - `visit.REMOVE`: Remove the current item, then continue with the next one
	*   - `number`: Set the index of the next step. This is useful especially if
	*     the index of the current token has changed.
	*   - `function`: Define the next visitor for this item. After the original
	*     visitor is called on item entry, next visitors are called after handling
	*     a non-empty `key` and when exiting the item.
	*/
	function visit(cst, visitor) {
		if ("type" in cst && cst.type === "document") cst = {
			start: cst.start,
			value: cst.value
		};
		_visit(Object.freeze([]), cst, visitor);
	}
	/** Terminate visit traversal completely */
	visit.BREAK = BREAK;
	/** Do not visit the children of the current item */
	visit.SKIP = SKIP;
	/** Remove the current item */
	visit.REMOVE = REMOVE;
	/** Find the item at `path` from `cst` as the root */
	visit.itemAtPath = (cst, path) => {
		let item = cst;
		for (const [field, index] of path) {
			const tok = item?.[field];
			if (tok && "items" in tok) item = tok.items[index];
			else return void 0;
		}
		return item;
	};
	/**
	* Get the immediate parent collection of the item at `path` from `cst` as the root.
	*
	* Throws an error if the collection is not found, which should never happen if the item itself exists.
	*/
	visit.parentCollection = (cst, path) => {
		const parent = visit.itemAtPath(cst, path.slice(0, -1));
		const field = path[path.length - 1][0];
		const coll = parent?.[field];
		if (coll && "items" in coll) return coll;
		throw new Error("Parent collection not found");
	};
	function _visit(path, item, visitor) {
		let ctrl = visitor(item, path);
		if (typeof ctrl === "symbol") return ctrl;
		for (const field of ["key", "value"]) {
			const token = item[field];
			if (token && "items" in token) {
				for (let i = 0; i < token.items.length; ++i) {
					const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
					if (typeof ci === "number") i = ci - 1;
					else if (ci === BREAK) return BREAK;
					else if (ci === REMOVE) {
						token.items.splice(i, 1);
						i -= 1;
					}
				}
				if (typeof ctrl === "function" && field === "key") ctrl = ctrl(item, path);
			}
		}
		return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
	}
	exports.visit = visit;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst.js
var require_cst = /* @__PURE__ */ __commonJSMin(((exports) => {
	var cstScalar = require_cst_scalar();
	var cstStringify = require_cst_stringify();
	var cstVisit = require_cst_visit();
	/** The byte order mark */
	const BOM = "﻿";
	/** Start of doc-mode */
	const DOCUMENT = "";
	/** Unexpected end of flow-mode */
	const FLOW_END = "";
	/** Next token is a scalar value */
	const SCALAR = "";
	/** @returns `true` if `token` is a flow or block collection */
	const isCollection = (token) => !!token && "items" in token;
	/** @returns `true` if `token` is a flow or block scalar; not an alias */
	const isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
	/* istanbul ignore next */
	/** Get a printable representation of a lexer token */
	function prettyToken(token) {
		switch (token) {
			case BOM: return "<BOM>";
			case DOCUMENT: return "<DOC>";
			case FLOW_END: return "<FLOW_END>";
			case SCALAR: return "<SCALAR>";
			default: return JSON.stringify(token);
		}
	}
	/** Identify the type of a lexer token. May return `null` for unknown tokens. */
	function tokenType(source) {
		switch (source) {
			case BOM: return "byte-order-mark";
			case DOCUMENT: return "doc-mode";
			case FLOW_END: return "flow-error-end";
			case SCALAR: return "scalar";
			case "---": return "doc-start";
			case "...": return "doc-end";
			case "":
			case "\n":
			case "\r\n": return "newline";
			case "-": return "seq-item-ind";
			case "?": return "explicit-key-ind";
			case ":": return "map-value-ind";
			case "{": return "flow-map-start";
			case "}": return "flow-map-end";
			case "[": return "flow-seq-start";
			case "]": return "flow-seq-end";
			case ",": return "comma";
		}
		switch (source[0]) {
			case " ":
			case "	": return "space";
			case "#": return "comment";
			case "%": return "directive-line";
			case "*": return "alias";
			case "&": return "anchor";
			case "!": return "tag";
			case "'": return "single-quoted-scalar";
			case "\"": return "double-quoted-scalar";
			case "|":
			case ">": return "block-scalar-header";
		}
		return null;
	}
	exports.createScalarToken = cstScalar.createScalarToken;
	exports.resolveAsScalar = cstScalar.resolveAsScalar;
	exports.setScalarValue = cstScalar.setScalarValue;
	exports.stringify = cstStringify.stringify;
	exports.visit = cstVisit.visit;
	exports.BOM = BOM;
	exports.DOCUMENT = DOCUMENT;
	exports.FLOW_END = FLOW_END;
	exports.SCALAR = SCALAR;
	exports.isCollection = isCollection;
	exports.isScalar = isScalar;
	exports.prettyToken = prettyToken;
	exports.tokenType = tokenType;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/lexer.js
var require_lexer = /* @__PURE__ */ __commonJSMin(((exports) => {
	var cst = require_cst();
	function isEmpty(ch) {
		switch (ch) {
			case void 0:
			case " ":
			case "\n":
			case "\r":
			case "	": return true;
			default: return false;
		}
	}
	const hexDigits = /* @__PURE__ */ new Set("0123456789ABCDEFabcdef");
	const tagChars = /* @__PURE__ */ new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
	const flowIndicatorChars = /* @__PURE__ */ new Set(",[]{}");
	const invalidAnchorChars = /* @__PURE__ */ new Set(" ,[]{}\n\r	");
	const isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
	/**
	* Splits an input string into lexical tokens, i.e. smaller strings that are
	* easily identifiable by `tokens.tokenType()`.
	*
	* Lexing starts always in a "stream" context. Incomplete input may be buffered
	* until a complete token can be emitted.
	*
	* In addition to slices of the original input, the following control characters
	* may also be emitted:
	*
	* - `\x02` (Start of Text): A document starts with the next token
	* - `\x18` (Cancel): Unexpected end of flow-mode (indicates an error)
	* - `\x1f` (Unit Separator): Next token is a scalar value
	* - `\u{FEFF}` (Byte order mark): Emitted separately outside documents
	*/
	var Lexer = class {
		constructor() {
			/**
			* Flag indicating whether the end of the current buffer marks the end of
			* all input
			*/
			this.atEnd = false;
			/**
			* Explicit indent set in block scalar header, as an offset from the current
			* minimum indent, so e.g. set to 1 from a header `|2+`. Set to -1 if not
			* explicitly set.
			*/
			this.blockScalarIndent = -1;
			/**
			* Block scalars that include a + (keep) chomping indicator in their header
			* include trailing empty lines, which are otherwise excluded from the
			* scalar's contents.
			*/
			this.blockScalarKeep = false;
			/** Current input */
			this.buffer = "";
			/**
			* Flag noting whether the map value indicator : can immediately follow this
			* node within a flow context.
			*/
			this.flowKey = false;
			/** Count of surrounding flow collection levels. */
			this.flowLevel = 0;
			/**
			* Minimum level of indentation required for next lines to be parsed as a
			* part of the current scalar value.
			*/
			this.indentNext = 0;
			/** Indentation level of the current line. */
			this.indentValue = 0;
			/** Position of the next \n character. */
			this.lineEndPos = null;
			/** Stores the state of the lexer if reaching the end of incpomplete input */
			this.next = null;
			/** A pointer to `buffer`; the current position of the lexer. */
			this.pos = 0;
		}
		/**
		* Generate YAML tokens from the `source` string. If `incomplete`,
		* a part of the last line may be left as a buffer for the next call.
		*
		* @returns A generator of lexical tokens
		*/
		*lex(source, incomplete = false) {
			if (source) {
				if (typeof source !== "string") throw TypeError("source is not a string");
				this.buffer = this.buffer ? this.buffer + source : source;
				this.lineEndPos = null;
			}
			this.atEnd = !incomplete;
			let next = this.next ?? "stream";
			while (next && (incomplete || this.hasChars(1))) next = yield* this.parseNext(next);
		}
		atLineEnd() {
			let i = this.pos;
			let ch = this.buffer[i];
			while (ch === " " || ch === "	") ch = this.buffer[++i];
			if (!ch || ch === "#" || ch === "\n") return true;
			if (ch === "\r") return this.buffer[i + 1] === "\n";
			return false;
		}
		charAt(n) {
			return this.buffer[this.pos + n];
		}
		continueScalar(offset) {
			let ch = this.buffer[offset];
			if (this.indentNext > 0) {
				let indent = 0;
				while (ch === " ") ch = this.buffer[++indent + offset];
				if (ch === "\r") {
					const next = this.buffer[indent + offset + 1];
					if (next === "\n" || !next && !this.atEnd) return offset + indent + 1;
				}
				return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
			}
			if (ch === "-" || ch === ".") {
				const dt = this.buffer.substr(offset, 3);
				if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3])) return -1;
			}
			return offset;
		}
		getLine() {
			let end = this.lineEndPos;
			if (typeof end !== "number" || end !== -1 && end < this.pos) {
				end = this.buffer.indexOf("\n", this.pos);
				this.lineEndPos = end;
			}
			if (end === -1) return this.atEnd ? this.buffer.substring(this.pos) : null;
			if (this.buffer[end - 1] === "\r") end -= 1;
			return this.buffer.substring(this.pos, end);
		}
		hasChars(n) {
			return this.pos + n <= this.buffer.length;
		}
		setNext(state) {
			this.buffer = this.buffer.substring(this.pos);
			this.pos = 0;
			this.lineEndPos = null;
			this.next = state;
			return null;
		}
		peek(n) {
			return this.buffer.substr(this.pos, n);
		}
		*parseNext(next) {
			switch (next) {
				case "stream": return yield* this.parseStream();
				case "line-start": return yield* this.parseLineStart();
				case "block-start": return yield* this.parseBlockStart();
				case "doc": return yield* this.parseDocument();
				case "flow": return yield* this.parseFlowCollection();
				case "quoted-scalar": return yield* this.parseQuotedScalar();
				case "block-scalar": return yield* this.parseBlockScalar();
				case "plain-scalar": return yield* this.parsePlainScalar();
			}
		}
		*parseStream() {
			let line = this.getLine();
			if (line === null) return this.setNext("stream");
			if (line[0] === cst.BOM) {
				yield* this.pushCount(1);
				line = line.substring(1);
			}
			if (line[0] === "%") {
				let dirEnd = line.length;
				let cs = line.indexOf("#");
				while (cs !== -1) {
					const ch = line[cs - 1];
					if (ch === " " || ch === "	") {
						dirEnd = cs - 1;
						break;
					} else cs = line.indexOf("#", cs + 1);
				}
				while (true) {
					const ch = line[dirEnd - 1];
					if (ch === " " || ch === "	") dirEnd -= 1;
					else break;
				}
				const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
				yield* this.pushCount(line.length - n);
				this.pushNewline();
				return "stream";
			}
			if (this.atLineEnd()) {
				const sp = yield* this.pushSpaces(true);
				yield* this.pushCount(line.length - sp);
				yield* this.pushNewline();
				return "stream";
			}
			yield cst.DOCUMENT;
			return yield* this.parseLineStart();
		}
		*parseLineStart() {
			const ch = this.charAt(0);
			if (!ch && !this.atEnd) return this.setNext("line-start");
			if (ch === "-" || ch === ".") {
				if (!this.atEnd && !this.hasChars(4)) return this.setNext("line-start");
				const s = this.peek(3);
				if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
					yield* this.pushCount(3);
					this.indentValue = 0;
					this.indentNext = 0;
					return s === "---" ? "doc" : "stream";
				}
			}
			this.indentValue = yield* this.pushSpaces(false);
			if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1))) this.indentNext = this.indentValue;
			return yield* this.parseBlockStart();
		}
		*parseBlockStart() {
			const [ch0, ch1] = this.peek(2);
			if (!ch1 && !this.atEnd) return this.setNext("block-start");
			if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
				const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
				this.indentNext = this.indentValue + 1;
				this.indentValue += n;
				return "block-start";
			}
			return "doc";
		}
		*parseDocument() {
			yield* this.pushSpaces(true);
			const line = this.getLine();
			if (line === null) return this.setNext("doc");
			let n = yield* this.pushIndicators();
			switch (line[n]) {
				case "#": yield* this.pushCount(line.length - n);
				case void 0:
					yield* this.pushNewline();
					return yield* this.parseLineStart();
				case "{":
				case "[":
					yield* this.pushCount(1);
					this.flowKey = false;
					this.flowLevel = 1;
					return "flow";
				case "}":
				case "]":
					yield* this.pushCount(1);
					return "doc";
				case "*":
					yield* this.pushUntil(isNotAnchorChar);
					return "doc";
				case "\"":
				case "'": return yield* this.parseQuotedScalar();
				case "|":
				case ">":
					n += yield* this.parseBlockScalarHeader();
					n += yield* this.pushSpaces(true);
					yield* this.pushCount(line.length - n);
					yield* this.pushNewline();
					return yield* this.parseBlockScalar();
				default: return yield* this.parsePlainScalar();
			}
		}
		*parseFlowCollection() {
			let nl, sp;
			let indent = -1;
			do {
				nl = yield* this.pushNewline();
				if (nl > 0) {
					sp = yield* this.pushSpaces(false);
					this.indentValue = indent = sp;
				} else sp = 0;
				sp += yield* this.pushSpaces(true);
			} while (nl + sp > 0);
			const line = this.getLine();
			if (line === null) return this.setNext("flow");
			if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
				if (!(indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}"))) {
					this.flowLevel = 0;
					yield cst.FLOW_END;
					return yield* this.parseLineStart();
				}
			}
			let n = 0;
			while (line[n] === ",") {
				n += yield* this.pushCount(1);
				n += yield* this.pushSpaces(true);
				this.flowKey = false;
			}
			n += yield* this.pushIndicators();
			switch (line[n]) {
				case void 0: return "flow";
				case "#":
					yield* this.pushCount(line.length - n);
					return "flow";
				case "{":
				case "[":
					yield* this.pushCount(1);
					this.flowKey = false;
					this.flowLevel += 1;
					return "flow";
				case "}":
				case "]":
					yield* this.pushCount(1);
					this.flowKey = true;
					this.flowLevel -= 1;
					return this.flowLevel ? "flow" : "doc";
				case "*":
					yield* this.pushUntil(isNotAnchorChar);
					return "flow";
				case "\"":
				case "'":
					this.flowKey = true;
					return yield* this.parseQuotedScalar();
				case ":": {
					const next = this.charAt(1);
					if (this.flowKey || isEmpty(next) || next === ",") {
						this.flowKey = false;
						yield* this.pushCount(1);
						yield* this.pushSpaces(true);
						return "flow";
					}
				}
				default:
					this.flowKey = false;
					return yield* this.parsePlainScalar();
			}
		}
		*parseQuotedScalar() {
			const quote = this.charAt(0);
			let end = this.buffer.indexOf(quote, this.pos + 1);
			if (quote === "'") while (end !== -1 && this.buffer[end + 1] === "'") end = this.buffer.indexOf("'", end + 2);
			else while (end !== -1) {
				let n = 0;
				while (this.buffer[end - 1 - n] === "\\") n += 1;
				if (n % 2 === 0) break;
				end = this.buffer.indexOf("\"", end + 1);
			}
			const qb = this.buffer.substring(0, end);
			let nl = qb.indexOf("\n", this.pos);
			if (nl !== -1) {
				while (nl !== -1) {
					const cs = this.continueScalar(nl + 1);
					if (cs === -1) break;
					nl = qb.indexOf("\n", cs);
				}
				if (nl !== -1) end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
			}
			if (end === -1) {
				if (!this.atEnd) return this.setNext("quoted-scalar");
				end = this.buffer.length;
			}
			yield* this.pushToIndex(end + 1, false);
			return this.flowLevel ? "flow" : "doc";
		}
		*parseBlockScalarHeader() {
			this.blockScalarIndent = -1;
			this.blockScalarKeep = false;
			let i = this.pos;
			while (true) {
				const ch = this.buffer[++i];
				if (ch === "+") this.blockScalarKeep = true;
				else if (ch > "0" && ch <= "9") this.blockScalarIndent = Number(ch) - 1;
				else if (ch !== "-") break;
			}
			return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
		}
		*parseBlockScalar() {
			let nl = this.pos - 1;
			let indent = 0;
			let ch;
			loop: for (let i = this.pos; ch = this.buffer[i]; ++i) switch (ch) {
				case " ":
					indent += 1;
					break;
				case "\n":
					nl = i;
					indent = 0;
					break;
				case "\r": {
					const next = this.buffer[i + 1];
					if (!next && !this.atEnd) return this.setNext("block-scalar");
					if (next === "\n") break;
				}
				default: break loop;
			}
			if (!ch && !this.atEnd) return this.setNext("block-scalar");
			if (indent >= this.indentNext) {
				if (this.blockScalarIndent === -1) this.indentNext = indent;
				else this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
				do {
					const cs = this.continueScalar(nl + 1);
					if (cs === -1) break;
					nl = this.buffer.indexOf("\n", cs);
				} while (nl !== -1);
				if (nl === -1) {
					if (!this.atEnd) return this.setNext("block-scalar");
					nl = this.buffer.length;
				}
			}
			let i = nl + 1;
			ch = this.buffer[i];
			while (ch === " ") ch = this.buffer[++i];
			if (ch === "	") {
				while (ch === "	" || ch === " " || ch === "\r" || ch === "\n") ch = this.buffer[++i];
				nl = i - 1;
			} else if (!this.blockScalarKeep) do {
				let i = nl - 1;
				let ch = this.buffer[i];
				if (ch === "\r") ch = this.buffer[--i];
				const lastChar = i;
				while (ch === " ") ch = this.buffer[--i];
				if (ch === "\n" && i >= this.pos && i + 1 + indent > lastChar) nl = i;
				else break;
			} while (true);
			yield cst.SCALAR;
			yield* this.pushToIndex(nl + 1, true);
			return yield* this.parseLineStart();
		}
		*parsePlainScalar() {
			const inFlow = this.flowLevel > 0;
			let end = this.pos - 1;
			let i = this.pos - 1;
			let ch;
			while (ch = this.buffer[++i]) if (ch === ":") {
				const next = this.buffer[i + 1];
				if (isEmpty(next) || inFlow && flowIndicatorChars.has(next)) break;
				end = i;
			} else if (isEmpty(ch)) {
				let next = this.buffer[i + 1];
				if (ch === "\r") {
					if (next === "\n") {
						i += 1;
						ch = "\n";
						next = this.buffer[i + 1];
					} else end = i;
				}
				if (next === "#" || inFlow && flowIndicatorChars.has(next)) break;
				if (ch === "\n") {
					const cs = this.continueScalar(i + 1);
					if (cs === -1) break;
					i = Math.max(i, cs - 2);
				}
			} else {
				if (inFlow && flowIndicatorChars.has(ch)) break;
				end = i;
			}
			if (!ch && !this.atEnd) return this.setNext("plain-scalar");
			yield cst.SCALAR;
			yield* this.pushToIndex(end + 1, true);
			return inFlow ? "flow" : "doc";
		}
		*pushCount(n) {
			if (n > 0) {
				yield this.buffer.substr(this.pos, n);
				this.pos += n;
				return n;
			}
			return 0;
		}
		*pushToIndex(i, allowEmpty) {
			const s = this.buffer.slice(this.pos, i);
			if (s) {
				yield s;
				this.pos += s.length;
				return s.length;
			} else if (allowEmpty) yield "";
			return 0;
		}
		*pushIndicators() {
			let n = 0;
			loop: while (true) {
				switch (this.charAt(0)) {
					case "!":
						n += yield* this.pushTag();
						n += yield* this.pushSpaces(true);
						continue loop;
					case "&":
						n += yield* this.pushUntil(isNotAnchorChar);
						n += yield* this.pushSpaces(true);
						continue loop;
					case "-":
					case "?":
					case ":": {
						const inFlow = this.flowLevel > 0;
						const ch1 = this.charAt(1);
						if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
							if (!inFlow) this.indentNext = this.indentValue + 1;
							else if (this.flowKey) this.flowKey = false;
							n += yield* this.pushCount(1);
							n += yield* this.pushSpaces(true);
							continue loop;
						}
					}
				}
				break loop;
			}
			return n;
		}
		*pushTag() {
			if (this.charAt(1) === "<") {
				let i = this.pos + 2;
				let ch = this.buffer[i];
				while (!isEmpty(ch) && ch !== ">") ch = this.buffer[++i];
				return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
			} else {
				let i = this.pos + 1;
				let ch = this.buffer[i];
				while (ch) if (tagChars.has(ch)) ch = this.buffer[++i];
				else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) ch = this.buffer[i += 3];
				else break;
				return yield* this.pushToIndex(i, false);
			}
		}
		*pushNewline() {
			const ch = this.buffer[this.pos];
			if (ch === "\n") return yield* this.pushCount(1);
			else if (ch === "\r" && this.charAt(1) === "\n") return yield* this.pushCount(2);
			else return 0;
		}
		*pushSpaces(allowTabs) {
			let i = this.pos - 1;
			let ch;
			do
				ch = this.buffer[++i];
			while (ch === " " || allowTabs && ch === "	");
			const n = i - this.pos;
			if (n > 0) {
				yield this.buffer.substr(this.pos, n);
				this.pos = i;
			}
			return n;
		}
		*pushUntil(test) {
			let i = this.pos;
			let ch = this.buffer[i];
			while (!test(ch)) ch = this.buffer[++i];
			return yield* this.pushToIndex(i, false);
		}
	};
	exports.Lexer = Lexer;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Tracks newlines during parsing in order to provide an efficient API for
	* determining the one-indexed `{ line, col }` position for any offset
	* within the input.
	*/
	var LineCounter = class {
		constructor() {
			this.lineStarts = [];
			/**
			* Should be called in ascending order. Otherwise, call
			* `lineCounter.lineStarts.sort()` before calling `linePos()`.
			*/
			this.addNewLine = (offset) => this.lineStarts.push(offset);
			/**
			* Performs a binary search and returns the 1-indexed { line, col }
			* position of `offset`. If `line === 0`, `addNewLine` has never been
			* called or `offset` is before the first known newline.
			*/
			this.linePos = (offset) => {
				let low = 0;
				let high = this.lineStarts.length;
				while (low < high) {
					const mid = low + high >> 1;
					if (this.lineStarts[mid] < offset) low = mid + 1;
					else high = mid;
				}
				if (this.lineStarts[low] === offset) return {
					line: low + 1,
					col: 1
				};
				if (low === 0) return {
					line: 0,
					col: offset
				};
				const start = this.lineStarts[low - 1];
				return {
					line: low,
					col: offset - start + 1
				};
			};
		}
	};
	exports.LineCounter = LineCounter;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/parser.js
var require_parser = /* @__PURE__ */ __commonJSMin(((exports) => {
	var node_process = __require("process");
	var cst = require_cst();
	var lexer = require_lexer();
	function includesToken(list, type) {
		for (let i = 0; i < list.length; ++i) if (list[i].type === type) return true;
		return false;
	}
	function findNonEmptyIndex(list) {
		for (let i = 0; i < list.length; ++i) switch (list[i].type) {
			case "space":
			case "comment":
			case "newline": break;
			default: return i;
		}
		return -1;
	}
	function isFlowToken(token) {
		switch (token?.type) {
			case "alias":
			case "scalar":
			case "single-quoted-scalar":
			case "double-quoted-scalar":
			case "flow-collection": return true;
			default: return false;
		}
	}
	function getPrevProps(parent) {
		switch (parent.type) {
			case "document": return parent.start;
			case "block-map": {
				const it = parent.items[parent.items.length - 1];
				return it.sep ?? it.start;
			}
			case "block-seq": return parent.items[parent.items.length - 1].start;
			/* istanbul ignore next should not happen */
			default: return [];
		}
	}
	/** Note: May modify input array */
	function getFirstKeyStartProps(prev) {
		if (prev.length === 0) return [];
		let i = prev.length;
		loop: while (--i >= 0) switch (prev[i].type) {
			case "doc-start":
			case "explicit-key-ind":
			case "map-value-ind":
			case "seq-item-ind":
			case "newline": break loop;
		}
		while (prev[++i]?.type === "space");
		return prev.splice(i, prev.length);
	}
	function arrayPushArray(target, source) {
		if (source.length < 1e5) Array.prototype.push.apply(target, source);
		else for (let i = 0; i < source.length; ++i) target.push(source[i]);
	}
	function fixFlowSeqItems(fc) {
		if (fc.start.type === "flow-seq-start") {
			for (const it of fc.items) if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
				if (it.key) it.value = it.key;
				delete it.key;
				if (isFlowToken(it.value)) {
					if (it.value.end) arrayPushArray(it.value.end, it.sep);
					else it.value.end = it.sep;
				} else arrayPushArray(it.start, it.sep);
				delete it.sep;
			}
		}
	}
	/**
	* A YAML concrete syntax tree (CST) parser
	*
	* ```ts
	* const src: string = ...
	* for (const token of new Parser().parse(src)) {
	*   // token: Token
	* }
	* ```
	*
	* To use the parser with a user-provided lexer:
	*
	* ```ts
	* function* parse(source: string, lexer: Lexer) {
	*   const parser = new Parser()
	*   for (const lexeme of lexer.lex(source))
	*     yield* parser.next(lexeme)
	*   yield* parser.end()
	* }
	*
	* const src: string = ...
	* const lexer = new Lexer()
	* for (const token of parse(src, lexer)) {
	*   // token: Token
	* }
	* ```
	*/
	var Parser = class {
		/**
		* @param onNewLine - If defined, called separately with the start position of
		*   each new line (in `parse()`, including the start of input).
		*/
		constructor(onNewLine) {
			/** If true, space and sequence indicators count as indentation */
			this.atNewLine = true;
			/** If true, next token is a scalar value */
			this.atScalar = false;
			/** Current indentation level */
			this.indent = 0;
			/** Current offset since the start of parsing */
			this.offset = 0;
			/** On the same line with a block map key */
			this.onKeyLine = false;
			/** Top indicates the node that's currently being built */
			this.stack = [];
			/** The source of the current token, set in parse() */
			this.source = "";
			/** The type of the current token, set in parse() */
			this.type = "";
			this.lexer = new lexer.Lexer();
			this.onNewLine = onNewLine;
		}
		/**
		* Parse `source` as a YAML stream.
		* If `incomplete`, a part of the last line may be left as a buffer for the next call.
		*
		* Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
		*
		* @returns A generator of tokens representing each directive, document, and other structure.
		*/
		*parse(source, incomplete = false) {
			if (this.onNewLine && this.offset === 0) this.onNewLine(0);
			for (const lexeme of this.lexer.lex(source, incomplete)) yield* this.next(lexeme);
			if (!incomplete) yield* this.end();
		}
		/**
		* Advance the parser by the `source` of one lexical token.
		*/
		*next(source) {
			this.source = source;
			if (node_process.env.LOG_TOKENS) console.log("|", cst.prettyToken(source));
			if (this.atScalar) {
				this.atScalar = false;
				yield* this.step();
				this.offset += source.length;
				return;
			}
			const type = cst.tokenType(source);
			if (!type) {
				const message = `Not a YAML token: ${source}`;
				yield* this.pop({
					type: "error",
					offset: this.offset,
					message,
					source
				});
				this.offset += source.length;
			} else if (type === "scalar") {
				this.atNewLine = false;
				this.atScalar = true;
				this.type = "scalar";
			} else {
				this.type = type;
				yield* this.step();
				switch (type) {
					case "newline":
						this.atNewLine = true;
						this.indent = 0;
						if (this.onNewLine) this.onNewLine(this.offset + source.length);
						break;
					case "space":
						if (this.atNewLine && source[0] === " ") this.indent += source.length;
						break;
					case "explicit-key-ind":
					case "map-value-ind":
					case "seq-item-ind":
						if (this.atNewLine) this.indent += source.length;
						break;
					case "doc-mode":
					case "flow-error-end": return;
					default: this.atNewLine = false;
				}
				this.offset += source.length;
			}
		}
		/** Call at end of input to push out any remaining constructions */
		*end() {
			while (this.stack.length > 0) yield* this.pop();
		}
		get sourceToken() {
			return {
				type: this.type,
				offset: this.offset,
				indent: this.indent,
				source: this.source
			};
		}
		*step() {
			const top = this.peek(1);
			if (this.type === "doc-end" && top?.type !== "doc-end") {
				while (this.stack.length > 0) yield* this.pop();
				this.stack.push({
					type: "doc-end",
					offset: this.offset,
					source: this.source
				});
				return;
			}
			if (!top) return yield* this.stream();
			switch (top.type) {
				case "document": return yield* this.document(top);
				case "alias":
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": return yield* this.scalar(top);
				case "block-scalar": return yield* this.blockScalar(top);
				case "block-map": return yield* this.blockMap(top);
				case "block-seq": return yield* this.blockSequence(top);
				case "flow-collection": return yield* this.flowCollection(top);
				case "doc-end": return yield* this.documentEnd(top);
			}
			/* istanbul ignore next should not happen */
			yield* this.pop();
		}
		peek(n) {
			return this.stack[this.stack.length - n];
		}
		*pop(error) {
			const token = error ?? this.stack.pop();
			/* istanbul ignore if should not happen */
			if (!token) yield {
				type: "error",
				offset: this.offset,
				source: "",
				message: "Tried to pop an empty stack"
			};
			else if (this.stack.length === 0) yield token;
			else {
				const top = this.peek(1);
				if (token.type === "block-scalar") token.indent = "indent" in top ? top.indent : 0;
				else if (token.type === "flow-collection" && top.type === "document") token.indent = 0;
				if (token.type === "flow-collection") fixFlowSeqItems(token);
				switch (top.type) {
					case "document":
						top.value = token;
						break;
					case "block-scalar":
						top.props.push(token);
						break;
					case "block-map": {
						const it = top.items[top.items.length - 1];
						if (it.value) {
							top.items.push({
								start: [],
								key: token,
								sep: []
							});
							this.onKeyLine = true;
							return;
						} else if (it.sep) it.value = token;
						else {
							Object.assign(it, {
								key: token,
								sep: []
							});
							this.onKeyLine = !it.explicitKey;
							return;
						}
						break;
					}
					case "block-seq": {
						const it = top.items[top.items.length - 1];
						if (it.value) top.items.push({
							start: [],
							value: token
						});
						else it.value = token;
						break;
					}
					case "flow-collection": {
						const it = top.items[top.items.length - 1];
						if (!it || it.value) top.items.push({
							start: [],
							key: token,
							sep: []
						});
						else if (it.sep) it.value = token;
						else Object.assign(it, {
							key: token,
							sep: []
						});
						return;
					}
					/* istanbul ignore next should not happen */
					default:
						yield* this.pop();
						yield* this.pop(token);
				}
				if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
					const last = token.items[token.items.length - 1];
					if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
						if (top.type === "document") top.end = last.start;
						else top.items.push({ start: last.start });
						token.items.splice(-1, 1);
					}
				}
			}
		}
		*stream() {
			switch (this.type) {
				case "directive-line":
					yield {
						type: "directive",
						offset: this.offset,
						source: this.source
					};
					return;
				case "byte-order-mark":
				case "space":
				case "comment":
				case "newline":
					yield this.sourceToken;
					return;
				case "doc-mode":
				case "doc-start": {
					const doc = {
						type: "document",
						offset: this.offset,
						start: []
					};
					if (this.type === "doc-start") doc.start.push(this.sourceToken);
					this.stack.push(doc);
					return;
				}
			}
			yield {
				type: "error",
				offset: this.offset,
				message: `Unexpected ${this.type} token in YAML stream`,
				source: this.source
			};
		}
		*document(doc) {
			if (doc.value) return yield* this.lineEnd(doc);
			switch (this.type) {
				case "doc-start":
					if (findNonEmptyIndex(doc.start) !== -1) {
						yield* this.pop();
						yield* this.step();
					} else doc.start.push(this.sourceToken);
					return;
				case "anchor":
				case "tag":
				case "space":
				case "comment":
				case "newline":
					doc.start.push(this.sourceToken);
					return;
			}
			const bv = this.startBlockValue(doc);
			if (bv) this.stack.push(bv);
			else yield {
				type: "error",
				offset: this.offset,
				message: `Unexpected ${this.type} token in YAML document`,
				source: this.source
			};
		}
		*scalar(scalar) {
			if (this.type === "map-value-ind") {
				const start = getFirstKeyStartProps(getPrevProps(this.peek(2)));
				let sep;
				if (scalar.end) {
					sep = scalar.end;
					sep.push(this.sourceToken);
					delete scalar.end;
				} else sep = [this.sourceToken];
				const map = {
					type: "block-map",
					offset: scalar.offset,
					indent: scalar.indent,
					items: [{
						start,
						key: scalar,
						sep
					}]
				};
				this.onKeyLine = true;
				this.stack[this.stack.length - 1] = map;
			} else yield* this.lineEnd(scalar);
		}
		*blockScalar(scalar) {
			switch (this.type) {
				case "space":
				case "comment":
				case "newline":
					scalar.props.push(this.sourceToken);
					return;
				case "scalar":
					scalar.source = this.source;
					this.atNewLine = true;
					this.indent = 0;
					if (this.onNewLine) {
						let nl = this.source.indexOf("\n") + 1;
						while (nl !== 0) {
							this.onNewLine(this.offset + nl);
							nl = this.source.indexOf("\n", nl) + 1;
						}
					}
					yield* this.pop();
					break;
				/* istanbul ignore next should not happen */
				default:
					yield* this.pop();
					yield* this.step();
			}
		}
		*blockMap(map) {
			const it = map.items[map.items.length - 1];
			switch (this.type) {
				case "newline":
					this.onKeyLine = false;
					if (it.value) {
						const end = "end" in it.value ? it.value.end : void 0;
						if ((Array.isArray(end) ? end[end.length - 1] : void 0)?.type === "comment") end?.push(this.sourceToken);
						else map.items.push({ start: [this.sourceToken] });
					} else if (it.sep) it.sep.push(this.sourceToken);
					else it.start.push(this.sourceToken);
					return;
				case "space":
				case "comment":
					if (it.value) map.items.push({ start: [this.sourceToken] });
					else if (it.sep) it.sep.push(this.sourceToken);
					else {
						if (this.atIndentedComment(it.start, map.indent)) {
							const end = map.items[map.items.length - 2]?.value?.end;
							if (Array.isArray(end)) {
								arrayPushArray(end, it.start);
								end.push(this.sourceToken);
								map.items.pop();
								return;
							}
						}
						it.start.push(this.sourceToken);
					}
					return;
			}
			if (this.indent >= map.indent) {
				const atMapIndent = !this.onKeyLine && this.indent === map.indent;
				const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
				let start = [];
				if (atNextItem && it.sep && !it.value) {
					const nl = [];
					for (let i = 0; i < it.sep.length; ++i) {
						const st = it.sep[i];
						switch (st.type) {
							case "newline":
								nl.push(i);
								break;
							case "space": break;
							case "comment":
								if (st.indent > map.indent) nl.length = 0;
								break;
							default: nl.length = 0;
						}
					}
					if (nl.length >= 2) start = it.sep.splice(nl[1]);
				}
				switch (this.type) {
					case "anchor":
					case "tag":
						if (atNextItem || it.value) {
							start.push(this.sourceToken);
							map.items.push({ start });
							this.onKeyLine = true;
						} else if (it.sep) it.sep.push(this.sourceToken);
						else it.start.push(this.sourceToken);
						return;
					case "explicit-key-ind":
						if (!it.sep && !it.explicitKey) {
							it.start.push(this.sourceToken);
							it.explicitKey = true;
						} else if (atNextItem || it.value) {
							start.push(this.sourceToken);
							map.items.push({
								start,
								explicitKey: true
							});
						} else this.stack.push({
							type: "block-map",
							offset: this.offset,
							indent: this.indent,
							items: [{
								start: [this.sourceToken],
								explicitKey: true
							}]
						});
						this.onKeyLine = true;
						return;
					case "map-value-ind":
						if (it.explicitKey) {
							if (!it.sep) {
								if (includesToken(it.start, "newline")) Object.assign(it, {
									key: null,
									sep: [this.sourceToken]
								});
								else {
									const start = getFirstKeyStartProps(it.start);
									this.stack.push({
										type: "block-map",
										offset: this.offset,
										indent: this.indent,
										items: [{
											start,
											key: null,
											sep: [this.sourceToken]
										}]
									});
								}
							} else if (it.value) map.items.push({
								start: [],
								key: null,
								sep: [this.sourceToken]
							});
							else if (includesToken(it.sep, "map-value-ind")) this.stack.push({
								type: "block-map",
								offset: this.offset,
								indent: this.indent,
								items: [{
									start,
									key: null,
									sep: [this.sourceToken]
								}]
							});
							else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
								const start = getFirstKeyStartProps(it.start);
								const key = it.key;
								const sep = it.sep;
								sep.push(this.sourceToken);
								delete it.key;
								delete it.sep;
								this.stack.push({
									type: "block-map",
									offset: this.offset,
									indent: this.indent,
									items: [{
										start,
										key,
										sep
									}]
								});
							} else if (start.length > 0) it.sep = it.sep.concat(start, this.sourceToken);
							else it.sep.push(this.sourceToken);
						} else if (!it.sep) Object.assign(it, {
							key: null,
							sep: [this.sourceToken]
						});
						else if (it.value || atNextItem) map.items.push({
							start,
							key: null,
							sep: [this.sourceToken]
						});
						else if (includesToken(it.sep, "map-value-ind")) this.stack.push({
							type: "block-map",
							offset: this.offset,
							indent: this.indent,
							items: [{
								start: [],
								key: null,
								sep: [this.sourceToken]
							}]
						});
						else it.sep.push(this.sourceToken);
						this.onKeyLine = true;
						return;
					case "alias":
					case "scalar":
					case "single-quoted-scalar":
					case "double-quoted-scalar": {
						const fs = this.flowScalar(this.type);
						if (atNextItem || it.value) {
							map.items.push({
								start,
								key: fs,
								sep: []
							});
							this.onKeyLine = true;
						} else if (it.sep) this.stack.push(fs);
						else {
							Object.assign(it, {
								key: fs,
								sep: []
							});
							this.onKeyLine = true;
						}
						return;
					}
					default: {
						const bv = this.startBlockValue(map);
						if (bv) {
							if (bv.type === "block-seq") {
								if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
									yield* this.pop({
										type: "error",
										offset: this.offset,
										message: "Unexpected block-seq-ind on same line with key",
										source: this.source
									});
									return;
								}
							} else if (atMapIndent) map.items.push({ start });
							this.stack.push(bv);
							return;
						}
					}
				}
			}
			yield* this.pop();
			yield* this.step();
		}
		*blockSequence(seq) {
			const it = seq.items[seq.items.length - 1];
			switch (this.type) {
				case "newline":
					if (it.value) {
						const end = "end" in it.value ? it.value.end : void 0;
						if ((Array.isArray(end) ? end[end.length - 1] : void 0)?.type === "comment") end?.push(this.sourceToken);
						else seq.items.push({ start: [this.sourceToken] });
					} else it.start.push(this.sourceToken);
					return;
				case "space":
				case "comment":
					if (it.value) seq.items.push({ start: [this.sourceToken] });
					else {
						if (this.atIndentedComment(it.start, seq.indent)) {
							const end = seq.items[seq.items.length - 2]?.value?.end;
							if (Array.isArray(end)) {
								arrayPushArray(end, it.start);
								end.push(this.sourceToken);
								seq.items.pop();
								return;
							}
						}
						it.start.push(this.sourceToken);
					}
					return;
				case "anchor":
				case "tag":
					if (it.value || this.indent <= seq.indent) break;
					it.start.push(this.sourceToken);
					return;
				case "seq-item-ind":
					if (this.indent !== seq.indent) break;
					if (it.value || includesToken(it.start, "seq-item-ind")) seq.items.push({ start: [this.sourceToken] });
					else it.start.push(this.sourceToken);
					return;
			}
			if (this.indent > seq.indent) {
				const bv = this.startBlockValue(seq);
				if (bv) {
					this.stack.push(bv);
					return;
				}
			}
			yield* this.pop();
			yield* this.step();
		}
		*flowCollection(fc) {
			const it = fc.items[fc.items.length - 1];
			if (this.type === "flow-error-end") {
				let top;
				do {
					yield* this.pop();
					top = this.peek(1);
				} while (top?.type === "flow-collection");
			} else if (fc.end.length === 0) {
				switch (this.type) {
					case "comma":
					case "explicit-key-ind":
						if (!it || it.sep) fc.items.push({ start: [this.sourceToken] });
						else it.start.push(this.sourceToken);
						return;
					case "map-value-ind":
						if (!it || it.value) fc.items.push({
							start: [],
							key: null,
							sep: [this.sourceToken]
						});
						else if (it.sep) it.sep.push(this.sourceToken);
						else Object.assign(it, {
							key: null,
							sep: [this.sourceToken]
						});
						return;
					case "space":
					case "comment":
					case "newline":
					case "anchor":
					case "tag":
						if (!it || it.value) fc.items.push({ start: [this.sourceToken] });
						else if (it.sep) it.sep.push(this.sourceToken);
						else it.start.push(this.sourceToken);
						return;
					case "alias":
					case "scalar":
					case "single-quoted-scalar":
					case "double-quoted-scalar": {
						const fs = this.flowScalar(this.type);
						if (!it || it.value) fc.items.push({
							start: [],
							key: fs,
							sep: []
						});
						else if (it.sep) this.stack.push(fs);
						else Object.assign(it, {
							key: fs,
							sep: []
						});
						return;
					}
					case "flow-map-end":
					case "flow-seq-end":
						fc.end.push(this.sourceToken);
						return;
				}
				const bv = this.startBlockValue(fc);
				/* istanbul ignore else should not happen */
				if (bv) this.stack.push(bv);
				else {
					yield* this.pop();
					yield* this.step();
				}
			} else {
				const parent = this.peek(2);
				if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
					yield* this.pop();
					yield* this.step();
				} else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
					const start = getFirstKeyStartProps(getPrevProps(parent));
					fixFlowSeqItems(fc);
					const sep = fc.end.splice(1, fc.end.length);
					sep.push(this.sourceToken);
					const map = {
						type: "block-map",
						offset: fc.offset,
						indent: fc.indent,
						items: [{
							start,
							key: fc,
							sep
						}]
					};
					this.onKeyLine = true;
					this.stack[this.stack.length - 1] = map;
				} else yield* this.lineEnd(fc);
			}
		}
		flowScalar(type) {
			if (this.onNewLine) {
				let nl = this.source.indexOf("\n") + 1;
				while (nl !== 0) {
					this.onNewLine(this.offset + nl);
					nl = this.source.indexOf("\n", nl) + 1;
				}
			}
			return {
				type,
				offset: this.offset,
				indent: this.indent,
				source: this.source
			};
		}
		startBlockValue(parent) {
			switch (this.type) {
				case "alias":
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": return this.flowScalar(this.type);
				case "block-scalar-header": return {
					type: "block-scalar",
					offset: this.offset,
					indent: this.indent,
					props: [this.sourceToken],
					source: ""
				};
				case "flow-map-start":
				case "flow-seq-start": return {
					type: "flow-collection",
					offset: this.offset,
					indent: this.indent,
					start: this.sourceToken,
					items: [],
					end: []
				};
				case "seq-item-ind": return {
					type: "block-seq",
					offset: this.offset,
					indent: this.indent,
					items: [{ start: [this.sourceToken] }]
				};
				case "explicit-key-ind": {
					this.onKeyLine = true;
					const start = getFirstKeyStartProps(getPrevProps(parent));
					start.push(this.sourceToken);
					return {
						type: "block-map",
						offset: this.offset,
						indent: this.indent,
						items: [{
							start,
							explicitKey: true
						}]
					};
				}
				case "map-value-ind": {
					this.onKeyLine = true;
					const start = getFirstKeyStartProps(getPrevProps(parent));
					return {
						type: "block-map",
						offset: this.offset,
						indent: this.indent,
						items: [{
							start,
							key: null,
							sep: [this.sourceToken]
						}]
					};
				}
			}
			return null;
		}
		atIndentedComment(start, indent) {
			if (this.type !== "comment") return false;
			if (this.indent <= indent) return false;
			return start.every((st) => st.type === "newline" || st.type === "space");
		}
		*documentEnd(docEnd) {
			if (this.type !== "doc-mode") {
				if (docEnd.end) docEnd.end.push(this.sourceToken);
				else docEnd.end = [this.sourceToken];
				if (this.type === "newline") yield* this.pop();
			}
		}
		*lineEnd(token) {
			switch (this.type) {
				case "comma":
				case "doc-start":
				case "doc-end":
				case "flow-seq-end":
				case "flow-map-end":
				case "map-value-ind":
					yield* this.pop();
					yield* this.step();
					break;
				case "newline": this.onKeyLine = false;
				default:
					if (token.end) token.end.push(this.sourceToken);
					else token.end = [this.sourceToken];
					if (this.type === "newline") yield* this.pop();
			}
		}
	};
	exports.Parser = Parser;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/public-api.js
var require_public_api = /* @__PURE__ */ __commonJSMin(((exports) => {
	var composer = require_composer();
	var Document = require_Document();
	var errors = require_errors();
	var log = require_log();
	var identity = require_identity();
	var lineCounter = require_line_counter();
	var parser = require_parser();
	function parseOptions(options) {
		const prettyErrors = options.prettyErrors !== false;
		return {
			lineCounter: options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null,
			prettyErrors
		};
	}
	/**
	* Parse the input as a stream of YAML documents.
	*
	* Documents should be separated from each other by `...` or `---` marker lines.
	*
	* @returns If an empty `docs` array is returned, it will be of type
	*   EmptyStream and contain additional stream information. In
	*   TypeScript, you should use `'empty' in docs` as a type guard for it.
	*/
	function parseAllDocuments(source, options = {}) {
		const { lineCounter, prettyErrors } = parseOptions(options);
		const parser$1 = new parser.Parser(lineCounter?.addNewLine);
		const composer$1 = new composer.Composer(options);
		const docs = Array.from(composer$1.compose(parser$1.parse(source)));
		if (prettyErrors && lineCounter) for (const doc of docs) {
			doc.errors.forEach(errors.prettifyError(source, lineCounter));
			doc.warnings.forEach(errors.prettifyError(source, lineCounter));
		}
		if (docs.length > 0) return docs;
		return Object.assign([], { empty: true }, composer$1.streamInfo());
	}
	/** Parse an input string into a single YAML.Document */
	function parseDocument(source, options = {}) {
		const { lineCounter, prettyErrors } = parseOptions(options);
		const parser$1 = new parser.Parser(lineCounter?.addNewLine);
		const composer$1 = new composer.Composer(options);
		let doc = null;
		for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) if (!doc) doc = _doc;
		else if (doc.options.logLevel !== "silent") {
			doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
			break;
		}
		if (prettyErrors && lineCounter) {
			doc.errors.forEach(errors.prettifyError(source, lineCounter));
			doc.warnings.forEach(errors.prettifyError(source, lineCounter));
		}
		return doc;
	}
	function parse(src, reviver, options) {
		let _reviver = void 0;
		if (typeof reviver === "function") _reviver = reviver;
		else if (options === void 0 && reviver && typeof reviver === "object") options = reviver;
		const doc = parseDocument(src, options);
		if (!doc) return null;
		doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
		if (doc.errors.length > 0) {
			if (doc.options.logLevel !== "silent") throw doc.errors[0];
			else doc.errors = [];
		}
		return doc.toJS(Object.assign({ reviver: _reviver }, options));
	}
	function stringify(value, replacer, options) {
		let _replacer = null;
		if (typeof replacer === "function" || Array.isArray(replacer)) _replacer = replacer;
		else if (options === void 0 && replacer) options = replacer;
		if (typeof options === "string") options = options.length;
		if (typeof options === "number") {
			const indent = Math.round(options);
			options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
		}
		if (value === void 0) {
			const { keepUndefined } = options ?? replacer ?? {};
			if (!keepUndefined) return void 0;
		}
		if (identity.isDocument(value) && !_replacer) return value.toString(options);
		return new Document.Document(value, _replacer, options).toString(options);
	}
	exports.parse = parse;
	exports.parseAllDocuments = parseAllDocuments;
	exports.parseDocument = parseDocument;
	exports.stringify = stringify;
}));

// ../../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/index.js
var require_dist = /* @__PURE__ */ __commonJSMin(((exports) => {
	var composer = require_composer();
	var Document = require_Document();
	var Schema = require_Schema();
	var errors = require_errors();
	var Alias = require_Alias();
	var identity = require_identity();
	var Pair = require_Pair();
	var Scalar = require_Scalar();
	var YAMLMap = require_YAMLMap();
	var YAMLSeq = require_YAMLSeq();
	var cst = require_cst();
	var lexer = require_lexer();
	var lineCounter = require_line_counter();
	var parser = require_parser();
	var publicApi = require_public_api();
	var visit = require_visit();
	exports.Composer = composer.Composer;
	exports.Document = Document.Document;
	exports.Schema = Schema.Schema;
	exports.YAMLError = errors.YAMLError;
	exports.YAMLParseError = errors.YAMLParseError;
	exports.YAMLWarning = errors.YAMLWarning;
	exports.Alias = Alias.Alias;
	exports.isAlias = identity.isAlias;
	exports.isCollection = identity.isCollection;
	exports.isDocument = identity.isDocument;
	exports.isMap = identity.isMap;
	exports.isNode = identity.isNode;
	exports.isPair = identity.isPair;
	exports.isScalar = identity.isScalar;
	exports.isSeq = identity.isSeq;
	exports.Pair = Pair.Pair;
	exports.Scalar = Scalar.Scalar;
	exports.YAMLMap = YAMLMap.YAMLMap;
	exports.YAMLSeq = YAMLSeq.YAMLSeq;
	exports.Lexer = lexer.Lexer;
	exports.LineCounter = lineCounter.LineCounter;
	exports.Parser = parser.Parser;
	exports.parse = publicApi.parse;
	exports.parseAllDocuments = publicApi.parseAllDocuments;
	exports.parseDocument = publicApi.parseDocument;
	exports.stringify = publicApi.stringify;
	exports.visit = visit.visit;
	exports.visitAsync = visit.visitAsync;
}));

// src/config/hosts.ts
var import_dist = /* @__PURE__ */ __toESM(require_dist(), 1);
const FIELDS = [
	"org",
	"apiUrl",
	"keyFile"
];
function isEntry(value) {
	if (!isRecord(value)) return false;
	return FIELDS.every((field) => typeof value[field] === "string");
}
async function readHosts(file) {
	let text;
	try {
		text = await readFile(file, "utf8");
	} catch (error) {
		if (errorCode(error) === "ENOENT") return {};
		throw error;
	}
	const parsed = import_dist.parse(text) ?? {};
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new CliError(`${file} is not a hosts table.`);
	const table = {};
	for (const [host, entry] of Object.entries(parsed)) {
		if (!isEntry(entry)) throw new CliError(`${file}: the entry for ${host} needs org, apiUrl, and keyFile.`);
		table[host] = {
			org: entry.org,
			apiUrl: entry.apiUrl,
			keyFile: entry.keyFile
		};
	}
	return table;
}
async function writeHosts(file, table) {
	await mkdir(dirname(file), {
		recursive: true,
		mode: 448
	});
	const sorted = Object.fromEntries(Object.entries(table).toSorted(([left], [right]) => left.localeCompare(right)));
	const text = Object.keys(sorted).length === 0 ? "" : import_dist.stringify(sorted);
	await writeFile(file, text, { mode: 384 });
}

// src/config/paths.ts
/** ~/.config/pierre, or $XDG_CONFIG_HOME/pierre, or $PIERRE_CONFIG_DIR. */
function configPaths(env) {
	const home = envValue(env, "HOME") ?? homedir();
	const base = envValue(env, "XDG_CONFIG_HOME") ?? join(home, ".config");
	const dir = envValue(env, "PIERRE_CONFIG_DIR") ?? join(base, "pierre");
	const keysDir = join(dir, "keys");
	return {
		dir,
		hostsFile: join(dir, "hosts.yml"),
		keysDir,
		keyFile: (host) => join(keysDir, `${host}.pem`)
	};
}

// src/config/keys.ts
/** A PEM whose BEGIN and END markers share one line. The paste lost its newlines. */
const ONE_LINE_PEM = /-----BEGIN [A-Z ]*PRIVATE KEY-----[^\n]+-----END [A-Z ]*PRIVATE KEY-----/;
/** Parse a private key PEM. Reject every type except EC and RSA. */
function parsePrivateKey(pem) {
	let key;
	try {
		key = createPrivateKey(pem);
	} catch {
		if (ONE_LINE_PEM.test(pem)) throw credentialError("The private key is on one line. Its newlines were lost.", "Use the dashboard copy button, and store the key in a multi-line field.");
		throw credentialError("The private key is not a valid PEM private key.", "Use the PKCS8 key that the dashboard Keys page created.");
	}
	const type = key.asymmetricKeyType;
	if (type !== "ec" && type !== "rsa") throw credentialError(`The private key type ${type ?? "unknown"} is not supported. Use an EC or RSA key.`);
	return {
		pem: key.export({
			type: "pkcs8",
			format: "pem"
		}).toString(),
		type,
		keyId: keyIdOf(key)
	};
}
/** The key ID: the lowercase hex SHA-256 of the public key in SPKI DER form. */
function keyIdOf(key) {
	const der = (key.type === "public" ? key : createPublicKey(key)).export({
		type: "spki",
		format: "der"
	});
	return createHash("sha256").update(der).digest("hex");
}
async function writeKeyFile(path, pem) {
	await mkdir(dirname(path), {
		recursive: true,
		mode: 448
	});
	await writeFile(path, pem, { mode: 384 });
	await chmod(path, 384);
}
async function readKeyFile(path) {
	try {
		return await readFile(path, "utf8");
	} catch (error) {
		if (errorCode(error) === "ENOENT") throw credentialError(`The key file ${path} does not exist.`, "Run `pierre auth login --hostname <host> --with-key` to store a key.");
		throw error;
	}
}
async function removeKeyFile(path) {
	await rm(path, { force: true });
}

// src/config/token.ts
/** Decode a JWT without a signature check. The server verifies the signature. */
function parseToken(raw, name = "PIERRE_TOKEN") {
	const token = raw.trim();
	const invalid = credentialError(`${name} is not a JWT.`, "Set it to the token only, with no \"Bearer \" prefix.");
	const parts = token.split(".");
	if (parts.length !== 3 || parts.some((part) => !/^[\w-]+$/.test(part))) throw invalid;
	let claims;
	try {
		claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
	} catch {
		throw invalid;
	}
	if (!claims || typeof claims !== "object" || Array.isArray(claims)) throw invalid;
	const iss = claims.iss;
	return {
		token,
		issuer: typeof iss === "string" && iss.trim() ? iss.trim() : void 0
	};
}

// src/repo-path.ts
const SUFFIXES = ["+ephemeral", "+import"];
/**
* The repository name in the URL path of a Code Storage remote.
* An ephemeral or import remote uses the credential of its base repository.
*/
function repoFromPath(path) {
	let repo = path.replace(/^\/+|\/+$/g, "");
	if (repo.endsWith(".git")) repo = repo.slice(0, -4);
	const suffix = SUFFIXES.find((candidate) => repo.endsWith(candidate));
	if (suffix) repo = repo.slice(0, -suffix.length);
	return repo.split("/").map((segment) => {
		try {
			return decodeURIComponent(segment);
		} catch {
			throw usageError(`Cannot decode the repository path segment "${segment}".`);
		}
	}).join("/");
}
/** The host and repository of an HTTPS remote URL, or undefined for another URL. */
function parseRemoteUrl(raw) {
	let url;
	try {
		url = new URL(raw.trim());
	} catch {
		return;
	}
	if (url.protocol !== "https:") return void 0;
	try {
		const repo = repoFromPath(url.pathname);
		return repo ? {
			host: url.host.toLowerCase(),
			repo
		} : void 0;
	} catch {
		return;
	}
}

// src/git.ts
const execFileAsync = promisify(execFile);
var GitError = class extends Error {
	args;
	exitCode;
	stderr;
	constructor(args, exitCode, stderr) {
		super(`git ${args.join(" ")} failed${stderr ? `: ${stderr}` : ""}`);
		this.args = args;
		this.exitCode = exitCode;
		this.stderr = stderr;
		this.name = "GitError";
	}
};
/** Run git and return its stdout without the final newline. */
async function git(args, options) {
	try {
		const { stdout } = await execFileAsync("git", args, {
			cwd: options.cwd,
			env: options.env,
			maxBuffer: 16777216
		});
		return stdout.replace(/\n$/, "");
	} catch (error) {
		const code = errorCode(error);
		if (typeof code === "number") {
			const stderr = isRecord(error) && typeof error.stderr === "string" ? error.stderr : "";
			throw new GitError(args, code, stderr.trim());
		}
		throw new GitError(args, 1, errorMessage(error));
	}
}
/** Run git and return undefined when it exits with a non-zero code. */
async function gitOptional(args, options) {
	try {
		return await git(args, options);
	} catch (error) {
		if (error instanceof GitError) return void 0;
		throw error;
	}
}
function gitTopLevel(options) {
	return gitOptional(["rev-parse", "--show-toplevel"], options);
}
function gitConfigGet(scope, key, options) {
	return gitOptional([
		"config",
		`--${scope}`,
		"--get",
		key
	], options);
}
async function gitRemotes(options) {
	const output = await gitOptional([
		"config",
		"--get-regexp",
		String.raw`^remote\..*\.url$`
	], options);
	if (!output) return [];
	return output.split("\n").flatMap((line) => {
		const match = /^remote\.(.+)\.url (.+)$/.exec(line);
		return match ? [{
			name: match[1],
			url: match[2]
		}] : [];
	});
}
/**
* The Code Storage remotes of the current repository, best first: a known host
* before a *.code.storage host, and the `storage` remote before another name.
*/
async function storageRemotes(options, knownHosts) {
	const rank = (remote) => {
		return (knownHosts.includes(remote.host) ? 0 : orgFromHost(remote.host) ? 1 : 2) * 2 + (remote.name === "storage" ? 0 : 1);
	};
	return (await gitRemotes(options)).flatMap((remote) => {
		const parsed = parseRemoteUrl(remote.url);
		return parsed ? [{
			...remote,
			...parsed
		}] : [];
	}).filter((remote) => rank(remote) < 4).toSorted((left, right) => rank(left) - rank(right));
}

// src/resolve.ts
/** The variable or file that supplies the credential, for status and diagnostics. */
function authSource(auth) {
	if (auth.kind === "token") return "PIERRE_TOKEN";
	return auth.source.kind === "environment" ? auth.source.name : auth.source.path;
}
function pick(host, hosts) {
	return {
		host,
		entry: hosts[host]
	};
}
/** The org from the environment: PIERRE_ORG, the `iss` claim of PIERRE_TOKEN. */
function envOrg(env) {
	const org = envValue(env, "PIERRE_ORG");
	if (org) return org;
	const token = envValue(env, "PIERRE_TOKEN");
	return token ? parseToken(token).issuer : void 0;
}
/** The default host of the org from the environment, when no host is saved. */
function envDefaultHost(env) {
	const org = envOrg(env);
	return org ? normalizeHost(defaultHost(org), "PIERRE_ORG") : void 0;
}
/**
* Select the host. First match wins: --hostname, PIERRE_GIT_HOST, the Code Storage
* remote of the current repository, the single configured host, the default
* host of the org from the environment.
*/
async function selectHost(session, hosts) {
	const { env, cwd } = session.ctx;
	if (session.options.hostname?.trim()) return pick(normalizeHost(session.options.hostname), hosts);
	const fromEnv = envValue(env, "PIERRE_GIT_HOST");
	if (fromEnv) return pick(normalizeHost(fromEnv, "PIERRE_GIT_HOST"), hosts);
	const known = Object.keys(hosts);
	const [remote] = await storageRemotes({
		cwd,
		env
	}, known);
	if (remote) return pick(remote.host, hosts);
	if (known.length === 1) return pick(known[0], hosts);
	if (known.length > 1) throw usageError("Several hosts are configured. Pass --hostname <host> or set PIERRE_GIT_HOST.", known.map((host) => `  ${host}`).join("\n"));
	const fallback = envDefaultHost(env);
	if (fallback) return pick(fallback, hosts);
	throw credentialError("No host is configured.", "Run `pierre auth login --hostname <host> --with-key`, or set PIERRE_ORG and PIERRE_PRIVATE_KEY.");
}
/** The org: the host entry, PIERRE_ORG, the PIERRE_TOKEN issuer, the *.code.storage subdomain. */
function resolveOrg(host, entry, env) {
	const org = entry?.org ?? envOrg(env) ?? orgFromHost(host);
	if (!org) throw new CliError(`Cannot derive the organization for ${host}.`, void 0, "Set PIERRE_ORG, or run `pierre auth login --hostname <host> --org <org> --api-url <url> --with-key`.");
	return org;
}
/** The API URL: the host entry, PIERRE_API_BASE_URL, the default shape for the org. */
function resolveApiUrl(host, entry, env, org) {
	if (entry) return entry.apiUrl;
	const fromEnv = envValue(env, "PIERRE_API_BASE_URL");
	if (fromEnv) return normalizeApiUrl(fromEnv, "PIERRE_API_BASE_URL");
	return defaultApiUrl(orgFromHost(host) ?? org);
}
/** The key: PIERRE_PRIVATE_KEY, PIERRE_PRIVATE_KEY_FILE, the host entry's key file. */
async function resolveKey(env, entry) {
	const inline = envValue(env, "PIERRE_PRIVATE_KEY");
	if (inline) return {
		key: inline.replaceAll(String.raw`\n`, "\n"),
		source: {
			kind: "environment",
			name: "PIERRE_PRIVATE_KEY"
		}
	};
	const file = envValue(env, "PIERRE_PRIVATE_KEY_FILE") ?? entry?.keyFile;
	if (file) return {
		key: await readKeyFile(file),
		source: {
			kind: "file",
			path: file
		}
	};
	throw credentialError("No private key is configured.", "Run `pierre auth login --hostname <host> --with-key`, or set PIERRE_PRIVATE_KEY, PIERRE_PRIVATE_KEY_FILE, or PIERRE_TOKEN.");
}
/** The auth: PIERRE_TOKEN, else the private key. */
async function resolveAuth(env, entry) {
	const token = envValue(env, "PIERRE_TOKEN");
	if (token) return {
		kind: "token",
		token: parseToken(token).token
	};
	const { key, source } = await resolveKey(env, entry);
	const parsed = parsePrivateKey(key);
	return {
		kind: "key",
		key: parsed.pem,
		keyId: parsed.keyId,
		source
	};
}
async function resolveCredential(env, selection) {
	const { host, entry } = selection;
	const org = resolveOrg(host, entry, env);
	return {
		host,
		org,
		apiUrl: resolveApiUrl(host, entry, env, org),
		auth: await resolveAuth(env, entry),
		entry
	};
}

// src/connect.ts
/** Select the host, resolve its credential, and make its client. */
async function connect(session) {
	const { env } = session.ctx;
	const hosts = await readHosts(configPaths(env).hostsFile);
	const credential = await resolveCredential(env, await selectHost(session, hosts));
	return {
		credential,
		client: createClient(credential)
	};
}

// src/session.ts
function debugEnabled(ctx, options) {
	if (options.debug) return true;
	const flag = (ctx.env.PIERRE_DEBUG ?? "").trim().toLowerCase();
	return flag !== "" && flag !== "0" && flag !== "false";
}
function globalOptions(command) {
	const raw = command.optsWithGlobals();
	return {
		hostname: raw.hostname,
		json: raw.json === true,
		noInput: raw.input === false,
		yes: raw.yes === true,
		quiet: raw.quiet === true,
		debug: raw.debug === true
	};
}
function createSession(ctx, command) {
	const options = globalOptions(command);
	const debug = debugEnabled(ctx, options);
	return {
		ctx,
		options,
		out: (text) => ctx.stdout.write(`${text}\n`),
		info: (text) => {
			if (!options.quiet) ctx.stdout.write(`${text}\n`);
		},
		warn: (text) => ctx.stderr.write(`pierre: ${text}\n`),
		debug: (text) => {
			if (debug) ctx.stderr.write(`pierre: ${text}\n`);
		},
		json: (value) => ctx.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
	};
}

// src/output.ts
/** Align rows into columns with two spaces between them. */
function formatTable(rows) {
	const widths = [];
	for (const row of rows) row.forEach((cell, index) => {
		widths[index] = Math.max(widths[index] ?? 0, cell.length);
	});
	return rows.map((row) => row.map((cell, index) => index === row.length - 1 ? cell : cell.padEnd(widths[index])).join("  ").trimEnd());
}

// src/api/execute.ts
const STATUS_TEXT = {
	200: "OK",
	201: "Created",
	202: "Accepted",
	204: "No Content",
	206: "Partial Content",
	304: "Not Modified"
};
/** The SDK method of a catalog ID: `repos.branches.create` gives `pierre.repos.branches.create`. */
function sdkMethod(client, id) {
	const path = id.split(".");
	const name = path.pop() ?? "";
	let owner = client;
	for (const segment of path) owner = typeof owner === "object" && owner !== null ? Reflect.get(owner, segment) : void 0;
	const method = typeof owner === "object" && owner !== null ? Reflect.get(owner, name) : void 0;
	if (typeof method !== "function") throw new CliError(`The SDK has no method ${id}.`);
	return (params) => Reflect.apply(method, owner, [params]);
}
function isSent(value) {
	return isRecord(value) && typeof value.withResponse === "function" && typeof value.asResponse === "function";
}
/** Checks the output of a byte response before the request. */
function checkOutput(session, spec, output) {
	if (spec.response === "bytes" && output.output === void 0 && session.ctx.stdout.isTTY) throw usageError("The response is bytes. Pass --output <file>, or pipe stdout.");
}
const text = (value) => typeof value === "string" ? value : JSON.stringify(value);
function printStatus$1(session, response) {
	const words = STATUS_TEXT[response.status] ?? response.statusText;
	session.out(`${response.status}${words ? ` ${words}` : ""}`);
}
function printObject(session, body, display) {
	if (!isRecord(body)) {
		session.json(body);
		return;
	}
	const keys = (display ?? Object.keys(body)).filter((key) => key in body);
	for (const line of formatTable(keys.map((key) => [key, text(body[key])]))) session.out(line);
}
function printItems(session, items, spec) {
	if (items.length === 0) {
		session.info("No items.");
		return;
	}
	const first = items[0];
	const columns = spec.display ?? (isRecord(first) ? Object.keys(first) : []);
	const rows = items.map((item) => columns.map((column) => isRecord(item) && column in item ? text(item[column]) : ""));
	for (const line of formatTable([[...columns], ...rows])) session.out(line);
}
async function writeBytes(session, response, file) {
	if (response.body === null) return;
	const source = Readable.fromWeb(response.body);
	if (file !== void 0) {
		await pipeline(source, createWriteStream(resolve(session.ctx.cwd, file)));
		return;
	}
	for await (const chunk of source) session.ctx.stdout.write(chunk);
}
/** Calls the SDK method with the params, and prints the result. */
async function execute(session, spec, method, params, output) {
	const sent = method(params);
	if (!isSent(sent)) throw new CliError(`The SDK method of ${spec.id} gave no response.`);
	if (spec.response === "bytes") {
		await writeBytes(session, await sent.asResponse(), output.output);
		return;
	}
	const { data, response } = await sent.withResponse();
	if (data instanceof Page) {
		await printPages(session, spec, data, output);
		return;
	}
	if (output.mode === "json") {
		session.json(data);
		return;
	}
	const declared = spec.statuses.includes(response.status);
	if (spec.response === "none" || spec.statuses.length > 1 || !declared) printStatus$1(session, response);
	if (spec.response === "none") {
		const headers = isRecord(data) ? data.headers : void 0;
		if (isRecord(headers)) printObject(session, headers, null);
		return;
	}
	printObject(session, data, spec.display);
}
async function printPages(session, spec, first, output) {
	if (output.mode === "json") {
		if (!output.paginate) {
			session.json(first.body);
			return;
		}
		for await (const page of first.iterPages()) session.json(page.body);
		return;
	}
	if (!output.paginate) {
		printItems(session, first.data, spec);
		if (first.hasNextPage()) session.warn(`More items: pass --cursor ${first.next_cursor ?? ""}, or --paginate.`);
		return;
	}
	const items = [];
	for await (const page of first.iterPages()) items.push(...page.data);
	printItems(session, items, spec);
}

// src/api/params.ts
/** The text of an option value that Commander gives: a string, or JSON for any other value. */
function optionText(value) {
	return typeof value === "string" ? value : JSON.stringify(value);
}
const strings = (value) => Array.isArray(value) ? value.map(optionText) : [];
/** The value of the flag of a field, from the text that Commander gives. */
async function fieldValue(session, field, raw) {
	const flag = flagOf(field);
	if (field.type === "boolean") return raw === true;
	if (field.type === "object") {
		const value = await jsonOf(session, optionText(raw), flag);
		if (!isRecord(value)) throw usageError(`${flag} needs a JSON object.`);
		return value;
	}
	if (field.type === "array") {
		const items = Array.isArray(raw) ? raw.map(optionText) : [optionText(raw)];
		return Promise.all(items.map((item) => field.items === "object" ? jsonOf(session, item, flag) : scalarValue(field.items, item, flag)));
	}
	return scalarValue(field.type, optionText(raw), flag);
}
/** The repository of the Code Storage remote of the current Git repository on `host`. */
async function cloneRepo(session, host) {
	const { cwd, env } = session.ctx;
	return (await storageRemotes({
		cwd,
		env
	}, [host])).find((entry) => entry.host === host)?.repo;
}
/** Checks the number of positional arguments before the CLI connects. */
function checkOperands(spec, operands) {
	const command = `${spec.resource} ${spec.method}`;
	const allowed = spec.positional === null ? 0 : 1;
	if (operands.length <= allowed) return;
	const got = `Got ${operands.length}: ${operands.join(" ")}.`;
	if (spec.positional === null) throw usageError(`${command} takes no argument. ${got}`, `Pass each value with its flag. See \`pierre ${command} --help\`.`);
	const name = `<${kebab(spec.positional)}>`;
	const [first, ...rest] = operands;
	const hint = spec.repoName !== null && spec.positional !== "repo_name" && operands.length === 2 ? `Pass the repository with -R <repo-name>: pierre ${command} ${rest.join(" ")} -R ${first ?? ""}` : `Pass the other values with their flags. See \`pierre ${command} --help\`.`;
	throw usageError(`${command} takes one argument, ${name}. ${got}`, hint);
}
/** A repository path from a local path under the current directory. */
function repositoryPath(cwd, path, flag) {
	const file = resolve(cwd, path);
	const rel = relative(cwd, file);
	if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) throw usageError(`${flag} ${path} must name a file under the current directory.`);
	return {
		path: posix.normalize(rel.split(sep).join("/")),
		file
	};
}
/** The files of `repos:commits create`, from `--file` and `--delete`. */
async function commitFiles(session, opts) {
	const { cwd } = session.ctx;
	const changes = strings(opts.file);
	const deletes = strings(opts.delete);
	if (changes.length === 0 && deletes.length === 0) throw usageError("Pass --file <path> for each file to add or change, or --delete <path> for each file to delete.");
	const files = [];
	for (const path of changes) {
		const entry = repositoryPath(cwd, path, "--file");
		const info = await stat(entry.file).catch(() => void 0);
		if (info === void 0 || !info.isFile()) throw usageError(`--file ${path} is not a file.`);
		files.push({
			path: entry.path,
			content: () => readFile(entry.file)
		});
	}
	for (const path of deletes) files.push({
		path: repositoryPath(cwd, path, "--delete").path,
		operation: "delete"
	});
	return files;
}
/** The diff of `repos:commits create-from-diff`, from `--diff <file>` or `--diff -`. */
async function commitDiff(session, opts) {
	const value = opts.diff;
	if (typeof value !== "string") throw usageError("Pass --diff <file>, or --diff - for stdin.");
	if (value === "-") return readAll(session.ctx.stdin);
	try {
		return await readFile(resolve(session.ctx.cwd, value), "utf8");
	} catch {
		throw usageError(`--diff ${value} is not a readable file.`);
	}
}
/** The params of the SDK method of an API command. */
async function buildParams(session, spec, input) {
	const params = {};
	const nested = /* @__PURE__ */ new Map();
	for (const { field, sub, attribute } of input.bindings) {
		const raw = input.opts[attribute];
		if (raw === void 0) continue;
		if (sub === void 0) {
			params[field.name] = await fieldValue(session, field, raw);
			continue;
		}
		const values = nested.get(field) ?? {};
		values[sub.name] = scalarValue(sub.type, optionText(raw), `${flagOf(field)}.${kebab(sub.name)}`);
		nested.set(field, values);
	}
	for (const [field, values] of nested) {
		const base = params[field.name];
		params[field.name] = {
			...isRecord(base) ? base : {},
			...values
		};
	}
	const [operand] = input.operands;
	const positional = spec.fields.find((field) => field.name === spec.positional);
	if (positional !== void 0 && operand !== void 0) {
		const value = scalarValue(positional.type, operand, `<${kebab(positional.name)}>`);
		const given = params[positional.name];
		if (given !== void 0 && given !== value) throw usageError(`<${kebab(positional.name)}> is ${operand}, but ${flagOf(positional)} is ${optionText(given)}.`, "Pass one of them.");
		params[positional.name] = value;
	}
	if (spec.repoName === "path" && params.repo_name === void 0 && spec.id !== "repos.delete") {
		const repo = await cloneRepo(session, input.host);
		if (repo !== void 0) {
			params.repo_name = repo;
			session.debug(`--repo-name ${repo} from the Code Storage remote of ${session.ctx.cwd}`);
		}
	}
	for (const field of spec.fields) {
		if (field.deprecated === true || !field.required || params[field.name] !== void 0) continue;
		if (field.name === "repo_name" && field.name !== spec.positional) throw usageError("Pass -R <repo-name>, or run in a clone with a Code Storage remote.");
		if (field.name === spec.positional) throw usageError(`Pass <${kebab(field.name)}>, or ${flagOf(field)}.`);
		throw usageError(`Pass ${flagOf(field)}.`, `See \`pierre ${spec.resource} ${spec.method} --help\`.`);
	}
	if (spec.content === "files") params.files = await commitFiles(session, input.opts);
	if (spec.content === "diff") params.diff = await commitDiff(session, input.opts);
	return params;
}

// src/api/run.ts
async function runApiCommand(ctx, spec, command, bindings) {
	const session = createSession(ctx, command);
	const opts = command.opts();
	const output = {
		mode: session.options.json ? "json" : "human",
		paginate: opts.paginate === true,
		...typeof opts.output === "string" ? { output: opts.output } : {}
	};
	checkOperands(spec, command.args);
	checkOutput(session, spec, output);
	const { credential, client } = await connect(session);
	const params = await buildParams(session, spec, {
		operands: command.args,
		opts,
		bindings,
		host: credential.host
	});
	if (spec.id === "repos.delete") {
		const question = `Delete repository ${String(params.repo_name)} on ${credential.host}?`;
		if (!await confirm(session, question)) {
			session.info("Canceled.");
			return;
		}
	}
	try {
		await execute(session, spec, sdkMethod(client, spec.id), params, output);
	} catch (error) {
		throw toCliError(error, credential);
	}
}

// src/api/tree.ts
/** The heading of the API commands in `pierre --help`. */
const API_GROUP = "API commands (one HTTP operation each):";
const collect$1 = (value, previous) => [...previous ?? [], value];
function valueName(field) {
	switch (field.type) {
		case "integer":
		case "number": return "n";
		case "boolean": return "true|false";
		case "enum": return "value";
		default: return kebab(field.name);
	}
}
/** The flags of one field: its own flag, and a dotted flag for each scalar field of an object. */
function fieldOptions(field) {
	const flag = flagOf(field);
	switch (field.type) {
		case "boolean": return [{
			option: new Option(flag, fieldHelp(field)),
			hidden: new Option(`--no-${kebab(field.name)}`).hideHelp()
		}];
		case "array": {
			const value = field.items === "object" ? "json" : "value";
			return [{ option: new Option(`${flag} <${value}>`, fieldHelp(field)).argParser(collect$1) }];
		}
		case "object": return [{ option: new Option(`${flag} <json>`, fieldHelp(field)) }, ...(field.fields ?? []).map((sub) => ({
			option: new Option(`${flag}.${kebab(sub.name)} <${valueName(sub)}>`, fieldHelp(sub)),
			sub
		}))];
		default: {
			const short = field.name === "repo_name" ? "-R, " : "";
			return [{ option: new Option(`${short}${flag} <${valueName(field)}>`, fieldHelp(field)) }];
		}
	}
}
function footer(spec) {
	const lines = [
		"",
		`Catalog ID: ${spec.id} (${spec.httpMethod} ${spec.path})`,
		`Scopes: ${spec.scopes.join(", ")}`
	];
	if (spec.repoName === "path" && spec.id !== "repos.delete") lines.push("Inside a clone with a Code Storage remote, --repo-name defaults to that repository.");
	lines.push(`Docs: search for \`${spec.id}\` in the docs MCP server, ${DOCS.mcpServer}`);
	return lines.join("\n");
}
function methodCommand(ctx, spec) {
	const command = new Command(spec.method).summary(firstParagraph(spec.summary) || spec.id).description(spec.description ?? spec.summary ?? spec.id).allowExcessArguments(true);
	const positional = spec.fields.find((field) => field.name === spec.positional);
	if (positional !== void 0) command.argument(`[${kebab(positional.name)}]`, firstParagraph(positional.description));
	const bindings = [];
	for (const field of spec.fields) {
		if (field.deprecated === true) continue;
		for (const { option, sub, hidden } of fieldOptions(field)) {
			command.addOption(option);
			if (hidden !== void 0) command.addOption(hidden);
			bindings.push({
				field,
				...sub === void 0 ? {} : { sub },
				attribute: option.attributeName()
			});
		}
	}
	if (spec.content === "files") {
		command.option("--file <path>", "A file to add or change, read from the same path under the current directory. Repeat for each file.", collect$1);
		command.option("--delete <path>", "A file to delete. Repeat for each file.", collect$1);
	}
	if (spec.content === "diff") command.option("--diff <file>", "The diff to apply, in the form that git apply reads. - reads stdin.");
	if (spec.itemField !== null) command.option("--paginate", "Read every page. With --json, print one body for each page.");
	if (spec.response === "bytes") command.option("--output <file>", "Write the bytes to this file.");
	command.addHelpText("after", footer(spec));
	command.action((...args) => {
		const self = args.at(-1);
		if (!(self instanceof Command)) throw new Error("Commander gave no command.");
		return runApiCommand(ctx, spec, self, bindings);
	});
	return command;
}
/** One command for each resource, such as `repos:branches`, with a subcommand for each method. */
function apiCommands(ctx) {
	const groups = /* @__PURE__ */ new Map();
	for (const spec of COMMANDS) {
		let group = groups.get(spec.resource);
		if (group === void 0) {
			group = new Command(spec.resource).helpGroup(API_GROUP);
			groups.set(spec.resource, group);
		}
		group.addCommand(methodCommand(ctx, spec));
	}
	for (const group of groups.values()) group.description(`Methods: ${group.commands.map((method) => method.name()).join(", ")}.`);
	return [...groups.values()];
}
const RESOURCES = new Set(COMMANDS.map((spec) => spec.resource));
function plural(word) {
	return word.split(":").map((segment) => SINGULAR[segment] ?? segment).join(":");
}
/** The index of the command word: the first argument that is not a global option or its value. */
function commandIndex(argv) {
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index] ?? "";
		if (arg === "--") return index + 1 < argv.length ? index + 1 : -1;
		if (arg === "--hostname") {
			index += 1;
			continue;
		}
		if (!arg.startsWith("-")) return index;
	}
	return -1;
}
/**
* The arguments with each singular segment of the command word in its plural form, and with
* `repos view` as `repos get`. A resource path with spaces is a usage error that names the form
* with `:`.
*/
function normalizeArgs(argv) {
	const args = [...argv];
	const index = commandIndex(args);
	const word = index === -1 ? void 0 : args[index];
	if (word === void 0) return { args };
	const resource = plural(word);
	args[index] = resource;
	const next = args[index + 1];
	if (resource === "repos" && next === "view") args[index + 1] = "get";
	if (RESOURCES.has(resource) && next !== void 0 && !next.startsWith("-")) {
		const joined = `${resource}:${plural(next)}`;
		const methods = new Set(COMMANDS.filter((spec) => spec.resource === resource).map((spec) => spec.method));
		if (RESOURCES.has(joined) && !methods.has(next)) {
			const method = args[index + 2] ?? "<method>";
			return {
				args,
				error: {
					message: `Unknown command '${word} ${next}'.`,
					hint: `The resource path is one word with ':'. Did you mean \`pierre ${joined} ${method}\`?`
				}
			};
		}
	}
	return { args };
}

// src/discovery.ts
const DEFAULT_DASHBOARD = "https://code.storage";
const TIMEOUT_MS = 15e3;
/** The dashboard origin that serves the agent discovery documents. */
function dashboardUrl(env) {
	return (envValue(env, "PIERRE_DASHBOARD_URL") ?? DEFAULT_DASHBOARD).replace(/\/+$/, "");
}
/** The documents an agent reads to find the Code Storage docs, MCP server, and auth rules. */
function discoveryUrls(base) {
	return {
		mcpCard: `${base}/.well-known/mcp.json`,
		mcpServer: `${base}/docs/mcp`,
		docsIndex: `${base}/docs/llms.txt`,
		authNote: `${base}/auth.md`
	};
}
async function fetchJson(url) {
	let response;
	try {
		response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
	} catch (error) {
		throw new CliError(`Cannot fetch ${url}: ${errorMessage(error)}`);
	}
	if (!response.ok) throw new CliError(`Cannot fetch ${url}: HTTP ${response.status}`);
	try {
		return await response.json();
	} catch {
		throw new CliError(`${url} is not JSON.`);
	}
}

// src/account/transport.ts
const CODES = /* @__PURE__ */ new Set([
	"invalid_argument",
	"unauthenticated",
	"permission_denied",
	"not_found",
	"already_exists",
	"failed_precondition",
	"resource_exhausted",
	"unavailable",
	"internal",
	"deadline_exceeded",
	"authorization_pending",
	"slow_down",
	"access_denied",
	"expired_token",
	"invalid_grant"
]);
const REASON_MESSAGES = {
	subdomain_unavailable: "The subdomain is unavailable. Choose another --subdomain and run the command again. Payment is already recorded.",
	checkout_flow_conflict: "Checkout is already open in another signup flow. Complete it there, then run this command again.",
	promotion_code_invalid: "The promotion code is not valid. Pass another --promotion-code, or run the command without it.",
	account_setup_unavailable: "CLI account setup is not available in this environment."
};
const SAFE_REASONS = /* @__PURE__ */ new Map([
	["subdomain is unavailable", "subdomain_unavailable"],
	["checkout is already open in another signup flow", "checkout_flow_conflict"],
	["promotion code is not valid", "promotion_code_invalid"],
	["CLI account setup is not available in this environment.", "account_setup_unavailable"]
]);
/** WorkOS sends a denied or expired sign-in with HTTP 400, so the code also selects exit 3. */
const CREDENTIAL_CODES = /* @__PURE__ */ new Set([
	"unauthenticated",
	"permission_denied",
	"access_denied",
	"expired_token",
	"invalid_grant"
]);
function exitCodeOf(code, status) {
	if (CREDENTIAL_CODES.has(code) || status === 401 || status === 403) return ExitCode.credential;
	if (code === "not_found" || status === 404) return ExitCode.notFound;
	return ExitCode.failure;
}
/** A rerun resumes most failures. It cannot change a missing resource or an invalid request. */
function hintOf(code, exitCode) {
	if (exitCode === ExitCode.credential) return "Run the command again to sign in. To use another account, run `pierre auth logout --account` first.";
	if (exitCode === ExitCode.notFound || code === "invalid_argument") return void 0;
	return "Run the command again to resume.";
}
var AccountError = class extends CliError {
	code;
	status;
	reason;
	retryAfter;
	constructor(code, status, reason, retryAfter) {
		const exitCode = exitCodeOf(code, status);
		super(reason ? REASON_MESSAGES[reason] : `Account request failed: ${code} (HTTP ${status}).`, exitCode, hintOf(code, exitCode));
		this.code = code;
		this.status = status;
		this.reason = reason;
		this.retryAfter = retryAfter;
	}
};
/** The dashboard publishes no CLI account settings for its environment. */
var AccountUnavailableError = class extends CliError {
	code = "account_setup_unavailable";
	constructor(dashboardUrl) {
		super(`CLI account setup is not available for ${dashboardUrl}.`, ExitCode.failure, "Create a key on the dashboard Keys page, then run `pierre auth login --hostname <host> --with-key`.");
	}
};
/** No response arrived: the network failed or the request timed out. */
var ConnectionError = class extends CliError {
	constructor() {
		super("Cannot reach the account service. Run the command again to resume.");
	}
};
/** A rate limit or a proxy failure. The same request can succeed later. */
const TRANSIENT_STATUSES = /* @__PURE__ */ new Set([
	429,
	502,
	503,
	504
]);
function isTransient(error) {
	return error instanceof ConnectionError || error instanceof AccountError && TRANSIENT_STATUSES.has(error.status);
}
function retryAfterSeconds(response) {
	const seconds = Number(response.headers.get("retry-after"));
	return Number.isInteger(seconds) && seconds > 0 ? seconds : void 0;
}
/** Keep provider bodies and transport errors out of output, including --debug. */
async function request(url, init = {}) {
	let response;
	try {
		response = await fetch(url, {
			...init,
			redirect: "error",
			signal: AbortSignal.timeout(15e3)
		});
	} catch {
		throw new ConnectionError();
	}
	let body;
	try {
		body = await response.json();
	} catch {
		if (!response.ok) throw new AccountError(response.status === 401 ? "unauthenticated" : "request_failed", response.status, void 0, retryAfterSeconds(response));
		throw new CliError(`The account service returned an invalid response (HTTP ${response.status}).`);
	}
	if (!response.ok) {
		const value = isRecord(body) ? body.error ?? body.code : void 0;
		const text = isRecord(body) ? body.message ?? body.error : void 0;
		throw new AccountError(typeof value === "string" && CODES.has(value) ? value : "request_failed", response.status, typeof text === "string" ? SAFE_REASONS.get(text) : void 0, retryAfterSeconds(response));
	}
	if (!isRecord(body)) throw new CliError("The account service returned an invalid response.");
	return body;
}
function rpc(base, method, token, body = {}) {
	return request(`${base}/${method}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Connect-Protocol-Version": "1",
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify(body)
	});
}
function oauth(base, path, body) {
	return request(`${base}/user_management/${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(body)
	});
}
function textField(value, field) {
	const text = value[field];
	if (typeof text !== "string" || !text) throw new CliError(`The account response is missing ${field}.`);
	return text;
}
const LOOPBACK_HOSTS = /* @__PURE__ */ new Set([
	"localhost",
	"127.0.0.1",
	"[::1]"
]);
/**
* Parse a URL that the CLI calls or shows to a person. It uses HTTPS and has no user name or
* password. HTTP is allowed only for a local test server.
*/
function secureURL(raw, message) {
	let url;
	try {
		url = new URL(raw);
	} catch {
		throw new CliError(message);
	}
	const local = url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
	if (url.username || url.password || url.protocol !== "https:" && !local) throw new CliError(message);
	return url;
}
/** The base URL of an account service, with no query, no fragment, and no final slash. */
function publicURL(raw) {
	const message = "The account service URL must be an HTTPS URL with no query.";
	const url = secureURL(raw, message);
	if (url.hash || url.search) throw new CliError(message);
	return url.toString().replace(/\/+$/, "");
}

// src/account/config.ts
async function settings(origin) {
	try {
		return await request(`${origin}/.well-known/pierre-cli.json`);
	} catch (error) {
		if (error instanceof AccountError && (error.status === 404 || error.reason === "account_setup_unavailable")) throw new AccountUnavailableError(origin);
		throw error;
	}
}
async function discover(env) {
	const origin = publicURL(dashboardUrl(env));
	const body = await settings(origin);
	if (body.version !== 1) throw new CliError("The account configuration version is not supported.");
	const gitHostTemplate = textField(body, "gitHostTemplate");
	const apiUrlTemplate = textField(body, "apiUrlTemplate");
	if (!gitHostTemplate.includes("{{org}}") || !apiUrlTemplate.includes("{{org}}")) throw new CliError("The account configuration needs host and API URL templates.");
	return {
		dashboardUrl: origin,
		workosClientId: textField(body, "workosClientId"),
		workosApiUrl: publicURL(textField(body, "workosApiUrl")),
		controlPlaneUrl: publicURL(textField(body, "controlPlaneUrl")),
		cloudApiUrl: publicURL(textField(body, "cloudApiUrl")),
		gitHostTemplate,
		apiUrlTemplate,
		requiredSubdomainSuffix: typeof body.requiredSubdomainSuffix === "string" ? body.requiredSubdomainSuffix : ""
	};
}
function accountFile(env) {
	return join(configPaths(env).dir, "account.yml");
}
async function loadAccount(file, environment) {
	let value;
	try {
		value = (0, import_dist.parse)(await readFile(file, "utf8"));
	} catch (error) {
		if (errorCode(error) === "ENOENT") return void 0;
		throw new CliError("Cannot read the account session. Run `pierre auth logout --account` to clear it.");
	}
	if (!isRecord(value) || value.version !== 1 || ![
		"accessToken",
		"refreshToken",
		"userId"
	].every((field) => typeof value[field] === "string" && value[field])) throw new CliError("The saved account session is invalid. Run `pierre auth logout --account` to clear it.");
	if (value.dashboardUrl !== environment.dashboardUrl || value.clientId !== environment.workosClientId) throw new CliError("The saved account session belongs to another environment. Run `pierre auth logout --account` first.");
	const state = {
		version: 1,
		dashboardUrl: textField(value, "dashboardUrl"),
		clientId: textField(value, "clientId"),
		accessToken: textField(value, "accessToken"),
		refreshToken: textField(value, "refreshToken"),
		userId: textField(value, "userId")
	};
	if (value.orgId !== void 0) state.orgId = textField(value, "orgId");
	if (value.signupSessionId !== void 0) state.signupSessionId = textField(value, "signupSessionId");
	if (value.signup !== void 0) {
		if (!isRecord(value.signup) || !isRecord(value.signup.clusterTarget)) throw new CliError("The saved signup is invalid.");
		const target = value.signup.clusterTarget;
		state.signup = {
			subdomain: textField(value.signup, "subdomain"),
			plan: textField(value.signup, "plan"),
			...typeof value.signup.promotionCode === "string" && value.signup.promotionCode ? { promotionCode: value.signup.promotionCode } : {},
			clusterTarget: {
				provider: textField(target, "provider"),
				region: textField(target, "region"),
				cluster: textField(target, "cluster")
			}
		};
	}
	if (value.key !== void 0) {
		if (!isRecord(value.key)) throw new CliError("The saved key registration is invalid.");
		state.key = {
			orgId: textField(value.key, "orgId"),
			host: textField(value.key, "host"),
			keyFile: textField(value.key, "keyFile"),
			registrationId: textField(value.key, "registrationId"),
			publicKey: textField(value.key, "publicKey")
		};
	}
	return state;
}
async function saveAccount(file, state) {
	await mkdir(dirname(file), {
		recursive: true,
		mode: 448
	});
	const pending = `${file}.${randomUUID()}.tmp`;
	try {
		await writeFile(pending, (0, import_dist.stringify)(state), {
			mode: 384,
			flag: "wx"
		});
		await rename(pending, file);
	} finally {
		await rm(pending, { force: true });
	}
}
async function hasAccount(file) {
	try {
		await access(file);
		return true;
	} catch (error) {
		if (errorCode(error) === "ENOENT") return false;
		throw error;
	}
}
/**
* Delete a pending key file that no host entry uses. The file holds a private key that nothing
* can use after its registration is abandoned. Only a file in the keys directory is deleted.
*/
async function removePendingKey(keyFile, hosts, keysDir) {
	if (dirname(keyFile) !== keysDir) return;
	if (Object.values(hosts).some((entry) => entry.keyFile === keyFile)) return;
	await rm(keyFile, { force: true });
}
/** The signup session and the pending key file of a saved account session. */
async function pendingSetup(file) {
	try {
		const value = (0, import_dist.parse)(await readFile(file, "utf8"));
		if (!isRecord(value)) return void 0;
		return {
			...typeof value.signupSessionId === "string" && value.signupSessionId ? { signupSessionId: value.signupSessionId } : {},
			...isRecord(value.key) && typeof value.key.keyFile === "string" ? { keyFile: value.key.keyFile } : {}
		};
	} catch {
		return;
	}
}
/**
* Whether the account session holds a signup session or a pending key that a rerun resumes. A
* pending key in `keyFile`, the file of a stored host key, finished its setup.
*/
async function holdsPendingSetup(file, keyFile) {
	const pending = await pendingSetup(file);
	if (!pending || pending.keyFile === keyFile) return false;
	return pending.signupSessionId !== void 0 || pending.keyFile !== void 0;
}
/** Delete the account session and its pending key file. */
async function clearAccount(env) {
	const paths = configPaths(env);
	const file = accountFile(env);
	const keyFile = (await pendingSetup(file))?.keyFile;
	await rm(file, { force: true });
	if (!keyFile) return;
	let hosts;
	try {
		hosts = await readHosts(paths.hostsFile);
	} catch {
		return;
	}
	await removePendingKey(keyFile, hosts, paths.keysDir);
}

// ../../../node_modules/.pnpm/graceful-fs@4.2.11/node_modules/graceful-fs/polyfills.js
var require_polyfills = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var constants = __require("constants");
	var origCwd = process.cwd;
	var cwd = null;
	var platform = process.env.GRACEFUL_FS_PLATFORM || process.platform;
	process.cwd = function() {
		if (!cwd) cwd = origCwd.call(process);
		return cwd;
	};
	try {
		process.cwd();
	} catch (er) {}
	if (typeof process.chdir === "function") {
		var chdir = process.chdir;
		process.chdir = function(d) {
			cwd = null;
			chdir.call(process, d);
		};
		if (Object.setPrototypeOf) Object.setPrototypeOf(process.chdir, chdir);
	}
	module.exports = patch;
	function patch(fs) {
		if (constants.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)) patchLchmod(fs);
		if (!fs.lutimes) patchLutimes(fs);
		fs.chown = chownFix(fs.chown);
		fs.fchown = chownFix(fs.fchown);
		fs.lchown = chownFix(fs.lchown);
		fs.chmod = chmodFix(fs.chmod);
		fs.fchmod = chmodFix(fs.fchmod);
		fs.lchmod = chmodFix(fs.lchmod);
		fs.chownSync = chownFixSync(fs.chownSync);
		fs.fchownSync = chownFixSync(fs.fchownSync);
		fs.lchownSync = chownFixSync(fs.lchownSync);
		fs.chmodSync = chmodFixSync(fs.chmodSync);
		fs.fchmodSync = chmodFixSync(fs.fchmodSync);
		fs.lchmodSync = chmodFixSync(fs.lchmodSync);
		fs.stat = statFix(fs.stat);
		fs.fstat = statFix(fs.fstat);
		fs.lstat = statFix(fs.lstat);
		fs.statSync = statFixSync(fs.statSync);
		fs.fstatSync = statFixSync(fs.fstatSync);
		fs.lstatSync = statFixSync(fs.lstatSync);
		if (fs.chmod && !fs.lchmod) {
			fs.lchmod = function(path, mode, cb) {
				if (cb) process.nextTick(cb);
			};
			fs.lchmodSync = function() {};
		}
		if (fs.chown && !fs.lchown) {
			fs.lchown = function(path, uid, gid, cb) {
				if (cb) process.nextTick(cb);
			};
			fs.lchownSync = function() {};
		}
		if (platform === "win32") fs.rename = typeof fs.rename !== "function" ? fs.rename : (function(fs$rename) {
			function rename(from, to, cb) {
				var start = Date.now();
				var backoff = 0;
				fs$rename(from, to, function CB(er) {
					if (er && (er.code === "EACCES" || er.code === "EPERM" || er.code === "EBUSY") && Date.now() - start < 6e4) {
						setTimeout(function() {
							fs.stat(to, function(stater, st) {
								if (stater && stater.code === "ENOENT") fs$rename(from, to, CB);
								else cb(er);
							});
						}, backoff);
						if (backoff < 100) backoff += 10;
						return;
					}
					if (cb) cb(er);
				});
			}
			if (Object.setPrototypeOf) Object.setPrototypeOf(rename, fs$rename);
			return rename;
		})(fs.rename);
		fs.read = typeof fs.read !== "function" ? fs.read : (function(fs$read) {
			function read(fd, buffer, offset, length, position, callback_) {
				var callback;
				if (callback_ && typeof callback_ === "function") {
					var eagCounter = 0;
					callback = function(er, _, __) {
						if (er && er.code === "EAGAIN" && eagCounter < 10) {
							eagCounter++;
							return fs$read.call(fs, fd, buffer, offset, length, position, callback);
						}
						callback_.apply(this, arguments);
					};
				}
				return fs$read.call(fs, fd, buffer, offset, length, position, callback);
			}
			if (Object.setPrototypeOf) Object.setPrototypeOf(read, fs$read);
			return read;
		})(fs.read);
		fs.readSync = typeof fs.readSync !== "function" ? fs.readSync : (function(fs$readSync) {
			return function(fd, buffer, offset, length, position) {
				var eagCounter = 0;
				while (true) try {
					return fs$readSync.call(fs, fd, buffer, offset, length, position);
				} catch (er) {
					if (er.code === "EAGAIN" && eagCounter < 10) {
						eagCounter++;
						continue;
					}
					throw er;
				}
			};
		})(fs.readSync);
		function patchLchmod(fs) {
			fs.lchmod = function(path, mode, callback) {
				fs.open(path, constants.O_WRONLY | constants.O_SYMLINK, mode, function(err, fd) {
					if (err) {
						if (callback) callback(err);
						return;
					}
					fs.fchmod(fd, mode, function(err) {
						fs.close(fd, function(err2) {
							if (callback) callback(err || err2);
						});
					});
				});
			};
			fs.lchmodSync = function(path, mode) {
				var fd = fs.openSync(path, constants.O_WRONLY | constants.O_SYMLINK, mode);
				var threw = true;
				var ret;
				try {
					ret = fs.fchmodSync(fd, mode);
					threw = false;
				} finally {
					if (threw) try {
						fs.closeSync(fd);
					} catch (er) {}
					else fs.closeSync(fd);
				}
				return ret;
			};
		}
		function patchLutimes(fs) {
			if (constants.hasOwnProperty("O_SYMLINK") && fs.futimes) {
				fs.lutimes = function(path, at, mt, cb) {
					fs.open(path, constants.O_SYMLINK, function(er, fd) {
						if (er) {
							if (cb) cb(er);
							return;
						}
						fs.futimes(fd, at, mt, function(er) {
							fs.close(fd, function(er2) {
								if (cb) cb(er || er2);
							});
						});
					});
				};
				fs.lutimesSync = function(path, at, mt) {
					var fd = fs.openSync(path, constants.O_SYMLINK);
					var ret;
					var threw = true;
					try {
						ret = fs.futimesSync(fd, at, mt);
						threw = false;
					} finally {
						if (threw) try {
							fs.closeSync(fd);
						} catch (er) {}
						else fs.closeSync(fd);
					}
					return ret;
				};
			} else if (fs.futimes) {
				fs.lutimes = function(_a, _b, _c, cb) {
					if (cb) process.nextTick(cb);
				};
				fs.lutimesSync = function() {};
			}
		}
		function chmodFix(orig) {
			if (!orig) return orig;
			return function(target, mode, cb) {
				return orig.call(fs, target, mode, function(er) {
					if (chownErOk(er)) er = null;
					if (cb) cb.apply(this, arguments);
				});
			};
		}
		function chmodFixSync(orig) {
			if (!orig) return orig;
			return function(target, mode) {
				try {
					return orig.call(fs, target, mode);
				} catch (er) {
					if (!chownErOk(er)) throw er;
				}
			};
		}
		function chownFix(orig) {
			if (!orig) return orig;
			return function(target, uid, gid, cb) {
				return orig.call(fs, target, uid, gid, function(er) {
					if (chownErOk(er)) er = null;
					if (cb) cb.apply(this, arguments);
				});
			};
		}
		function chownFixSync(orig) {
			if (!orig) return orig;
			return function(target, uid, gid) {
				try {
					return orig.call(fs, target, uid, gid);
				} catch (er) {
					if (!chownErOk(er)) throw er;
				}
			};
		}
		function statFix(orig) {
			if (!orig) return orig;
			return function(target, options, cb) {
				if (typeof options === "function") {
					cb = options;
					options = null;
				}
				function callback(er, stats) {
					if (stats) {
						if (stats.uid < 0) stats.uid += 4294967296;
						if (stats.gid < 0) stats.gid += 4294967296;
					}
					if (cb) cb.apply(this, arguments);
				}
				return options ? orig.call(fs, target, options, callback) : orig.call(fs, target, callback);
			};
		}
		function statFixSync(orig) {
			if (!orig) return orig;
			return function(target, options) {
				var stats = options ? orig.call(fs, target, options) : orig.call(fs, target);
				if (stats) {
					if (stats.uid < 0) stats.uid += 4294967296;
					if (stats.gid < 0) stats.gid += 4294967296;
				}
				return stats;
			};
		}
		function chownErOk(er) {
			if (!er) return true;
			if (er.code === "ENOSYS") return true;
			if (!process.getuid || process.getuid() !== 0) {
				if (er.code === "EINVAL" || er.code === "EPERM") return true;
			}
			return false;
		}
	}
}));

// ../../../node_modules/.pnpm/graceful-fs@4.2.11/node_modules/graceful-fs/legacy-streams.js
var require_legacy_streams = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Stream = __require("stream").Stream;
	module.exports = legacy;
	function legacy(fs) {
		return {
			ReadStream,
			WriteStream
		};
		function ReadStream(path, options) {
			if (!(this instanceof ReadStream)) return new ReadStream(path, options);
			Stream.call(this);
			var self = this;
			this.path = path;
			this.fd = null;
			this.readable = true;
			this.paused = false;
			this.flags = "r";
			this.mode = 438;
			this.bufferSize = 65536;
			options = options || {};
			var keys = Object.keys(options);
			for (var index = 0, length = keys.length; index < length; index++) {
				var key = keys[index];
				this[key] = options[key];
			}
			if (this.encoding) this.setEncoding(this.encoding);
			if (this.start !== void 0) {
				if ("number" !== typeof this.start) throw TypeError("start must be a Number");
				if (this.end === void 0) this.end = Infinity;
				else if ("number" !== typeof this.end) throw TypeError("end must be a Number");
				if (this.start > this.end) throw new Error("start must be <= end");
				this.pos = this.start;
			}
			if (this.fd !== null) {
				process.nextTick(function() {
					self._read();
				});
				return;
			}
			fs.open(this.path, this.flags, this.mode, function(err, fd) {
				if (err) {
					self.emit("error", err);
					self.readable = false;
					return;
				}
				self.fd = fd;
				self.emit("open", fd);
				self._read();
			});
		}
		function WriteStream(path, options) {
			if (!(this instanceof WriteStream)) return new WriteStream(path, options);
			Stream.call(this);
			this.path = path;
			this.fd = null;
			this.writable = true;
			this.flags = "w";
			this.encoding = "binary";
			this.mode = 438;
			this.bytesWritten = 0;
			options = options || {};
			var keys = Object.keys(options);
			for (var index = 0, length = keys.length; index < length; index++) {
				var key = keys[index];
				this[key] = options[key];
			}
			if (this.start !== void 0) {
				if ("number" !== typeof this.start) throw TypeError("start must be a Number");
				if (this.start < 0) throw new Error("start must be >= zero");
				this.pos = this.start;
			}
			this.busy = false;
			this._queue = [];
			if (this.fd === null) {
				this._open = fs.open;
				this._queue.push([
					this._open,
					this.path,
					this.flags,
					this.mode,
					void 0
				]);
				this.flush();
			}
		}
	}
}));

// ../../../node_modules/.pnpm/graceful-fs@4.2.11/node_modules/graceful-fs/clone.js
var require_clone = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = clone;
	var getPrototypeOf = Object.getPrototypeOf || function(obj) {
		return obj.__proto__;
	};
	function clone(obj) {
		if (obj === null || typeof obj !== "object") return obj;
		if (obj instanceof Object) var copy = { __proto__: getPrototypeOf(obj) };
		else var copy = Object.create(null);
		Object.getOwnPropertyNames(obj).forEach(function(key) {
			Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(obj, key));
		});
		return copy;
	}
}));

// ../../../node_modules/.pnpm/graceful-fs@4.2.11/node_modules/graceful-fs/graceful-fs.js
var require_graceful_fs = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs = __require("fs");
	var polyfills = require_polyfills();
	var legacy = require_legacy_streams();
	var clone = require_clone();
	var util = __require("util");
	/* istanbul ignore next - node 0.x polyfill */
	var gracefulQueue;
	var previousSymbol;
	/* istanbul ignore else - node 0.x polyfill */
	if (typeof Symbol === "function" && typeof Symbol.for === "function") {
		gracefulQueue = Symbol.for("graceful-fs.queue");
		previousSymbol = Symbol.for("graceful-fs.previous");
	} else {
		gracefulQueue = "___graceful-fs.queue";
		previousSymbol = "___graceful-fs.previous";
	}
	function noop() {}
	function publishQueue(context, queue) {
		Object.defineProperty(context, gracefulQueue, { get: function() {
			return queue;
		} });
	}
	var debug = noop;
	if (util.debuglog) debug = util.debuglog("gfs4");
	else if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) debug = function() {
		var m = util.format.apply(util, arguments);
		m = "GFS4: " + m.split(/\n/).join("\nGFS4: ");
		console.error(m);
	};
	if (!fs[gracefulQueue]) {
		publishQueue(fs, global[gracefulQueue] || []);
		fs.close = (function(fs$close) {
			function close(fd, cb) {
				return fs$close.call(fs, fd, function(err) {
					if (!err) resetQueue();
					if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
			Object.defineProperty(close, previousSymbol, { value: fs$close });
			return close;
		})(fs.close);
		fs.closeSync = (function(fs$closeSync) {
			function closeSync(fd) {
				fs$closeSync.apply(fs, arguments);
				resetQueue();
			}
			Object.defineProperty(closeSync, previousSymbol, { value: fs$closeSync });
			return closeSync;
		})(fs.closeSync);
		if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) process.on("exit", function() {
			debug(fs[gracefulQueue]);
			__require("assert").equal(fs[gracefulQueue].length, 0);
		});
	}
	if (!global[gracefulQueue]) publishQueue(global, fs[gracefulQueue]);
	module.exports = patch(clone(fs));
	if (process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !fs.__patched) {
		module.exports = patch(fs);
		fs.__patched = true;
	}
	function patch(fs) {
		polyfills(fs);
		fs.gracefulify = patch;
		fs.createReadStream = createReadStream;
		fs.createWriteStream = createWriteStream;
		var fs$readFile = fs.readFile;
		fs.readFile = readFile;
		function readFile(path, options, cb) {
			if (typeof options === "function") cb = options, options = null;
			return go$readFile(path, options, cb);
			function go$readFile(path, options, cb, startTime) {
				return fs$readFile(path, options, function(err) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$readFile,
						[
							path,
							options,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		var fs$writeFile = fs.writeFile;
		fs.writeFile = writeFile;
		function writeFile(path, data, options, cb) {
			if (typeof options === "function") cb = options, options = null;
			return go$writeFile(path, data, options, cb);
			function go$writeFile(path, data, options, cb, startTime) {
				return fs$writeFile(path, data, options, function(err) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$writeFile,
						[
							path,
							data,
							options,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		var fs$appendFile = fs.appendFile;
		if (fs$appendFile) fs.appendFile = appendFile;
		function appendFile(path, data, options, cb) {
			if (typeof options === "function") cb = options, options = null;
			return go$appendFile(path, data, options, cb);
			function go$appendFile(path, data, options, cb, startTime) {
				return fs$appendFile(path, data, options, function(err) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$appendFile,
						[
							path,
							data,
							options,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		var fs$copyFile = fs.copyFile;
		if (fs$copyFile) fs.copyFile = copyFile;
		function copyFile(src, dest, flags, cb) {
			if (typeof flags === "function") {
				cb = flags;
				flags = 0;
			}
			return go$copyFile(src, dest, flags, cb);
			function go$copyFile(src, dest, flags, cb, startTime) {
				return fs$copyFile(src, dest, flags, function(err) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$copyFile,
						[
							src,
							dest,
							flags,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		var fs$readdir = fs.readdir;
		fs.readdir = readdir;
		var noReaddirOptionVersions = /^v[0-5]\./;
		function readdir(path, options, cb) {
			if (typeof options === "function") cb = options, options = null;
			var go$readdir = noReaddirOptionVersions.test(process.version) ? function go$readdir(path, options, cb, startTime) {
				return fs$readdir(path, fs$readdirCallback(path, options, cb, startTime));
			} : function go$readdir(path, options, cb, startTime) {
				return fs$readdir(path, options, fs$readdirCallback(path, options, cb, startTime));
			};
			return go$readdir(path, options, cb);
			function fs$readdirCallback(path, options, cb, startTime) {
				return function(err, files) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$readdir,
						[
							path,
							options,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else {
						if (files && files.sort) files.sort();
						if (typeof cb === "function") cb.call(this, err, files);
					}
				};
			}
		}
		if (process.version.substr(0, 4) === "v0.8") {
			var legStreams = legacy(fs);
			ReadStream = legStreams.ReadStream;
			WriteStream = legStreams.WriteStream;
		}
		var fs$ReadStream = fs.ReadStream;
		if (fs$ReadStream) {
			ReadStream.prototype = Object.create(fs$ReadStream.prototype);
			ReadStream.prototype.open = ReadStream$open;
		}
		var fs$WriteStream = fs.WriteStream;
		if (fs$WriteStream) {
			WriteStream.prototype = Object.create(fs$WriteStream.prototype);
			WriteStream.prototype.open = WriteStream$open;
		}
		Object.defineProperty(fs, "ReadStream", {
			get: function() {
				return ReadStream;
			},
			set: function(val) {
				ReadStream = val;
			},
			enumerable: true,
			configurable: true
		});
		Object.defineProperty(fs, "WriteStream", {
			get: function() {
				return WriteStream;
			},
			set: function(val) {
				WriteStream = val;
			},
			enumerable: true,
			configurable: true
		});
		var FileReadStream = ReadStream;
		Object.defineProperty(fs, "FileReadStream", {
			get: function() {
				return FileReadStream;
			},
			set: function(val) {
				FileReadStream = val;
			},
			enumerable: true,
			configurable: true
		});
		var FileWriteStream = WriteStream;
		Object.defineProperty(fs, "FileWriteStream", {
			get: function() {
				return FileWriteStream;
			},
			set: function(val) {
				FileWriteStream = val;
			},
			enumerable: true,
			configurable: true
		});
		function ReadStream(path, options) {
			if (this instanceof ReadStream) return fs$ReadStream.apply(this, arguments), this;
			else return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
		}
		function ReadStream$open() {
			var that = this;
			open(that.path, that.flags, that.mode, function(err, fd) {
				if (err) {
					if (that.autoClose) that.destroy();
					that.emit("error", err);
				} else {
					that.fd = fd;
					that.emit("open", fd);
					that.read();
				}
			});
		}
		function WriteStream(path, options) {
			if (this instanceof WriteStream) return fs$WriteStream.apply(this, arguments), this;
			else return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
		}
		function WriteStream$open() {
			var that = this;
			open(that.path, that.flags, that.mode, function(err, fd) {
				if (err) {
					that.destroy();
					that.emit("error", err);
				} else {
					that.fd = fd;
					that.emit("open", fd);
				}
			});
		}
		function createReadStream(path, options) {
			return new fs.ReadStream(path, options);
		}
		function createWriteStream(path, options) {
			return new fs.WriteStream(path, options);
		}
		var fs$open = fs.open;
		fs.open = open;
		function open(path, flags, mode, cb) {
			if (typeof mode === "function") cb = mode, mode = null;
			return go$open(path, flags, mode, cb);
			function go$open(path, flags, mode, cb, startTime) {
				return fs$open(path, flags, mode, function(err, fd) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$open,
						[
							path,
							flags,
							mode,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		return fs;
	}
	function enqueue(elem) {
		debug("ENQUEUE", elem[0].name, elem[1]);
		fs[gracefulQueue].push(elem);
		retry();
	}
	var retryTimer;
	function resetQueue() {
		var now = Date.now();
		for (var i = 0; i < fs[gracefulQueue].length; ++i) if (fs[gracefulQueue][i].length > 2) {
			fs[gracefulQueue][i][3] = now;
			fs[gracefulQueue][i][4] = now;
		}
		retry();
	}
	function retry() {
		clearTimeout(retryTimer);
		retryTimer = void 0;
		if (fs[gracefulQueue].length === 0) return;
		var elem = fs[gracefulQueue].shift();
		var fn = elem[0];
		var args = elem[1];
		var err = elem[2];
		var startTime = elem[3];
		var lastTime = elem[4];
		if (startTime === void 0) {
			debug("RETRY", fn.name, args);
			fn.apply(null, args);
		} else if (Date.now() - startTime >= 6e4) {
			debug("TIMEOUT", fn.name, args);
			var cb = args.pop();
			if (typeof cb === "function") cb.call(null, err);
		} else {
			var sinceAttempt = Date.now() - lastTime;
			var sinceStart = Math.max(lastTime - startTime, 1);
			if (sinceAttempt >= Math.min(sinceStart * 1.2, 100)) {
				debug("RETRY", fn.name, args);
				fn.apply(null, args.concat([startTime]));
			} else fs[gracefulQueue].push(elem);
		}
		if (retryTimer === void 0) retryTimer = setTimeout(retry, 0);
	}
}));

// ../../../node_modules/.pnpm/retry@0.12.0/node_modules/retry/lib/retry_operation.js
var require_retry_operation = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function RetryOperation(timeouts, options) {
		if (typeof options === "boolean") options = { forever: options };
		this._originalTimeouts = JSON.parse(JSON.stringify(timeouts));
		this._timeouts = timeouts;
		this._options = options || {};
		this._maxRetryTime = options && options.maxRetryTime || Infinity;
		this._fn = null;
		this._errors = [];
		this._attempts = 1;
		this._operationTimeout = null;
		this._operationTimeoutCb = null;
		this._timeout = null;
		this._operationStart = null;
		if (this._options.forever) this._cachedTimeouts = this._timeouts.slice(0);
	}
	module.exports = RetryOperation;
	RetryOperation.prototype.reset = function() {
		this._attempts = 1;
		this._timeouts = this._originalTimeouts;
	};
	RetryOperation.prototype.stop = function() {
		if (this._timeout) clearTimeout(this._timeout);
		this._timeouts = [];
		this._cachedTimeouts = null;
	};
	RetryOperation.prototype.retry = function(err) {
		if (this._timeout) clearTimeout(this._timeout);
		if (!err) return false;
		var currentTime = (/* @__PURE__ */ new Date()).getTime();
		if (err && currentTime - this._operationStart >= this._maxRetryTime) {
			this._errors.unshift(/* @__PURE__ */ new Error("RetryOperation timeout occurred"));
			return false;
		}
		this._errors.push(err);
		var timeout = this._timeouts.shift();
		if (timeout === void 0) {
			if (this._cachedTimeouts) {
				this._errors.splice(this._errors.length - 1, this._errors.length);
				this._timeouts = this._cachedTimeouts.slice(0);
				timeout = this._timeouts.shift();
			} else return false;
		}
		var self = this;
		var timer = setTimeout(function() {
			self._attempts++;
			if (self._operationTimeoutCb) {
				self._timeout = setTimeout(function() {
					self._operationTimeoutCb(self._attempts);
				}, self._operationTimeout);
				if (self._options.unref) self._timeout.unref();
			}
			self._fn(self._attempts);
		}, timeout);
		if (this._options.unref) timer.unref();
		return true;
	};
	RetryOperation.prototype.attempt = function(fn, timeoutOps) {
		this._fn = fn;
		if (timeoutOps) {
			if (timeoutOps.timeout) this._operationTimeout = timeoutOps.timeout;
			if (timeoutOps.cb) this._operationTimeoutCb = timeoutOps.cb;
		}
		var self = this;
		if (this._operationTimeoutCb) this._timeout = setTimeout(function() {
			self._operationTimeoutCb();
		}, self._operationTimeout);
		this._operationStart = (/* @__PURE__ */ new Date()).getTime();
		this._fn(this._attempts);
	};
	RetryOperation.prototype.try = function(fn) {
		console.log("Using RetryOperation.try() is deprecated");
		this.attempt(fn);
	};
	RetryOperation.prototype.start = function(fn) {
		console.log("Using RetryOperation.start() is deprecated");
		this.attempt(fn);
	};
	RetryOperation.prototype.start = RetryOperation.prototype.try;
	RetryOperation.prototype.errors = function() {
		return this._errors;
	};
	RetryOperation.prototype.attempts = function() {
		return this._attempts;
	};
	RetryOperation.prototype.mainError = function() {
		if (this._errors.length === 0) return null;
		var counts = {};
		var mainError = null;
		var mainErrorCount = 0;
		for (var i = 0; i < this._errors.length; i++) {
			var error = this._errors[i];
			var message = error.message;
			var count = (counts[message] || 0) + 1;
			counts[message] = count;
			if (count >= mainErrorCount) {
				mainError = error;
				mainErrorCount = count;
			}
		}
		return mainError;
	};
}));

// ../../../node_modules/.pnpm/retry@0.12.0/node_modules/retry/lib/retry.js
var require_retry$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var RetryOperation = require_retry_operation();
	exports.operation = function(options) {
		return new RetryOperation(exports.timeouts(options), {
			forever: options && options.forever,
			unref: options && options.unref,
			maxRetryTime: options && options.maxRetryTime
		});
	};
	exports.timeouts = function(options) {
		if (options instanceof Array) return [].concat(options);
		var opts = {
			retries: 10,
			factor: 2,
			minTimeout: 1e3,
			maxTimeout: Infinity,
			randomize: false
		};
		for (var key in options) opts[key] = options[key];
		if (opts.minTimeout > opts.maxTimeout) throw new Error("minTimeout is greater than maxTimeout");
		var timeouts = [];
		for (var i = 0; i < opts.retries; i++) timeouts.push(this.createTimeout(i, opts));
		if (options && options.forever && !timeouts.length) timeouts.push(this.createTimeout(i, opts));
		timeouts.sort(function(a, b) {
			return a - b;
		});
		return timeouts;
	};
	exports.createTimeout = function(attempt, opts) {
		var random = opts.randomize ? Math.random() + 1 : 1;
		var timeout = Math.round(random * opts.minTimeout * Math.pow(opts.factor, attempt));
		timeout = Math.min(timeout, opts.maxTimeout);
		return timeout;
	};
	exports.wrap = function(obj, options, methods) {
		if (options instanceof Array) {
			methods = options;
			options = null;
		}
		if (!methods) {
			methods = [];
			for (var key in obj) if (typeof obj[key] === "function") methods.push(key);
		}
		for (var i = 0; i < methods.length; i++) {
			var method = methods[i];
			var original = obj[method];
			obj[method] = function retryWrapper(original) {
				var op = exports.operation(options);
				var args = Array.prototype.slice.call(arguments, 1);
				var callback = args.pop();
				args.push(function(err) {
					if (op.retry(err)) return;
					if (err) arguments[0] = op.mainError();
					callback.apply(this, arguments);
				});
				op.attempt(function() {
					original.apply(obj, args);
				});
			}.bind(obj, original);
			obj[method].options = options;
		}
	};
}));

// ../../../node_modules/.pnpm/retry@0.12.0/node_modules/retry/index.js
var require_retry = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_retry$1();
}));

// ../../../node_modules/.pnpm/signal-exit@3.0.7/node_modules/signal-exit/signals.js
var require_signals = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = [
		"SIGABRT",
		"SIGALRM",
		"SIGHUP",
		"SIGINT",
		"SIGTERM"
	];
	if (process.platform !== "win32") module.exports.push("SIGVTALRM", "SIGXCPU", "SIGXFSZ", "SIGUSR2", "SIGTRAP", "SIGSYS", "SIGQUIT", "SIGIOT");
	if (process.platform === "linux") module.exports.push("SIGIO", "SIGPOLL", "SIGPWR", "SIGSTKFLT", "SIGUNUSED");
}));

// ../../../node_modules/.pnpm/signal-exit@3.0.7/node_modules/signal-exit/index.js
var require_signal_exit = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var process = global.process;
	const processOk = function(process) {
		return process && typeof process === "object" && typeof process.removeListener === "function" && typeof process.emit === "function" && typeof process.reallyExit === "function" && typeof process.listeners === "function" && typeof process.kill === "function" && typeof process.pid === "number" && typeof process.on === "function";
	};
	/* istanbul ignore if */
	if (!processOk(process)) module.exports = function() {
		return function() {};
	};
	else {
		var assert = __require("assert");
		var signals = require_signals();
		var isWin = /^win/i.test(process.platform);
		var EE = __require("events");
		/* istanbul ignore if */
		if (typeof EE !== "function") EE = EE.EventEmitter;
		var emitter;
		if (process.__signal_exit_emitter__) emitter = process.__signal_exit_emitter__;
		else {
			emitter = process.__signal_exit_emitter__ = new EE();
			emitter.count = 0;
			emitter.emitted = {};
		}
		if (!emitter.infinite) {
			emitter.setMaxListeners(Infinity);
			emitter.infinite = true;
		}
		module.exports = function(cb, opts) {
			/* istanbul ignore if */
			if (!processOk(global.process)) return function() {};
			assert.equal(typeof cb, "function", "a callback must be provided for exit handler");
			if (loaded === false) load();
			var ev = "exit";
			if (opts && opts.alwaysLast) ev = "afterexit";
			var remove = function() {
				emitter.removeListener(ev, cb);
				if (emitter.listeners("exit").length === 0 && emitter.listeners("afterexit").length === 0) unload();
			};
			emitter.on(ev, cb);
			return remove;
		};
		var unload = function unload() {
			if (!loaded || !processOk(global.process)) return;
			loaded = false;
			signals.forEach(function(sig) {
				try {
					process.removeListener(sig, sigListeners[sig]);
				} catch (er) {}
			});
			process.emit = originalProcessEmit;
			process.reallyExit = originalProcessReallyExit;
			emitter.count -= 1;
		};
		module.exports.unload = unload;
		var emit = function emit(event, code, signal) {
			/* istanbul ignore if */
			if (emitter.emitted[event]) return;
			emitter.emitted[event] = true;
			emitter.emit(event, code, signal);
		};
		var sigListeners = {};
		signals.forEach(function(sig) {
			sigListeners[sig] = function listener() {
				/* istanbul ignore if */
				if (!processOk(global.process)) return;
				if (process.listeners(sig).length === emitter.count) {
					unload();
					emit("exit", null, sig);
					/* istanbul ignore next */
					emit("afterexit", null, sig);
					/* istanbul ignore next */
					if (isWin && sig === "SIGHUP") sig = "SIGINT";
					/* istanbul ignore next */
					process.kill(process.pid, sig);
				}
			};
		});
		module.exports.signals = function() {
			return signals;
		};
		var loaded = false;
		var load = function load() {
			if (loaded || !processOk(global.process)) return;
			loaded = true;
			emitter.count += 1;
			signals = signals.filter(function(sig) {
				try {
					process.on(sig, sigListeners[sig]);
					return true;
				} catch (er) {
					return false;
				}
			});
			process.emit = processEmit;
			process.reallyExit = processReallyExit;
		};
		module.exports.load = load;
		var originalProcessReallyExit = process.reallyExit;
		var processReallyExit = function processReallyExit(code) {
			/* istanbul ignore if */
			if (!processOk(global.process)) return;
			process.exitCode = code || /* istanbul ignore next */ 0;
			emit("exit", process.exitCode, null);
			/* istanbul ignore next */
			emit("afterexit", process.exitCode, null);
			/* istanbul ignore next */
			originalProcessReallyExit.call(process, process.exitCode);
		};
		var originalProcessEmit = process.emit;
		var processEmit = function processEmit(ev, arg) {
			if (ev === "exit" && processOk(global.process)) {
				/* istanbul ignore else */
				if (arg !== void 0) process.exitCode = arg;
				var ret = originalProcessEmit.apply(this, arguments);
				/* istanbul ignore next */
				emit("exit", process.exitCode, null);
				/* istanbul ignore next */
				emit("afterexit", process.exitCode, null);
				/* istanbul ignore next */
				return ret;
			} else return originalProcessEmit.apply(this, arguments);
		};
	}
}));

// ../../../node_modules/.pnpm/proper-lockfile@4.1.2/node_modules/proper-lockfile/lib/mtime-precision.js
var require_mtime_precision = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const cacheSymbol = Symbol();
	function probe(file, fs, callback) {
		const cachedPrecision = fs[cacheSymbol];
		if (cachedPrecision) return fs.stat(file, (err, stat) => {
			/* istanbul ignore if */
			if (err) return callback(err);
			callback(null, stat.mtime, cachedPrecision);
		});
		const mtime = /* @__PURE__ */ new Date(Math.ceil(Date.now() / 1e3) * 1e3 + 5);
		fs.utimes(file, mtime, mtime, (err) => {
			/* istanbul ignore if */
			if (err) return callback(err);
			fs.stat(file, (err, stat) => {
				/* istanbul ignore if */
				if (err) return callback(err);
				const precision = stat.mtime.getTime() % 1e3 === 0 ? "s" : "ms";
				Object.defineProperty(fs, cacheSymbol, { value: precision });
				callback(null, stat.mtime, precision);
			});
		});
	}
	function getMtime(precision) {
		let now = Date.now();
		if (precision === "s") now = Math.ceil(now / 1e3) * 1e3;
		return new Date(now);
	}
	module.exports.probe = probe;
	module.exports.getMtime = getMtime;
}));

// ../../../node_modules/.pnpm/proper-lockfile@4.1.2/node_modules/proper-lockfile/lib/lockfile.js
var require_lockfile = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const path = __require("path");
	const fs = require_graceful_fs();
	const retry = require_retry();
	const onExit = require_signal_exit();
	const mtimePrecision = require_mtime_precision();
	const locks = {};
	function getLockFile(file, options) {
		return options.lockfilePath || `${file}.lock`;
	}
	function resolveCanonicalPath(file, options, callback) {
		if (!options.realpath) return callback(null, path.resolve(file));
		options.fs.realpath(file, callback);
	}
	function acquireLock(file, options, callback) {
		const lockfilePath = getLockFile(file, options);
		options.fs.mkdir(lockfilePath, (err) => {
			if (!err) return mtimePrecision.probe(lockfilePath, options.fs, (err, mtime, mtimePrecision) => {
				/* istanbul ignore if */
				if (err) {
					options.fs.rmdir(lockfilePath, () => {});
					return callback(err);
				}
				callback(null, mtime, mtimePrecision);
			});
			if (err.code !== "EEXIST") return callback(err);
			if (options.stale <= 0) return callback(Object.assign(/* @__PURE__ */ new Error("Lock file is already being held"), {
				code: "ELOCKED",
				file
			}));
			options.fs.stat(lockfilePath, (err, stat) => {
				if (err) {
					if (err.code === "ENOENT") return acquireLock(file, {
						...options,
						stale: 0
					}, callback);
					return callback(err);
				}
				if (!isLockStale(stat, options)) return callback(Object.assign(/* @__PURE__ */ new Error("Lock file is already being held"), {
					code: "ELOCKED",
					file
				}));
				removeLock(file, options, (err) => {
					if (err) return callback(err);
					acquireLock(file, {
						...options,
						stale: 0
					}, callback);
				});
			});
		});
	}
	function isLockStale(stat, options) {
		return stat.mtime.getTime() < Date.now() - options.stale;
	}
	function removeLock(file, options, callback) {
		options.fs.rmdir(getLockFile(file, options), (err) => {
			if (err && err.code !== "ENOENT") return callback(err);
			callback();
		});
	}
	function updateLock(file, options) {
		const lock = locks[file];
		/* istanbul ignore if */
		if (lock.updateTimeout) return;
		lock.updateDelay = lock.updateDelay || options.update;
		lock.updateTimeout = setTimeout(() => {
			lock.updateTimeout = null;
			options.fs.stat(lock.lockfilePath, (err, stat) => {
				const isOverThreshold = lock.lastUpdate + options.stale < Date.now();
				if (err) {
					if (err.code === "ENOENT" || isOverThreshold) return setLockAsCompromised(file, lock, Object.assign(err, { code: "ECOMPROMISED" }));
					lock.updateDelay = 1e3;
					return updateLock(file, options);
				}
				if (!(lock.mtime.getTime() === stat.mtime.getTime())) return setLockAsCompromised(file, lock, Object.assign(/* @__PURE__ */ new Error("Unable to update lock within the stale threshold"), { code: "ECOMPROMISED" }));
				const mtime = mtimePrecision.getMtime(lock.mtimePrecision);
				options.fs.utimes(lock.lockfilePath, mtime, mtime, (err) => {
					const isOverThreshold = lock.lastUpdate + options.stale < Date.now();
					if (lock.released) return;
					if (err) {
						if (err.code === "ENOENT" || isOverThreshold) return setLockAsCompromised(file, lock, Object.assign(err, { code: "ECOMPROMISED" }));
						lock.updateDelay = 1e3;
						return updateLock(file, options);
					}
					lock.mtime = mtime;
					lock.lastUpdate = Date.now();
					lock.updateDelay = null;
					updateLock(file, options);
				});
			});
		}, lock.updateDelay);
		/* istanbul ignore else */
		if (lock.updateTimeout.unref) lock.updateTimeout.unref();
	}
	function setLockAsCompromised(file, lock, err) {
		lock.released = true;
		/* istanbul ignore if */
		if (lock.updateTimeout) clearTimeout(lock.updateTimeout);
		if (locks[file] === lock) delete locks[file];
		lock.options.onCompromised(err);
	}
	function lock(file, options, callback) {
		/* istanbul ignore next */
		options = {
			stale: 1e4,
			update: null,
			realpath: true,
			retries: 0,
			fs,
			onCompromised: (err) => {
				throw err;
			},
			...options
		};
		options.retries = options.retries || 0;
		options.retries = typeof options.retries === "number" ? { retries: options.retries } : options.retries;
		options.stale = Math.max(options.stale || 0, 2e3);
		options.update = options.update == null ? options.stale / 2 : options.update || 0;
		options.update = Math.max(Math.min(options.update, options.stale / 2), 1e3);
		resolveCanonicalPath(file, options, (err, file) => {
			if (err) return callback(err);
			const operation = retry.operation(options.retries);
			operation.attempt(() => {
				acquireLock(file, options, (err, mtime, mtimePrecision) => {
					if (operation.retry(err)) return;
					if (err) return callback(operation.mainError());
					const lock = locks[file] = {
						lockfilePath: getLockFile(file, options),
						mtime,
						mtimePrecision,
						options,
						lastUpdate: Date.now()
					};
					updateLock(file, options);
					callback(null, (releasedCallback) => {
						if (lock.released) return releasedCallback && releasedCallback(Object.assign(/* @__PURE__ */ new Error("Lock is already released"), { code: "ERELEASED" }));
						unlock(file, {
							...options,
							realpath: false
						}, releasedCallback);
					});
				});
			});
		});
	}
	function unlock(file, options, callback) {
		options = {
			fs,
			realpath: true,
			...options
		};
		resolveCanonicalPath(file, options, (err, file) => {
			if (err) return callback(err);
			const lock = locks[file];
			if (!lock) return callback(Object.assign(/* @__PURE__ */ new Error("Lock is not acquired/owned by you"), { code: "ENOTACQUIRED" }));
			lock.updateTimeout && clearTimeout(lock.updateTimeout);
			lock.released = true;
			delete locks[file];
			removeLock(file, options, callback);
		});
	}
	function check(file, options, callback) {
		options = {
			stale: 1e4,
			realpath: true,
			fs,
			...options
		};
		options.stale = Math.max(options.stale || 0, 2e3);
		resolveCanonicalPath(file, options, (err, file) => {
			if (err) return callback(err);
			options.fs.stat(getLockFile(file, options), (err, stat) => {
				if (err) return err.code === "ENOENT" ? callback(null, false) : callback(err);
				return callback(null, !isLockStale(stat, options));
			});
		});
	}
	function getLocks() {
		return locks;
	}
	/* istanbul ignore next */
	onExit(() => {
		for (const file in locks) {
			const options = locks[file].options;
			try {
				options.fs.rmdirSync(getLockFile(file, options));
			} catch (e) {}
		}
	});
	module.exports.lock = lock;
	module.exports.unlock = unlock;
	module.exports.check = check;
	module.exports.getLocks = getLocks;
}));

// ../../../node_modules/.pnpm/proper-lockfile@4.1.2/node_modules/proper-lockfile/lib/adapter.js
var require_adapter = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const fs = require_graceful_fs();
	function createSyncFs(fs) {
		const methods = [
			"mkdir",
			"realpath",
			"stat",
			"rmdir",
			"utimes"
		];
		const newFs = { ...fs };
		methods.forEach((method) => {
			newFs[method] = (...args) => {
				const callback = args.pop();
				let ret;
				try {
					ret = fs[`${method}Sync`](...args);
				} catch (err) {
					return callback(err);
				}
				callback(null, ret);
			};
		});
		return newFs;
	}
	function toPromise(method) {
		return (...args) => new Promise((resolve, reject) => {
			args.push((err, result) => {
				if (err) reject(err);
				else resolve(result);
			});
			method(...args);
		});
	}
	function toSync(method) {
		return (...args) => {
			let err;
			let result;
			args.push((_err, _result) => {
				err = _err;
				result = _result;
			});
			method(...args);
			if (err) throw err;
			return result;
		};
	}
	function toSyncOptions(options) {
		options = { ...options };
		options.fs = createSyncFs(options.fs || fs);
		if (typeof options.retries === "number" && options.retries > 0 || options.retries && typeof options.retries.retries === "number" && options.retries.retries > 0) throw Object.assign(/* @__PURE__ */ new Error("Cannot use retries with the sync api"), { code: "ESYNC" });
		return options;
	}
	module.exports = {
		toPromise,
		toSync,
		toSyncOptions
	};
}));

// ../../../node_modules/.pnpm/proper-lockfile@4.1.2/node_modules/proper-lockfile/index.js
var require_proper_lockfile = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const lockfile = require_lockfile();
	const { toPromise, toSync, toSyncOptions } = require_adapter();
	async function lock(file, options) {
		const release = await toPromise(lockfile.lock)(file, options);
		return toPromise(release);
	}
	function lockSync(file, options) {
		const release = toSync(lockfile.lock)(file, toSyncOptions(options));
		return toSync(release);
	}
	function unlock(file, options) {
		return toPromise(lockfile.unlock)(file, options);
	}
	function unlockSync(file, options) {
		return toSync(lockfile.unlock)(file, toSyncOptions(options));
	}
	function check(file, options) {
		return toPromise(lockfile.check)(file, options);
	}
	function checkSync(file, options) {
		return toSync(lockfile.check)(file, toSyncOptions(options));
	}
	module.exports = lock;
	module.exports.lock = lock;
	module.exports.unlock = unlock;
	module.exports.lockSync = lockSync;
	module.exports.unlockSync = unlockSync;
	module.exports.check = check;
	module.exports.checkSync = checkSync;
}));

// src/account/lock.ts
var import_proper_lockfile = /* @__PURE__ */ __toESM(require_proper_lockfile(), 1);
var AccountSetupInProgressError = class extends CliError {
	code = "account_setup_in_progress";
	constructor() {
		const message = "Another account setup command is active.";
		super(message, ExitCode.failure, "Wait for the other command to finish. If it stopped, try again in 10 seconds.", {
			code: "account_setup_in_progress",
			message
		});
	}
};
/** Keep one writer for the session, host entries, and Git settings of a configuration directory. */
async function acquireAccountLock(env) {
	const { dir } = configPaths(env);
	const created = await mkdir(dir, {
		recursive: true,
		mode: 448
	});
	const removeEmptyDirectory = async () => {
		if (created) await rmdir(dir).catch(() => void 0);
	};
	try {
		const release = await import_proper_lockfile.default.lock(join(dir, "account.yml"), {
			realpath: false,
			stale: 1e4,
			update: 1e3
		});
		return async () => {
			await release();
			await removeEmptyDirectory();
		};
	} catch (error) {
		await removeEmptyDirectory();
		if (errorCode(error) === "ELOCKED") throw new AccountSetupInProgressError();
		throw new CliError("Cannot lock the account configuration.");
	}
}
async function withAccountLock(env, action) {
	const release = await acquireAccountLock(env);
	try {
		return await action();
	} finally {
		await release().catch(() => void 0);
	}
}

// src/duration.ts
const UNITS = {
	s: 1,
	m: 60,
	h: 3600,
	d: 86400,
	w: 604800
};
/** Parse a duration such as 30d, 1h, 15m, 900s, or 900 into seconds. */
function parseDuration(text, name) {
	const match = /^(\d+)([smhdw])?$/.exec(text.trim());
	const seconds = match ? Number(match[1]) * UNITS[match[2] ?? "s"] : 0;
	if (seconds <= 0) throw usageError(`${name} needs a duration such as 30d, 1h, 15m, or 900s.`);
	return seconds;
}

// src/helper.ts
/** Parse the key=value description that Git writes to a helper. It ends at the first empty line. */
function parseCredentialInput(text) {
	const input = {};
	for (const raw of text.split("\n")) {
		const line = raw.replace(/\r$/, "");
		if (line === "") break;
		const separator = line.indexOf("=");
		if (separator <= 0) continue;
		const key = line.slice(0, separator);
		if (key === "protocol" || key === "host" || key === "path") input[key] = line.slice(separator + 1);
	}
	return input;
}
const HELPER_ARGS = ["auth", "git-credential"];
const READ_ONLY_FLAG = "--read-only";
/** The Git setting that runs this pierre as the helper. Absolute paths, so a Git GUI finds it. */
function helperCommand(self, readOnly) {
	return `!${[
		...self,
		...HELPER_ARGS,
		...readOnly ? [READ_ONLY_FLAG] : []
	].map(shellQuote).join(" ")}`;
}
function isPierreHelper(value) {
	return value.startsWith("!") && value.includes(` ${HELPER_ARGS.join(" ")}`);
}
function isReadOnlyHelper(value) {
	return isPierreHelper(value) && value.endsWith(` ${READ_ONLY_FLAG}`);
}
function helperKeys(host) {
	const url = `https://${host}`;
	return {
		helper: `credential.${url}.helper`,
		useHttpPath: `credential.${url}.useHttpPath`
	};
}
async function readHelperConfig(scope, host, options) {
	const keys = helperKeys(host);
	const entries = await gitOptional([
		"config",
		`--${scope}`,
		"--get-all",
		keys.helper
	], options);
	const useHttpPath = await gitConfigGet(scope, keys.useHttpPath, options);
	return {
		helper: entries?.split("\n").find(isPierreHelper),
		useHttpPath: useHttpPath === void 0 ? void 0 : useHttpPath === "true"
	};
}
/**
* Write the helper settings for a host. The blank first entry stops Git from
* asking another helper, such as a keychain, for this host.
*/
async function installHelper(scope, host, command, options) {
	const keys = helperKeys(host);
	await git([
		"config",
		`--${scope}`,
		"--replace-all",
		keys.helper,
		""
	], options);
	await git([
		"config",
		`--${scope}`,
		"--add",
		keys.helper,
		command
	], options);
	await git([
		"config",
		`--${scope}`,
		keys.useHttpPath,
		"true"
	], options);
}
async function uninstallHelper(scope, host, options) {
	const keys = helperKeys(host);
	await gitOptional([
		"config",
		`--${scope}`,
		"--unset-all",
		keys.helper
	], options);
	await gitOptional([
		"config",
		`--${scope}`,
		"--unset",
		keys.useHttpPath
	], options);
}

// src/commands/auth-git.ts
function setupGitCommand(ctx) {
	return new Command("setup-git").description("Configure Git to get its credential for a host from pierre.").option("--local", "Write the settings of the current repository instead of the global ones.").option("--read-only", "Mint git:read only, so this machine cannot push.").option("--uninstall", "Remove the settings that setup-git wrote.").action((options, command) => withAccountLock(ctx.env, () => setupGit(createSession(ctx, command), options)));
}
/** Package runners that start a CLI from a cache, which can change or expire. */
const RUNNER_CACHES = [{
	name: "npx",
	segment: "/_npx/"
}, {
	name: "pnpm dlx",
	segment: "/dlx/"
}];
async function setupGit(session, options) {
	const { env, cwd, self } = session.ctx;
	const gitOptions = {
		cwd,
		env
	};
	const scope = options.local ? "local" : "global";
	if (scope === "local" && await gitTopLevel(gitOptions) === void 0) throw usageError("--local needs the current directory to be inside a Git repository.");
	const { host } = await selectHost(session, await readHosts(configPaths(env).hostsFile));
	const keys = helperKeys(host);
	if (options.uninstall) {
		await uninstallHelper(scope, host, gitOptions);
		session.info(`Removed the Git credential settings for https://${host} (${scope}).`);
		return;
	}
	const command = helperCommand(self, options.readOnly === true);
	const current = await readHelperConfig(scope, host, gitOptions);
	if (current.helper === command && current.useHttpPath === true) {
		session.info(`Git already gets its credential for https://${host} from pierre (${scope}).`);
		return;
	}
	await installHelper(scope, host, command, gitOptions);
	const mode = options.readOnly ? ", read-only" : "";
	session.info(`Git now gets its credential for https://${host} from pierre (${scope}${mode}).`);
	session.info(`  ${keys.helper} = ${command}`);
	session.info(`  ${keys.useHttpPath} = true`);
	const cache = RUNNER_CACHES.find(({ segment }) => self.some((word) => word.includes(segment)));
	if (cache) session.ctx.stderr.write(`pierre: the helper path is inside the ${cache.name} cache. Install @pierre/cli globally for a stable path.\n`);
}
function gitCredentialCommand(ctx) {
	return new Command("git-credential").description("The Git credential helper. Git calls it. Do not call it by hand.").argument("<operation>", "get, store, or erase").option("--read-only", "Mint git:read only.").action((operation, options, command) => gitCredential(createSession(ctx, command), operation, options));
}
/**
* Mint one token for one Git operation. On any failure print quit=true, so Git
* never falls through to a password prompt, and one line to stderr.
*/
async function gitCredential(session, operation, options) {
	const { ctx } = session;
	const description = await readAll(ctx.stdin);
	if (operation !== "get") {
		session.debug(`ignoring '${operation}': only 'get' mints a credential`);
		return;
	}
	try {
		const token = await mintForGit(session, parseCredentialInput(description), options);
		ctx.stdout.write(`username=t\npassword=${token}\n\n`);
		session.debug("token minted");
	} catch (error) {
		ctx.stdout.write("quit=true\n\n");
		const failure = toCliError(error);
		const hint = failure.hint ? ` ${failure.hint}` : "";
		throw new CliError(`credential helper: ${failure.message}${hint}`, failure.exitCode);
	}
}
async function mintForGit(session, input, options) {
	const { env } = session.ctx;
	if (!input.host) throw new CliError("the credential description has no host.");
	if (input.protocol !== "https") throw new CliError("the remote must use https.");
	if (input.path === void 0) throw new CliError(`Git sent no path. Set credential.https://${input.host}.useHttpPath to true, or run \`pierre auth setup-git\`.`);
	const repo = repoFromPath(input.path);
	if (!repo) throw new CliError(`cannot derive a repository from the path ${input.path}.`);
	const hosts = await readHosts(configPaths(env).hostsFile);
	const credential = await resolveCredential(env, {
		host: input.host,
		entry: hosts[input.host]
	});
	const scopes = options.readOnly ? READ_ONLY_SCOPES : DEFAULT_SCOPES;
	const ttl = tokenTtl(env);
	const source = authSource(credential.auth);
	if (credential.auth.kind === "token") {
		session.debug(`sending the token from ${source} for ${repo} on ${input.host}`);
		return credential.auth.token;
	}
	session.debug(`minting ${scopes.join(",")} for ${repo} on ${input.host} (org ${credential.org}, key from ${source}, ttl ${ttl}s)`);
	return signToken(createClient(credential), {
		repo,
		scopes,
		ttl
	});
}

// src/commands/auth.ts
function authCommand(ctx) {
	const auth = new Command("auth").description("Manage the credential for a Code Storage host.");
	auth.addCommand(loginCommand(ctx));
	auth.addCommand(statusCommand(ctx));
	auth.addCommand(logoutCommand(ctx));
	auth.addCommand(tokenCommand(ctx));
	auth.addCommand(setupGitCommand(ctx));
	auth.addCommand(gitCredentialCommand(ctx), { hidden: true });
	return auth;
}
function loginCommand(ctx) {
	return new Command("login").description("Store a private key for a Code Storage host.").option("--api-url <url>", "The REST API URL, including http:// or https://. Derived for <org>.code.storage hosts.").option("--from-file <path>", "Read the key from a file.").option("--no-verify", "Do not check the key against the organization.").option("--org <org>", "The organization that owns the key (JWT issuer). Derived for <org>.code.storage hosts.").option("--with-key", "Store a private key that the dashboard created. Read it from stdin, --from-file, or a paste.").action((options, command) => withAccountLock(ctx.env, () => login(createSession(ctx, command), options)));
}
async function login(session, options) {
	if (!options.withKey) throw usageError("Interactive sign-in is not available yet. Pass --with-key.", "Create a key on the dashboard, then run `pierre auth login --hostname <host> --with-key < key.pem`.");
	const { env } = session.ctx;
	const hostInput = session.options.hostname ?? envValue(env, "PIERRE_GIT_HOST") ?? (options.org ? defaultHost(options.org.trim()) : void 0);
	if (!hostInput) throw usageError("Pass --hostname <host>.", "For example: `pierre auth login --hostname acme.code.storage --with-key < key.pem`");
	const host = normalizeHost(hostInput);
	const subdomain = orgFromHost(host);
	const org = options.org?.trim() || subdomain;
	const apiUrl = options.apiUrl ? normalizeApiUrl(options.apiUrl) : subdomain ? defaultApiUrl(subdomain) : void 0;
	if (!org || !apiUrl) throw usageError(`${host} is outside the <org>.code.storage shape. Pass --org <org> and --api-url <url>.`);
	const key = parsePrivateKey(await readPem(session, options.fromFile));
	const keyFile = configPaths(env).keyFile(host);
	await storeKey(env, {
		host,
		org,
		apiUrl,
		auth: {
			kind: "key",
			key: key.pem,
			keyId: key.keyId,
			source: {
				kind: "file",
				path: keyFile
			}
		}
	}, { verify: options.verify });
	if (session.options.json) {
		session.json({
			host,
			org,
			apiUrl,
			keyFile,
			keyId: key.keyId,
			verified: options.verify
		});
		return;
	}
	session.info(`Logged in to ${host}.`);
	session.info(`  Organization: ${org}`);
	session.info(`  Key file: ${keyFile}`);
	session.info(`  Key ID: ${key.keyId}`);
	session.info(`  Live check: ${options.verify ? "ok" : "skipped"}`);
}
async function readPem(session, fromFile) {
	if (fromFile) try {
		return await readFile(fromFile, "utf8");
	} catch (error) {
		throw usageError(`Cannot read ${fromFile}: ${errorMessage(error)}`);
	}
	if (!session.ctx.stdin.isTTY) return readAll(session.ctx.stdin);
	return readPastedPem(session);
}
/**
* Store the key file and the host entry of a credential. With `verify`, the live check runs first,
* so the CLI stores no key that the organization refuses.
*/
async function storeKey(env, credential, options) {
	if (options.verify) await liveCheck(credential);
	const { host, org, apiUrl } = credential;
	const keyFile = credential.auth.source.path;
	await writeKeyFile(keyFile, credential.auth.key);
	const { hostsFile } = configPaths(env);
	const hosts = await readHosts(hostsFile);
	hosts[host] = {
		org,
		apiUrl,
		keyFile
	};
	await writeHosts(hostsFile, hosts);
}
/** List one repository, with an `org:read` token that the SDK signs. */
async function liveCheck(credential) {
	try {
		await createClient(credential).repos.list({ limit: 1 });
	} catch (error) {
		throw toCliError(error, credential);
	}
}
function statusCommand(ctx) {
	return new Command("status").description("Report the credential and the Git helper state for each host.").action((_options, command) => status(createSession(ctx, command)));
}
async function status(session) {
	const { env, cwd } = session.ctx;
	const hosts = await readHosts(configPaths(env).hostsFile);
	const targets = statusTargets(session, hosts);
	if (targets.length === 0) throw credentialError("No credential is configured.", "Run `pierre auth login --hostname <host> --with-key < key.pem`.");
	const inRepo = await gitTopLevel({
		cwd,
		env
	}) !== void 0;
	const results = await Promise.all(targets.map((host) => hostStatus(session, host, hosts, inRepo)));
	if (session.options.json) session.json({ hosts: results.map(({ status: value }) => value) });
	else for (const { status: value } of results) printStatus(session, value);
	const failures = results.filter(({ exitCode }) => exitCode !== 0);
	if (failures.length > 0) {
		const hostsWithProblems = failures.map(({ status: value }) => value.host).join(", ");
		throw new CliError(`A credential problem was found for ${hostsWithProblems}.`, Math.max(...failures.map((failure) => failure.exitCode)));
	}
}
function statusTargets(session, hosts) {
	if (session.options.hostname) return [normalizeHost(session.options.hostname)];
	const known = Object.keys(hosts);
	if (known.length > 0) return known;
	const fromEnv = envValue(session.ctx.env, "PIERRE_GIT_HOST");
	if (fromEnv) return [normalizeHost(fromEnv, "PIERRE_GIT_HOST")];
	const fallback = envDefaultHost(session.ctx.env);
	return fallback ? [fallback] : [];
}
async function hostStatus(session, host, hosts, inRepo) {
	const { env, cwd } = session.ctx;
	const gitOptions = {
		cwd,
		env
	};
	const [global, local] = await Promise.all([readHelperConfig("global", host, gitOptions), inRepo ? readHelperConfig("local", host, gitOptions) : {}]);
	const value = {
		host,
		helper: {
			global: global.helper,
			local: local.helper
		},
		useHttpPath: {
			global: global.useHttpPath,
			local: local.useHttpPath
		},
		readOnly: [global.helper, local.helper].some((helper) => helper !== void 0 && isReadOnlyHelper(helper))
	};
	if (inRepo) {
		const remote = (await storageRemotes(gitOptions, [host])).find((r) => r.host === host);
		if (remote) value.remote = {
			name: remote.name,
			url: remote.url
		};
	}
	let credential;
	try {
		credential = await resolveCredential(env, {
			host,
			entry: hosts[host]
		});
	} catch (error) {
		const failure = toCliError(error, { host });
		value.error = failure.message;
		return {
			status: value,
			exitCode: failure.exitCode
		};
	}
	value.org = credential.org;
	value.apiUrl = credential.apiUrl;
	const { auth } = credential;
	if (auth.kind === "token") value.tokenSource = authSource(auth);
	else {
		value.keySource = authSource(auth);
		value.keyId = auth.keyId;
	}
	try {
		await liveCheck(credential);
		value.live = { ok: true };
		return {
			status: value,
			exitCode: 0
		};
	} catch (error) {
		const failure = toCliError(error, credential);
		value.live = {
			ok: false,
			error: failure.message
		};
		return {
			status: value,
			exitCode: failure.exitCode
		};
	}
}
function describeSetting(state) {
	if (state === void 0) return "not set";
	return typeof state === "boolean" ? String(state) : "configured";
}
function printStatus(session, value) {
	const rows = [];
	if (value.error) rows.push(["Error", value.error]);
	if (value.org) rows.push(["Organization", value.org]);
	if (value.apiUrl) rows.push(["API URL", value.apiUrl]);
	if (value.tokenSource) rows.push(["Token", value.tokenSource]);
	if (value.keySource) rows.push(["Key", value.keySource]);
	if (value.keyId) rows.push(["Key ID", value.keyId]);
	if (value.live) rows.push(["Live check", value.live.ok ? "ok" : `failed: ${value.live.error}`]);
	rows.push(["Git helper", `global: ${describeSetting(value.helper.global)}, local: ${describeSetting(value.helper.local)}`]);
	rows.push(["useHttpPath", `global: ${describeSetting(value.useHttpPath.global)}, local: ${describeSetting(value.useHttpPath.local)}`]);
	rows.push(["Read-only", value.readOnly ? "yes" : "no"]);
	if (value.remote) rows.push(["Remote", `${value.remote.name} ${value.remote.url}`]);
	session.out(value.host);
	for (const [label, text] of rows) session.out(`  ${label.padEnd(13)} ${text}`);
}
function logoutCommand(ctx) {
	return new Command("logout").description("Delete the key file and the host entry.").addOption(new Option("--account", "Clear only the saved account session. Keep all host keys.").hideHelp()).action((options, command) => withAccountLock(ctx.env, () => logout(createSession(ctx, command), options)));
}
async function logout(session, options) {
	if (options.account && session.options.hostname) throw usageError("Use --account or --hostname.");
	const { env } = session.ctx;
	const paths = configPaths(env);
	const file = accountFile(env);
	const hosts = options.account ? {} : await readHosts(paths.hostsFile);
	const noHost = Object.keys(hosts).length === 0 && !session.options.hostname && !envValue(env, "PIERRE_GIT_HOST");
	const saved = await hasAccount(file);
	if (options.account || noHost && saved) {
		if (!saved) {
			session.info("No account session is saved.");
			return;
		}
		if (!await confirm(session, "Clear the saved account session?")) return;
		await clearAccount(env);
		session.info("Cleared the account session.");
		return;
	}
	const { host, entry } = await selectHost(session, hosts);
	if (!entry) throw notFoundError(`${host} is not configured.`, "Run `pierre auth status` to see the hosts.");
	if (!await confirm(session, `Log out of ${host} and delete its key file?`)) {
		session.info("Canceled.");
		return;
	}
	await removeKeyFile(entry.keyFile);
	const pending = await holdsPendingSetup(file, entry.keyFile);
	if (!pending) await clearAccount(env);
	delete hosts[host];
	await writeHosts(paths.hostsFile, hosts);
	session.info(`Logged out of ${host}.`);
	session.info("Revoke the key on the dashboard Keys page. A deleted file revokes nothing.");
	if (pending) session.info("Kept the account session of a pending setup. Run `pierre auth logout --account` to clear it.");
}
function tokenCommand(ctx) {
	return new Command("token").description("Print a token for scripts and curl, signed with the private key (createToken).").option("--repo <repo>", "The repo claim. Default: the Code Storage remote of the current repository.").option("--scope <scope>", `Add a scope, such as git:read or org:read. Repeat for more. Default: ${DEFAULT_SCOPES.join(" and ")}.`, (value, all) => [...all, value], []).option("--ttl <duration>", "The lifetime, such as 15m, 1h, or 900s. Default: 15m. Up to 1h.").addHelpText("after", `\nThe scopes: ${SCOPES.join(", ")}.\nA token whose scopes all cover the organization (${publicScopes(ORG_SCOPES).join(", ")}) has no repo claim.`).action((options, command) => token(createSession(ctx, command), options));
}
async function token(session, options) {
	const scopes = options.scope.length > 0 ? options.scope.map(parseScope) : DEFAULT_SCOPES;
	const ttl = options.ttl ? parseDuration(options.ttl, "--ttl") : 900;
	if (ttl > 3600) throw usageError("--ttl can be at most 1h.");
	const { env, cwd } = session.ctx;
	const hosts = await readHosts(configPaths(env).hostsFile);
	const credential = await resolveCredential(env, await selectHost(session, hosts));
	if (credential.auth.kind === "token") throw usageError("PIERRE_TOKEN is set, so the CLI signs no token.", "Use PIERRE_TOKEN itself, or unset it to sign a token with the private key.");
	let repo = options.repo?.trim() || void 0;
	if (repo === void 0 && scopesNeedRepo(scopes)) {
		const remote = (await storageRemotes({
			cwd,
			env
		}, [credential.host])).find((r) => r.host === credential.host);
		if (!remote) throw usageError("Pass --repo <repo>, or run inside a repository with a Code Storage remote.", `Only a token whose scopes all cover the organization has no repo claim: ${publicScopes(ORG_SCOPES).join(", ")}.`);
		repo = remote.repo;
	}
	session.debug(`signing ${scopes.join(",")} for ${repo ?? "the organization"} on ${credential.host} (org ${credential.org}, ttl ${ttl}s)`);
	try {
		session.out(await signToken(createClient(credential), {
			...repo ? { repo } : {},
			scopes,
			ttl
		}));
	} catch (error) {
		throw toCliError(error, credential);
	}
}
function parseScope(value) {
	const scope = value.trim();
	if (!isScope(scope)) throw usageError(`Unknown scope "${value}".`, `The scopes: ${SCOPES.join(", ")}.`);
	return scope;
}

// src/commands/mcp.ts
/** The command that installs the `pierre` agent skill, which points to the docs. */
const SKILL_INSTALL = "npx skills add pierrecomputer/skills";
/** The first remote URL of an MCP server card: `{ remotes: [{ url }] }`. */
function cardServer(card) {
	if (!isRecord(card) || !Array.isArray(card.remotes)) return void 0;
	for (const remote of card.remotes) if (isRecord(remote) && typeof remote.url === "string" && remote.url) return remote.url;
}
function mcpCommand(ctx) {
	return new Command("mcp").description("Print the Code Storage MCP server, the docs index, and the auth note.").action((_options, command) => mcp(createSession(ctx, command)));
}
async function mcp(session) {
	const { env } = session.ctx;
	const urls = discoveryUrls(dashboardUrl(env));
	const server = cardServer(await fetchJson(urls.mcpCard).catch(() => void 0)) ?? urls.mcpServer;
	const org = await activeOrg(session);
	if (session.options.json) {
		session.json({ mcpServers: { "code-storage": {
			type: "http",
			url: server
		} } });
		return;
	}
	const rows = [
		["MCP server", server],
		["Docs index", urls.docsIndex],
		["Auth note", urls.authNote],
		["Agent skill", SKILL_INSTALL]
	];
	if (org) rows.push(["Organization", org.org], ["API URL", org.apiUrl]);
	for (const line of formatTable(rows)) session.out(line);
	session.info("");
	session.info(`Claude Code: \`claude mcp add --transport http code-storage ${server}\``);
	session.info("Other clients: `pierre mcp --json` prints the config block.");
}
/** The org and API URL of the selected host, when one resolves without a key. */
async function activeOrg(session) {
	const { env } = session.ctx;
	try {
		const hosts = await readHosts(configPaths(env).hostsFile);
		const { host, entry } = await selectHost(session, hosts);
		const org = resolveOrg(host, entry, env);
		return {
			org,
			apiUrl: resolveApiUrl(host, entry, env, org)
		};
	} catch {
		return;
	}
}

// src/account/workos.ts
function timedOut() {
	return new CliError("Account setup timed out. Run the command again to resume.");
}
/** Wait, but not past the deadline. Stop when the deadline already passed. */
async function waitUntil(deadline, seconds = 3) {
	if (Date.now() >= deadline) throw timedOut();
	await new Promise((resolve) => setTimeout(resolve, Math.min(seconds * 1e3, Math.max(0, deadline - Date.now()))));
}
function tokens(body, environment) {
	if (!isRecord(body.user) || body.user.email_verified !== true) throw new CliError("The sign-in did not return a user with a verified email.");
	return {
		version: 1,
		dashboardUrl: environment.dashboardUrl,
		clientId: environment.workosClientId,
		accessToken: textField(body, "access_token"),
		refreshToken: textField(body, "refresh_token"),
		userId: textField(body.user, "id"),
		...typeof body.organization_id === "string" && body.organization_id ? { orgId: body.organization_id } : {}
	};
}
async function signIn(environment, file, emit, deadline) {
	const grant = await oauth(environment.workosApiUrl, "authorize/device", { client_id: environment.workosClientId });
	const deviceCode = textField(grant, "device_code");
	const userCode = textField(grant, "user_code");
	const url = typeof grant.verification_uri_complete === "string" ? grant.verification_uri_complete : textField(grant, "verification_uri");
	secureURL(url, "The sign-in service returned an invalid URL.");
	emit("sign_in_required", {
		url,
		userCode
	});
	let interval = Math.max(1, Number(grant.interval) || 5);
	const expires = Math.min(deadline, Date.now() + (Number(grant.expires_in) || 300) * 1e3);
	while (Date.now() < expires) {
		await waitUntil(expires, interval);
		try {
			const state = tokens(await oauth(environment.workosApiUrl, "authenticate", {
				client_id: environment.workosClientId,
				grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				device_code: deviceCode
			}), environment);
			await saveAccount(file, state);
			return state;
		} catch (error) {
			if (isTransient(error)) {
				if (error instanceof AccountError && error.status === 429) interval += 5;
				continue;
			}
			if (!(error instanceof AccountError)) throw error;
			if (error.code === "slow_down") interval += 5;
			else if (error.code !== "authorization_pending") throw error;
		}
	}
	throw credentialError("Sign-in expired.", "Run the command again to request another code.");
}
async function refresh(environment, file, state, orgId) {
	const current = tokens(await oauth(environment.workosApiUrl, "authenticate", {
		client_id: environment.workosClientId,
		grant_type: "refresh_token",
		refresh_token: state.refreshToken,
		...orgId ? { organization_id: orgId } : {}
	}), environment);
	if (current.userId !== state.userId) throw new CliError("The account identity changed during refresh.");
	const updated = {
		...state,
		...current
	};
	if (!current.orgId) delete updated.orgId;
	await saveAccount(file, updated);
	if (orgId && updated.orgId !== orgId) throw new CliError("The sign-in did not select the requested organization. Run the command again to resume.");
	return updated;
}

// src/account/flow.ts
const SIGNUP = "control_plane.v1.ControlPlaneSignupService/";
const WORKSPACES = "control_plane.v1.ControlPlaneWorkspaceService/";
const ONBOARDING = "control_plane.v1.ControlPlaneOnboardingService/";
const KEYS = "git3p.v1.Git3pService/";
async function accountRPC(environment, file, state, service, method, body = {}) {
	const base = service === "workspace" ? environment.controlPlaneUrl : environment.cloudApiUrl;
	try {
		return await rpc(base, method, state.accessToken, body);
	} catch (error) {
		if (!(error instanceof AccountError) || error.status !== 401) throw error;
		Object.assign(state, await refresh(environment, file, state, state.orgId));
		return rpc(base, method, state.accessToken, body);
	}
}
/** The longest wait between two tries of a poll after a transient failure. */
const MAX_RETRY_SECONDS = 30;
/**
* Call a read-only RPC of a wait loop. A person can need many minutes to approve or pay, so a
* rate limit or a proxy failure does not stop the wait. The poll tries again until the deadline.
*/
async function pollRPC(environment, file, state, deadline, method, body) {
	let delay = 3;
	for (;;) try {
		return await accountRPC(environment, file, state, "workspace", method, body);
	} catch (error) {
		if (!isTransient(error)) throw error;
		const seconds = Math.min(error instanceof AccountError ? error.retryAfter ?? delay : delay, MAX_RETRY_SECONDS);
		const last = Date.now() + seconds * 1e3 >= deadline;
		await waitUntil(deadline, seconds);
		if (last) throw timedOut();
		delay = Math.min(delay * 2, MAX_RETRY_SECONDS);
	}
}
/** The commands that follow setup: create a repository, then add the agent skill. */
const NEXT_STEPS = ["pierre repos create <name>", SKILL_INSTALL];
function events(session) {
	return (event, fields = {}) => {
		if (session.options.json) session.ctx.stdout.write(`${JSON.stringify({
			event,
			...fields
		})}\n`);
		else if (event === "ready") {
			session.out(`Code Storage is ready for ${String(fields.org)}.`);
			session.out(`Host: ${String(fields.host)}`);
			session.out(`API URL: ${String(fields.apiUrl)}`);
			session.out(`Key file: ${String(fields.keyFile)}`);
			session.out(`Key ID: ${String(fields.keyId)}`);
			session.out("Next steps:");
			for (const next of NEXT_STEPS) session.out(`  ${next}`);
		} else if (event === "sign_in_required") session.ctx.stderr.write(`Open ${String(fields.url)}\nConfirm code ${String(fields.userCode)}.\n`);
		else if (event === "payment_required") session.ctx.stderr.write(`Complete payment at ${String(fields.url)}\n`);
		else if (!session.options.quiet) session.ctx.stderr.write(`Code Storage: ${event.replaceAll("_", " ")}.\n`);
	};
}
function objects(value) {
	return Array.isArray(value) ? value.filter(isRecord) : [];
}
function step(value) {
	return typeof value === "string" ? value.replace("SIGNUP_NEXT_STEP_", "") : "";
}
function validateSubdomain(value, environment) {
	if (!/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(value) || !value.endsWith(environment.requiredSubdomainSuffix)) throw usageError("The subdomain must have 3 to 40 characters. Use lowercase letters, digits, and hyphens. Start with a letter and end with a letter or digit." + (environment.requiredSubdomainSuffix ? ` The subdomain must end with ${environment.requiredSubdomainSuffix}.` : ""));
}
async function authenticated(environment, file, emit, deadline) {
	const saved = await loadAccount(file, environment);
	if (!saved) return signIn(environment, file, emit, deadline);
	try {
		return await refresh(environment, file, saved, saved.orgId);
	} catch (error) {
		if (!(error instanceof AccountError) || error.code !== "invalid_grant") throw error;
		const current = await signIn(environment, file, emit, deadline);
		if (current.userId !== saved.userId) {
			await saveAccount(file, saved);
			throw new CliError("Sign in as the user who started setup, or run `pierre auth logout --account`.");
		}
		const resumed = {
			...saved,
			...current
		};
		if (!current.orgId) delete resumed.orgId;
		await saveAccount(file, resumed);
		return resumed;
	}
}
async function selectTarget(environment, file, state, options) {
	const targets = objects((await accountRPC(environment, file, state, "workspace", `${ONBOARDING}ListClusterTargets`)).clusterTargets).filter((target) => (!options.region || target.region === options.region) && (!options.provider || target.provider === options.provider) && (!options.cluster || target.cluster === options.cluster));
	const target = targets[0];
	if (!target) throw usageError("No available cluster matches the placement flags.");
	if (targets.length > 1 && (options.region || options.provider || options.cluster)) throw usageError("More than one cluster matches. Pass --provider, --region, and --cluster.");
	return {
		provider: textField(target, "provider"),
		region: textField(target, "region"),
		cluster: textField(target, "cluster")
	};
}
/**
* The signup session proves the payment, so the CLI polls it while a person pays. A checkout can
* expire, so the CLI asks for its URL again after this time and shows a replacement URL.
*/
const CHECKOUT_RECHECK_MS = 3e5;
/** Start or resume the hosted checkout. Show its URL when it is new, and return the shown URL. */
async function showCheckout(environment, file, state, plan, emit, shown) {
	let checkout;
	try {
		checkout = await accountRPC(environment, file, state, "workspace", `${SIGNUP}CreateSignupCheckoutSession`, {
			sessionId: state.signupSessionId,
			...plan,
			hosted: true
		});
	} catch (error) {
		if (error instanceof AccountError && error.reason === "promotion_code_invalid" && plan.promotionCode && state.signup?.promotionCode === plan.promotionCode) {
			delete state.signup.promotionCode;
			await saveAccount(file, state);
		}
		throw error;
	}
	if (typeof checkout.checkoutUrl !== "string" || !checkout.checkoutUrl || checkout.checkoutUrl === shown) return shown;
	secureURL(checkout.checkoutUrl, "The payment URL is invalid.");
	emit("payment_required", {
		url: checkout.checkoutUrl,
		sessionId: state.signupSessionId
	});
	return checkout.checkoutUrl;
}
/** The subdomain and the cluster that the signup session holds on the server. */
function reservation(current) {
	const subdomain = typeof current.subdomain === "string" && current.subdomain ? current.subdomain : void 0;
	const target = current.clusterTarget;
	const clusterTarget = isRecord(target) && [
		"provider",
		"region",
		"cluster"
	].some((field) => typeof target[field] === "string" && target[field]) ? {
		provider: textField(target, "provider"),
		region: textField(target, "region"),
		cluster: textField(target, "cluster")
	} : void 0;
	if (subdomain && !clusterTarget) throw new CliError("The reserved signup has no cluster target. Contact support. Payment is already recorded.");
	return {
		...subdomain ? { subdomain } : {},
		...clusterTarget ? { clusterTarget } : {}
	};
}
/**
* Select the subdomain, the plan, and the cluster of a signup, and save the selection. For the
* subdomain, a reservation on the server wins over --subdomain, and --subdomain wins over the
* saved selection. A new selection needs a confirmation on a terminal, because the subdomain is
* permanent.
*/
async function select(session, environment, file, state, options, current, plans) {
	const reserved = reservation(current);
	if (options.subdomain && reserved.subdomain && options.subdomain !== reserved.subdomain) throw usageError("This signup already reserved a subdomain. Resume with its reserved name.");
	const saved = state.signup;
	const subdomain = reserved.subdomain ?? options.subdomain ?? saved?.subdomain ?? await ask(session, "subdomain", "Organization subdomain");
	validateSubdomain(subdomain, environment);
	const serverPlan = typeof current.planType === "string" && current.planType ? current.planType : void 0;
	const plan = saved?.plan ?? serverPlan ?? options.plan ?? await ask(session, "plan", `Plan (${plans.map((item) => String(item.planType)).join(", ")})`);
	if (plan !== serverPlan && plans.length > 0 && !plans.some((item) => item.planType === plan)) throw usageError("The selected plan is not available.");
	if (options.plan && options.plan !== plan) throw usageError("The plan differs from the signup in progress. Resume with its original plan.");
	if (!saved && !reserved.subdomain && !reserved.clusterTarget && !session.options.noInput && session.ctx.stdin.isTTY && !await confirm({
		...session,
		ctx: {
			...session.ctx,
			stdout: session.ctx.stderr
		}
	}, `Create organization ${subdomain}?`)) throw usageError("Signup was canceled.");
	const target = reserved.clusterTarget ?? saved?.clusterTarget;
	if (target && [
		"provider",
		"region",
		"cluster"
	].some((field) => options[field] && options[field] !== target[field])) throw usageError("The placement differs from the signup in progress. Resume with its original --provider, --region, and --cluster.");
	const promotionCode = options.promotionCode ?? saved?.promotionCode;
	const selection = {
		subdomain,
		plan,
		...promotionCode ? { promotionCode } : {},
		clusterTarget: target ?? await selectTarget(environment, file, state, options)
	};
	if (JSON.stringify(selection) !== JSON.stringify(saved)) {
		state.signup = selection;
		await saveAccount(file, state);
	}
	return selection;
}
async function signup(session, environment, file, initial, options, emit, deadline) {
	let state = initial;
	let paymentShown = "";
	let checkoutRecheck = 0;
	while (Date.now() < deadline) {
		const result = await pollRPC(environment, file, state, deadline, `${SIGNUP}GetSignupSession`, state.signupSessionId ? { sessionId: state.signupSessionId } : {});
		if (!isRecord(result.session)) throw new CliError("The signup service did not return a session.");
		const current = result.session;
		const sessionId = textField(current, "sessionId");
		if (state.signupSessionId !== sessionId) {
			state.signupSessionId = sessionId;
			await saveAccount(file, state);
		}
		const next = step(result.nextStep);
		if (next === "PROVISIONING_BLOCKED") throw new CliError("Provisioning needs support. Payment is already recorded.");
		if ((next === "PROVISIONING" || next === "COMPLETED") && typeof current.workosOrgId === "string") {
			if (options.subdomain && current.subdomain && options.subdomain !== current.subdomain) throw usageError("This signup already reserved another subdomain. Resume with its reserved name.");
			state = await refresh(environment, file, state, current.workosOrgId);
			return {
				state,
				workspaceId: textField(current, "initialWorkspaceId")
			};
		}
		const selection = await select(session, environment, file, state, options, current, objects(result.plans));
		if (next === "SELECT_PLAN" || next === "COMPLETE_PAYMENT" && Date.now() >= checkoutRecheck) {
			paymentShown = await showCheckout(environment, file, state, {
				planType: selection.plan,
				...selection.promotionCode ? { promotionCode: selection.promotionCode } : {}
			}, emit, paymentShown);
			checkoutRecheck = Date.now() + CHECKOUT_RECHECK_MS;
		} else if (next === "PROVISION_ORG") {
			await accountRPC(environment, file, state, "workspace", `${SIGNUP}CompleteSignupDeployment`, {
				sessionId: state.signupSessionId,
				subdomain: selection.subdomain,
				clusterTarget: selection.clusterTarget
			});
			emit("provisioning");
			continue;
		} else if (next !== "COMPLETE_PAYMENT" && next !== "VERIFYING_PAYMENT") throw new CliError("The signup service returned an unsupported next step.");
		await waitUntil(deadline);
	}
	throw new CliError("Signup timed out. Run the command again to resume.");
}
async function existingWorkspace(session, environment, file, state, options) {
	const workspaces = [];
	const pages = /* @__PURE__ */ new Set();
	let pageToken = "";
	do {
		if (pages.has(pageToken)) throw new CliError("The account service repeated a page. Setup stopped.");
		pages.add(pageToken);
		const result = await accountRPC(environment, file, state, "workspace", `${WORKSPACES}ListWorkspaces`, {
			organizationId: state.orgId,
			...pageToken ? { pageToken } : {}
		});
		for (const workspace of objects(result.workspaces)) if (workspace.archived !== true && (!options.subdomain || workspace.slug === options.subdomain)) workspaces.push(workspace);
		pageToken = typeof result.nextPageToken === "string" ? result.nextPageToken : "";
	} while (pageToken);
	if (workspaces.length === 1 && workspaces[0]) return textField(workspaces[0], "id");
	if (workspaces.length === 0) throw new CliError("The selected organization has no matching subdomain. Signup was not started.");
	const chosen = options.subdomain ?? await ask(session, "subdomain", `Subdomain (${workspaces.map((item) => String(item.slug)).join(", ")})`);
	const workspace = workspaces.find((item) => item.slug === chosen);
	if (!workspace) throw usageError("The subdomain is not in the selected organization.");
	return textField(workspace, "id");
}
async function readyWorkspace(environment, file, state, workspaceId, emit, deadline) {
	let announced = false;
	while (Date.now() < deadline) {
		const result = await pollRPC(environment, file, state, deadline, `${WORKSPACES}GetWorkspace`, {
			organizationId: state.orgId,
			workspaceId
		});
		if (!isRecord(result.workspace)) throw new CliError("The account service returned no organization.");
		const workspace = result.workspace;
		if (workspace.externalAccessState === "WORKSPACE_EXTERNAL_ACCESS_STATE_SUSPENDED") throw new CliError("External access to this organization is suspended.");
		const phase = isRecord(workspace.status) ? workspace.status.phase : void 0;
		if (phase === "WORKSPACE_PHASE_READY") return workspace;
		if ([
			"WORKSPACE_PHASE_FAILED",
			"WORKSPACE_PHASE_ARCHIVED",
			"WORKSPACE_PHASE_ARCHIVING"
		].includes(String(phase))) throw new CliError("The organization is not available. Contact support.");
		if (!announced) {
			emit("provisioning");
			announced = true;
		}
		await waitUntil(deadline);
	}
	throw new CliError("The organization is still provisioning. Run the command again to resume.");
}
const DNS_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
/**
* The label of the organization hosts. A workspace can have a public subdomain, its routing ID,
* that differs from its slug. The slug stays the organization that issues tokens.
*/
function hostLabel(workspace, org) {
	const routingId = typeof workspace.routingId === "string" ? workspace.routingId.trim().toLowerCase() : "";
	if (!routingId) return org;
	if (!DNS_LABEL.test(routingId)) throw new CliError("The host name of the organization is not a DNS label. Contact support.");
	return routingId;
}
/**
* The key ID of a listed public key. The PEM text of one key can differ between the clients that
* register keys, so keys compare by ID.
*/
function listedKeyId(item) {
	if (typeof item.publicKey !== "string") return void 0;
	try {
		return keyIdOf(createPublicKey(item.publicKey));
	} catch {
		return;
	}
}
function credential(host, org, apiUrl, keyFile, pem) {
	const key = parsePrivateKey(pem);
	return {
		host,
		org,
		apiUrl,
		auth: {
			kind: "key",
			key: key.pem,
			keyId: key.keyId,
			source: {
				kind: "file",
				path: keyFile
			}
		}
	};
}
async function savedCredential(host, org, apiUrl, keyFile) {
	try {
		return credential(host, org, apiUrl, keyFile, await readFile(keyFile, "utf8"));
	} catch (error) {
		if (errorCode(error) === "ENOENT" || error instanceof CliError && error.exitCode === ExitCode.credential) return void 0;
		throw error;
	}
}
async function setupCredential(session, environment, file, state, workspace, options) {
	const org = textField(workspace, "slug");
	const label = hostLabel(workspace, org);
	const host = normalizeHost(environment.gitHostTemplate.replaceAll("{{org}}", label));
	const apiUrl = normalizeApiUrl(environment.apiUrlTemplate.replaceAll("{{org}}", label));
	if (session.options.hostname && normalizeHost(session.options.hostname) !== host) throw usageError("The selected organization does not match --hostname.");
	const paths = configPaths(session.ctx.env);
	const hosts = await readHosts(paths.hostsFile);
	let selected;
	let verify = false;
	const saved = hosts[host];
	const candidate = saved ? await savedCredential(host, org, apiUrl, saved.keyFile) : void 0;
	if (candidate) {
		const registered = objects((await accountRPC(environment, file, state, "cloud", `${KEYS}ListPublicKeys`)).keys).find((item) => listedKeyId(item) === candidate.auth.keyId);
		const unrestricted = (registered && isRecord(registered.allowedScopes) && Array.isArray(registered.allowedScopes.scopes) ? registered.allowedScopes.scopes : []).includes("*");
		try {
			if (unrestricted) {
				await createClient(candidate).repos.list({ limit: 1 });
				selected = candidate;
			}
		} catch (error) {
			if (!(error instanceof AuthenticationError) && !(error instanceof PermissionDeniedError)) throw error;
		}
	}
	if (!selected) {
		if (!state.key || state.key.orgId !== state.orgId || state.key.host !== host) {
			if (state.key) await removePendingKey(state.key.keyFile, hosts, paths.keysDir);
			const registrationId = randomBytes(16).toString("base64url").slice(0, 21);
			const keyFile = join(paths.keysDir, `${host}-${registrationId}.pem`);
			const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
			await writeKeyFile(keyFile, pair.privateKey.export({
				type: "pkcs8",
				format: "pem"
			}).toString());
			state.key = {
				orgId: state.orgId,
				host,
				keyFile,
				registrationId,
				publicKey: pair.publicKey.export({
					type: "spki",
					format: "pem"
				}).toString()
			};
			await saveAccount(file, state);
		}
		const key = state.key;
		const pem = await readFile(key.keyFile, "utf8");
		const publicKey = createPublicKey(pem).export({
			type: "spki",
			format: "pem"
		}).toString();
		if (publicKey !== key.publicKey) throw new CliError("The pending key file changed. Account setup stopped.");
		try {
			await accountRPC(environment, file, state, "cloud", `${KEYS}SavePublicKey`, {
				id: key.registrationId,
				name: options.keyName ?? `pierre CLI on ${hostname()}`,
				publicKey,
				keyType: "ecdsa-p256",
				allowedScopes: { scopes: ["*"] }
			});
		} catch (error) {
			if (!(error instanceof AccountError) || error.code !== "already_exists") throw error;
			const listed = await accountRPC(environment, file, state, "cloud", `${KEYS}ListPublicKeys`);
			const keyId = keyIdOf(createPublicKey(pem));
			if (!objects(listed.keys).some((item) => listedKeyId(item) === keyId)) throw error;
		}
		selected = credential(host, org, apiUrl, key.keyFile, pem);
		verify = true;
	}
	await storeKey(session.ctx.env, selected, { verify });
	await setupGit({
		...session,
		options: {
			...session.options,
			hostname: host
		},
		info: () => {}
	}, {});
	return {
		org,
		orgId: state.orgId,
		workspaceId: textField(workspace, "id"),
		host,
		apiUrl,
		keyFile: selected.auth.source.path,
		keyId: selected.auth.keyId,
		nextSteps: NEXT_STEPS
	};
}
/** Each variable replaces the key file of a host entry, so the key that setup stores is unused. */
const ENV_CREDENTIALS = [
	"PIERRE_TOKEN",
	"PIERRE_PRIVATE_KEY",
	"PIERRE_PRIVATE_KEY_FILE"
];
async function runAccount(session, command, options) {
	let release;
	try {
		const variable = ENV_CREDENTIALS.find((name) => envValue(session.ctx.env, name));
		if (variable) throw usageError(`Unset ${variable} before account setup.`, `The CLI and Git use ${variable} in place of the key that account setup stores.`);
		const deadline = Date.now() + parseDuration(options.timeout ?? "30m", "--timeout") * 1e3;
		const file = accountFile(session.ctx.env);
		release = await acquireAccountLock(session.ctx.env);
		const environment = await discover(session.ctx.env);
		const emit = events(session);
		let state = await authenticated(environment, file, emit, deadline);
		if (command === "init" && options.orgId) {
			if (state.signupSessionId) throw usageError("Resume signup without --org-id. The signup selects its own organization.");
			if (state.orgId !== options.orgId) state = await refresh(environment, file, state, options.orgId);
		}
		let workspaceId;
		if (command === "signup" || state.signupSessionId || !state.orgId) ({state, workspaceId} = await signup(session, environment, file, state, options, emit, deadline));
		else workspaceId = await existingWorkspace(session, environment, file, state, options);
		const workspace = await readyWorkspace(environment, file, state, workspaceId, emit, deadline);
		const ready = await setupCredential(session, environment, file, state, workspace, options);
		await clearAccount(session.ctx.env);
		emit("ready", ready);
	} catch (error) {
		if (!(error instanceof CliError)) {
			const code = errorCode(error);
			session.debug(`account setup failed: ${error instanceof Error ? error.name : typeof error}${code ? ` ${code}` : ""}`);
		}
		const failure = error instanceof CliError ? error : new CliError("Account setup failed. Run the command again to resume.");
		if (session.options.json) events(session)("error", {
			...failure instanceof AccountError && failure.reason ? { reason: failure.reason } : {},
			code: failure instanceof AccountError || failure instanceof AccountUnavailableError || failure instanceof AccountSetupInProgressError ? failure.code : failure.exitCode === 2 ? "usage" : "account_setup_failed",
			message: failure.message
		});
		throw failure.body === void 0 ? failure : new CliError(failure.message, failure.exitCode, failure.hint);
	} finally {
		await release?.().catch(() => void 0);
	}
}

// src/commands/account.ts
function accountCommand(ctx, name) {
	const command = new Command(name).description(name === "signup" ? "Create an organization and set up this machine." : "Set up this machine. Sign up if the account has no organization.").option("--plan <plan-type>", "The plan for a new organization.").option("--subdomain <name>", name === "signup" ? "The subdomain to reserve for the new organization." : "The subdomain to reserve for a new organization, or the subdomain to select in an existing organization.").option("--region <region>", "Select a region for the new organization.").option("--provider <provider>", "Select a cloud provider.").option("--cluster <cluster>", "Select a cluster in the region.").option("--promotion-code <code>", "A promotion code for the payment of a new organization.").option("--key-name <name>", "The name of this machine key in the dashboard.").option("--timeout <duration>", "The maximum wait. Default: 30m.");
	if (name === "init") command.option("--org-id <org-id>", "Select an existing organization by its ID.");
	return command.action((options, selected) => runAccount(createSession(ctx, selected), name, options));
}

// src/commands/api.ts
/** The heading of the helpers in `pierre --help`. */
const HELPERS_GROUP = "Helpers:";
const collect = (value, previous) => [...previous, value];
function apiCommand(ctx) {
	return new Command("api").helpGroup(HELPERS_GROUP).description("Call any operation by its catalog ID, such as repos.branches.create.").argument("<catalog-id>", "The catalog ID of the operation.").option("-F, --field <key=value>", "A typed field: true, false, null, an integer, @file, @-, or text. key[name]=value sets a field of an object. Repeat for each field.", collect, []).option("-f, --raw-field <key=value>", "A string field. Repeat for each field.", collect, []).option("--input <file>", "The body fields as one JSON object, from a file, or - for stdin.").option("--paginate", "Read every page of a list, and print one body for each page.").option("--output <file>", "Write a byte response to this file.").addHelpText("after", `
Example:
  pierre api repos.branches.create -F repo_name=cli -F target_branch=script -F base_ref=main

Path parameters are fields. The output is the JSON response body.
Docs: search for the catalog ID in the docs MCP server, ${DOCS.mcpServer}`).action((id, options, command) => api(createSession(ctx, command), id, options));
}
/** The edit distance of two IDs, to name the nearest catalog ID. */
function distance(a, b) {
	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i += 1) {
		const current = [i];
		for (let j = 1; j <= b.length; j += 1) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
		}
		previous = current;
	}
	return previous[b.length] ?? 0;
}
function lookup(id) {
	const spec = COMMANDS.find((entry) => entry.id === id);
	if (spec !== void 0) return spec;
	const nearest = COMMANDS.map((entry) => entry.id).toSorted((a, b) => distance(id, a) - distance(id, b))[0];
	throw usageError(`Unknown catalog ID ${id}.`, nearest === void 0 ? void 0 : `Did you mean ${nearest}?`);
}
function split(text, flag) {
	const match = /^([^=[\]]+)(?:\[([^\]]*)\])?=(.*)$/s.exec(text);
	if (match?.[1] === void 0) throw usageError(`${flag} needs key=value: ${text}`);
	return {
		key: match[1],
		...match[2] === void 0 ? {} : { member: match[2] },
		value: match[3] ?? ""
	};
}
/** The value of `-F`: a literal `true`, `false`, `null`, or integer, the text of `@file`, or text. */
async function typed(session, value) {
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "null") return null;
	if (/^-?\d+$/.test(value)) return Number(value);
	return textOf(session, value, "-F");
}
function fieldOf(spec, key) {
	const field = spec.fields.find((entry) => entry.name === key);
	if (field !== void 0) return field;
	throw usageError(`${spec.id} has no field ${key}.`, `Fields: ${spec.fields.map((entry) => entry.name).join(", ")}.`);
}
function assign(session, spec, params, entry) {
	const field = fieldOf(spec, entry.key);
	if (field.deprecated === true) session.warn(`${spec.id}: ${entry.key} is deprecated.`);
	if (entry.member === void 0) {
		const current = params[entry.key];
		params[entry.key] = field.type === "array" ? [...Array.isArray(current) ? current : [], entry.value] : entry.value;
		return;
	}
	if (entry.member === "") {
		const current = params[entry.key];
		params[entry.key] = [...Array.isArray(current) ? current : [], entry.value];
		return;
	}
	const current = params[entry.key];
	params[entry.key] = {
		...isRecord(current) ? current : {},
		[entry.member]: entry.value
	};
}
async function api(session, id, options) {
	const spec = lookup(id);
	if (spec.content !== null) throw usageError(`pierre api cannot call ${id}, because its body is content.`, `Use \`pierre ${spec.resource} ${spec.method}\`.`);
	const params = {};
	if (options.input !== void 0) {
		const body = await jsonOf(session, options.input === "-" ? "@-" : `@${options.input}`, "--input");
		if (!isRecord(body)) throw usageError("--input needs a JSON object.");
		for (const [key, value] of Object.entries(body)) {
			if (fieldOf(spec, key).in !== "body") throw usageError(`--input holds ${key}, which is not a body field.`);
			params[key] = value;
		}
	}
	const assignments = [];
	for (const text of options.field) {
		const { value, ...rest } = split(text, "-F");
		assignments.push({
			...rest,
			value: await typed(session, value)
		});
	}
	for (const text of options.rawField) assignments.push(split(text, "-f"));
	for (const entry of assignments) {
		if (options.input !== void 0 && fieldOf(spec, entry.key).in === "body") throw usageError(`${entry.key} is a body field, and --input gives the body.`, "Put it in the --input file, or leave out --input.");
		assign(session, spec, params, entry);
	}
	const output = {
		mode: "json",
		paginate: options.paginate === true,
		...options.output === void 0 ? {} : { output: options.output }
	};
	checkOutput(session, spec, output);
	const { credential, client } = await connect(session);
	try {
		await execute(session, spec, sdkMethod(client, spec.id), params, output);
	} catch (error) {
		throw toCliError(error, credential);
	}
}

// src/commands/version.ts
function versionCommand(ctx) {
	return new Command("version").description("Print the CLI and SDK versions.").action((_options, command) => {
		const session = createSession(ctx, command);
		const versions = {
			cli: CLI_VERSION,
			sdk: VERSION
		};
		if (session.options.json) {
			session.json(versions);
			return;
		}
		session.out(`pierre ${versions.cli}`);
		session.out(`@pierre/sdk ${versions.sdk}`);
	});
}

// src/program.ts
function createProgram(ctx) {
	const program = new Command("pierre").description("The Code Storage command-line tool.").helpOption("-h, --help", "Show help.").helpCommand(false).option("--debug", "Print to stderr the repository taken from the Git remote, the token steps of the credential helper and of auth token, and the stack of an unexpected error. Never prints a token.").option("--hostname <host>", "Select an organization by its Git host. An http:// or https:// prefix is accepted.").option("--json", "Print the JSON response body.").option("--no-input", "Fail instead of prompt.").option("--quiet", "Print only results and errors.").version(CLI_VERSION, "-v, --version", "Print the CLI version.").option("--yes", "Skip confirmations.").configureOutput({
		writeOut: (text) => ctx.stdout.write(text),
		writeErr: (text) => ctx.stderr.write(text)
	}).configureHelp({ showGlobalOptions: true }).addHelpText("after", `
An API command is the catalog ID with \`:\` between the resources, then the method:
  pierre repos:branches create script -R cli --base-ref main
Singular nouns also work: pierre repo:branch create.

Select an organization with --hostname <host> or PIERRE_GIT_HOST. Otherwise the CLI uses
the current repository's Code Storage remote, or the sole saved host.
\nDocs: the MCP server ${DOCS.mcpServer}, then the Markdown pages from ${DOCS.index}`).exitOverride();
	const api = apiCommands(ctx);
	for (const command of api) program.addCommand(command);
	for (const helper of [
		apiCommand(ctx),
		authCommand(ctx),
		mcpCommand(ctx),
		versionCommand(ctx)
	]) program.addCommand(helper.helpGroup(HELPERS_GROUP));
	for (const name of ["signup", "init"]) program.addCommand(accountCommand(ctx, name), { hidden: true });
	inheritSettings(program);
	for (const group of api) for (const method of group.commands) method.allowExcessArguments(true);
	return program;
}
/** Give every subcommand the output and exit settings of the root command. */
function inheritSettings(parent) {
	for (const child of parent.commands) {
		child.copyInheritedSettings(parent);
		child.helpCommand(false);
		inheritSettings(child);
	}
}
async function run(argv, ctx) {
	const program = createProgram(ctx);
	try {
		const { args, error } = normalizeArgs(argv);
		if (error !== void 0) throw usageError(error.message, error.hint);
		await program.parseAsync(args, { from: "user" });
		return ExitCode.success;
	} catch (error) {
		return report(error, ctx, program);
	}
}
function report(error, ctx, program) {
	if (error instanceof CommanderError) return error.exitCode === 0 ? ExitCode.success : ExitCode.usage;
	const failure = toCliError(error);
	const options = globalOptions(program);
	if (options.json && failure.body !== void 0) ctx.stdout.write(`${JSON.stringify(failure.body, null, 2)}\n`);
	ctx.stderr.write(`pierre: ${failure.message}\n`);
	if (failure.hint) ctx.stderr.write(`${failure.hint}\n`);
	if (options.debug && !(error instanceof CliError) && error instanceof Error && error.stack) ctx.stderr.write(`${error.stack}\n`);
	return failure.exitCode;
}

// src/self.ts
/** pnpm writes a bin as a shell script, not a link, and ends the script with this line. */
const SHIM_TARGET = "# cmd-shim-target=";
/** A pnpm script is smaller than 2 KiB. Do not read a larger file, such as a binary. */
const MAX_SHIM_BYTES = 65536;
/** The path that a pnpm bin script starts, from its last line. */
function shimTarget(file) {
	const stats = statSync(file);
	if (!stats.isFile() || stats.size > MAX_SHIM_BYTES) return void 0;
	const lastLine = readFileSync(file, "utf8").trimEnd().split("\n").at(-1) ?? "";
	return lastLine.startsWith(SHIM_TARGET) ? lastLine.slice(18) : void 0;
}
/** Whether a file starts the script: a link to it, or a pnpm script that names it. */
function startsScript(file, scriptPath) {
	if (realpathSync(file) === scriptPath) return true;
	const target = shimTarget(file);
	return target !== void 0 && realpathSync(target) === scriptPath;
}
/** A `pierre` on PATH that starts the running script, as an absolute path. */
function binOnPath(scriptPath, path) {
	for (const dir of path.split(delimiter)) {
		if (!dir) continue;
		const candidate = resolve(join(dir, "pierre"));
		try {
			if (startsScript(candidate, scriptPath)) return candidate;
		} catch {
			continue;
		}
	}
}
/**
* The command that starts this program, as absolute paths. Git stores it in the
* helper setting. A `pierre` on PATH keeps its path when the CLI or Node.js
* changes version, but it runs `node` from the PATH of Git. With no such
* `pierre`, the command names Node.js and the script, and needs no PATH.
*/
function selfCommand(env = process.env) {
	const bun = Reflect.get(globalThis, "Bun");
	const main = isRecord(bun) ? bun.main : void 0;
	if (typeof main === "string" && main.startsWith("/$bunfs/")) return [process.execPath];
	const script = process.argv[1];
	if (!script) return [process.execPath];
	const scriptPath = realpathSync(script);
	const bin = binOnPath(scriptPath, env.PATH ?? "");
	return bin ? [bin] : [process.execPath, scriptPath];
}

// src/cli.ts
process.exitCode = await run(process.argv.slice(2), {
	env: process.env,
	cwd: process.cwd(),
	stdin: process.stdin,
	stdout: process.stdout,
	stderr: process.stderr,
	self: selfCommand()
});

export {  };