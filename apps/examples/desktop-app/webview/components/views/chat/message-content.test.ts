import { describe, expect, test } from "vitest";
import { formatChatMessageContent } from "./message-content";

describe("formatChatMessageContent", () => {
	test("cleans an echoed runtime envelope and shows file references without executing them", () => {
		const content =
			'<mode_notice mode="act">Plan mode constraint applied.</mode_notice>\n<user_input mode="act">' +
			JSON.stringify({
				files: [
					{ path: "C:/project/README.md", start_line: 1, end_line: null },
				],
			}) +
			"</user_input>";
		const formatted = formatChatMessageContent("assistant", content);
		expect(formatted).toBe(
			"File references:\n- `C:/project/README.md` (line 1 onward)",
		);
		expect(formatted).not.toContain("mode_notice");
	});
	test("preserves fenced protocol examples", () => {
		const example = '```xml\n<user_input mode="act">Example</user_input>\n```';
		expect(formatChatMessageContent("assistant", example)).toBe(example);
	});
	test("unwraps transport envelopes only for user messages", () => {
		expect(
			formatChatMessageContent(
				"user",
				"  <user_input>\nPlease fix the tests\n</user_input>  ",
			),
		).toBe("Please fix the tests");
	});

	test("preserves assistant examples that contain transport tags", () => {
		const content =
			"<user_input>\nThis tag is part of the explanation.\n</user_input>";
		expect(formatChatMessageContent("assistant", content)).toBe(content);
	});

	test("preserves assistant mode notices instead of stripping them", () => {
		const content = "<mode_notice>\nPlan mode details\n</mode_notice>";
		expect(formatChatMessageContent("assistant", content)).toBe(content);
	});

	test("trims outer whitespace and formats error messages", () => {
		expect(formatChatMessageContent("error", "  Request failed  \n")).toBe(
			"The run failed: Request failed",
		);
	});
});
