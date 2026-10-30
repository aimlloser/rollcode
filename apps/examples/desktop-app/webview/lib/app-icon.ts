import { desktopClient, isTauriAvailable } from "@/lib/desktop-client";

export const APP_ICON_STORAGE_KEY = "wode.app-icon.v1";

/** Pixel-art WODE icons bundled for the picker and native shell. */
export const APP_ICONS = [
	{ id: "lucky-dice", label: "Lucky Dice" },
	{ id: "ace-high", label: "Ace High" },
	{ id: "casino-chip", label: "Casino Chip" },
	{ id: "jackpot", label: "Jackpot" },
] as const;

export type AppIconId = (typeof APP_ICONS)[number]["id"];

export const DEFAULT_APP_ICON: AppIconId = "lucky-dice";

const RETIRED_APP_ICON_MIGRATIONS = {
	classic: "ace-high",
	midnight: "lucky-dice",
	hologram: "jackpot",
	chip: "casino-chip",
	sunrise: "jackpot",
	steel: DEFAULT_APP_ICON,
} as const satisfies Record<string, AppIconId>;

type RetiredAppIconId = keyof typeof RETIRED_APP_ICON_MIGRATIONS;

function isRetiredAppIconId(value: unknown): value is RetiredAppIconId {
	return (
		typeof value === "string" &&
		Object.hasOwn(RETIRED_APP_ICON_MIGRATIONS, value)
	);
}

export function isAppIconId(value: unknown): value is AppIconId {
	return APP_ICONS.some((icon) => icon.id === value);
}

export function appIconAssetPath(icon: AppIconId): string {
	return `/app-icons/${icon}.png`;
}

export function appIconSurface(
	userAgent: string,
): "Dock" | "Taskbar" | "desktop" {
	if (/Windows/i.test(userAgent)) return "Taskbar";
	if (/(Macintosh|Mac OS X)/i.test(userAgent)) return "Dock";
	return "desktop";
}

export function readStoredAppIcon(): AppIconId {
	try {
		const stored =
			window.localStorage.getItem(APP_ICON_STORAGE_KEY) ??
			window.localStorage.getItem("rollcode.app-icon.v1") ??
			window.localStorage.getItem("cline.code.app-icon.v1");
		if (isRetiredAppIconId(stored)) {
			const migrated = RETIRED_APP_ICON_MIGRATIONS[stored];
			window.localStorage.setItem(APP_ICON_STORAGE_KEY, migrated);
			return migrated;
		}
		return isAppIconId(stored) ? stored : DEFAULT_APP_ICON;
	} catch {
		return DEFAULT_APP_ICON;
	}
}

function applyFavicon(icon: AppIconId): void {
	let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
	if (!link) {
		link = document.createElement("link");
		link.rel = "icon";
		document.head.appendChild(link);
	}
	link.href = appIconAssetPath(icon);
}

/**
 * Applies the icon to whatever this runtime can control: the Dock or taskbar
 * icon in the Tauri shell (native `set_app_icon` command, best-effort) and
 * the favicon in browser dev mode so the choice is still visible there.
 */
export async function applyAppIcon(icon: AppIconId): Promise<void> {
	if (isTauriAvailable()) {
		await desktopClient.invoke("set_app_icon", { icon });
	}
	applyFavicon(icon);
}

export async function setStoredAppIcon(icon: AppIconId): Promise<void> {
	await applyAppIcon(icon);
	try {
		window.localStorage.setItem(APP_ICON_STORAGE_KEY, icon);
	} catch {
		// Selection falls back to default next launch; applying still works.
	}
}

/**
 * Re-applies the persisted choice on launch. The native app icon reverts to
 * the bundled icon on every restart, so the app shell calls this once at boot.
 */
export async function syncAppIcon(): Promise<void> {
	const icon = readStoredAppIcon();
	await applyAppIcon(icon);
}
