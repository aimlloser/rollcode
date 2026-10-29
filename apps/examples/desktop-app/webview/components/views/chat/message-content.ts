import {
	formatDisplayUserInput,
	stripModeNotices,
	type ProviderAuthInfo,
} from "@cline/shared/browser";
import type { ChatMessage } from "@/lib/chat-schema";
import { formatRunError, HUB_INTERRUPTED_MESSAGE_KIND } from "@/lib/run-error";

export function formatChatMessageContent(
	role: ChatMessage["role"],
	content: string,
	providerId?: string,
	providerAuth?: ProviderAuthInfo,
	messageKind?: string,
): string {
	const trimmed = content.trim();
	if (role === "error" && messageKind === HUB_INTERRUPTED_MESSAGE_KIND)
		return trimmed;
	if (role === "error")
		return formatRunError(trimmed, providerId, providerAuth);
	if (role === "user") return formatDisplayUserInput(trimmed);
	// Unwrap a complete echoed protocol envelope. Quoted examples, fenced code,
	// ordinary XML and raw transcript data are left intact.
	if (
		role === "assistant" &&
		/^(?:<mode_notice(?:\s|>)|<user_input\s+mode=)/.test(trimmed)
	) {
		const withoutNotices = stripModeNotices(trimmed);
		if (
			/^<user_input\s+mode="(?:act|plan|yolo)"[^>]*>[\s\S]*<\/user_input>$/.test(
				withoutNotices,
			)
		) {
			const body = formatDisplayUserInput(withoutNotices);
			try {
				const value: unknown = JSON.parse(body);
				if (
					value &&
					typeof value === "object" &&
					Object.keys(value).length === 1 &&
					"files" in value &&
					Array.isArray(value.files) &&
					value.files.length &&
					value.files.every(
						(file: unknown) =>
							file &&
							typeof file === "object" &&
							"path" in file &&
							typeof file.path === "string",
					)
				) {
					return (
						"File references:\n" +
						value.files
							.map(
								(file: {
									path: string;
									start_line?: number;
									end_line?: number | null;
								}) =>
									`- \`${file.path.replace(/`/g, "")}\`${typeof file.start_line === "number" ? ` (line ${file.start_line}${typeof file.end_line === "number" ? `–${file.end_line}` : " onward"})` : ""}`,
							)
							.join("\n")
					);
				}
			} catch {
				/* A normal textual reply needs no JSON handling. */
			}
			return body;
		}
	}
	return trimmed;
}
