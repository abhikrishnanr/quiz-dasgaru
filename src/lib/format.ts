/**
 * Utility functions for formatting text in the UI.
 */

/**
 * Strips the timestamp suffix (e.g., " (8:08:45 PM)") from a team name.
 * Example: "Team Alpha (8:08:45 PM)" -> "Team Alpha"
 * 
 * @param name The raw team name which may include a timestamp
 * @returns The cleaned team name
 */
export function formatTeamName(name: string | undefined | null): string {
    if (!name) return '';
    // Pattern matches " (H:MM:SS AM/PM)" at end of string
    return name.replace(/\s\(\d{1,2}:\d{2}:\d{2}\s[AP]M\)$/, '').trim();
}
